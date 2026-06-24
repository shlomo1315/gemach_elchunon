import { createClient } from "@supabase/supabase-js";
import { buildEmail, type EmailRow } from "@/lib/emailTemplate";

export const runtime = "nodejs";

// משתני סביבה (מוגדרים ב-Vercel → Project Settings → Environment Variables)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_FROM = process.env.EMAIL_FROM || 'גמ"ח זכרון אהרן <onboarding@resend.dev>';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type NotifyBody = {
  event?: string;
  heading: string;
  intro?: string;
  accent?: "green" | "red" | "gold" | "blue";
  amount?: string;
  rows?: EmailRow[];
  memberId?: string | null;
  memberName?: string | null;
  toMember?: boolean; // ברירת מחדל: true (אם יש memberId ויש לו מייל)
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendViaResend(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${text}`);
  }
  return res.json().catch(() => ({}));
}

export async function POST(req: Request) {
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  // אם המערכת לא הוגדרה — לא שגיאה, פשוט מדלגים (האפליקציה ממשיכה לעבוד)
  if (!RESEND_API_KEY || !ADMIN_EMAIL || !SUPABASE_URL || !SUPABASE_ANON) {
    return json({ ok: true, skipped: "not_configured" });
  }

  // אימות: רק משתמש מחובר יכול להפעיל שליחה (מונע ניצול לרעה)
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "no_auth" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ ok: false, error: "invalid_auth" }, 401);
  }

  if (!body?.heading) return json({ ok: false, error: "missing_heading" }, 400);

  const rows: EmailRow[] = Array.isArray(body.rows) ? body.rows : [];

  // שליפת פרטי החבר (שם + מייל) לפי memberId, אם קיים
  let memberEmail: string | null = null;
  let memberName: string | null = body.memberName ?? null;
  if (body.memberId) {
    const { data: m } = await supabase
      .from("members")
      .select("name,email")
      .eq("id", body.memberId)
      .maybeSingle();
    if (m) {
      memberName = m.name ?? memberName;
      memberEmail = (m.email ?? "").trim() || null;
    }
  }

  const subjectBase = `גמ"ח זכרון אהרן — ${body.heading}`;
  const results: Record<string, string> = {};

  // === מייל למנהל (תמיד) ===
  try {
    const adminHtml = buildEmail({
      heading: body.heading,
      intro: memberName ? `פעולה נרשמה בכרטיס החבר: ${memberName}` : "פעולה נרשמה במערכת.",
      amount: body.amount,
      accent: body.accent,
      rows,
      footnote: "מייל זה נשלח אליך כמנהל המערכת בעקבות פעולה שבוצעה.",
    });
    await sendViaResend(ADMIN_EMAIL, `[ניהול] ${subjectBase}`, adminHtml);
    results.admin = "sent";
  } catch (e) {
    results.admin = `error: ${(e as Error).message}`;
  }

  // === מייל לחבר (אם קשור אליו, יש memberId, ויש לו מייל) ===
  const wantMember = body.toMember !== false && !!body.memberId;
  if (wantMember && memberEmail) {
    try {
      const memberHtml = buildEmail({
        heading: body.heading,
        intro: `שלום${memberName ? ` ${memberName}` : ""}, נרשמה פעולה הקשורה לחשבונך בגמ"ח.`,
        amount: body.amount,
        accent: body.accent,
        rows,
        footnote: "לכל שאלה ניתן לפנות להנהלת הגמ\"ח. מייל זה נשלח אוטומטית.",
      });
      await sendViaResend(memberEmail, subjectBase, memberHtml);
      results.member = "sent";
    } catch (e) {
      results.member = `error: ${(e as Error).message}`;
    }
  } else {
    results.member = wantMember ? "no_email_on_file" : "skipped";
  }

  return json({ ok: true, results });
}
