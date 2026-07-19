import { createClient } from "@supabase/supabase-js";
import { buildEmail } from "@/lib/emailTemplate";
import { sendAndLog } from "@/lib/mailer";

export const runtime = "nodejs";
export const maxDuration = 60; // שליחה סדרתית לכל החברים עלולה לקחת זמן

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type SendBody = {
  memberIds: string[] | "all"; // "all" = כל החברים שיש להם מייל
  subject: string;
  message: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ ok: false, error: "not_configured" }, 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "no_auth" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ ok: false, error: "invalid_auth" }, 401);

  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();
  if (!subject || !message) return json({ ok: false, error: "missing_fields" }, 400);
  if (body.memberIds !== "all" && (!Array.isArray(body.memberIds) || body.memberIds.length === 0)) {
    return json({ ok: false, error: "missing_recipients" }, 400);
  }

  let query = supabase.from("members").select("id,name,email")
    .not("email", "is", null).neq("email", "");
  if (body.memberIds !== "all") query = query.in("id", body.memberIds);
  const { data: members, error: qErr } = await query;
  if (qErr) return json({ ok: false, error: qErr.message }, 500);
  if (!members?.length) return json({ ok: true, sent: 0, failed: 0 });

  const paragraphs = message.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  let sent = 0, failed = 0;

  // שליחה סדרתית — לא במקביל, כדי לא להיחסם על ידי Gmail
  for (const m of members) {
    const html = buildEmail({
      heading: subject,
      intro: `שלום ${m.name},`,
      paragraphs,
      rows: [],
      accent: "blue",
      footnote: "מייל זה נשלח מהנהלת גמ\"ח זכרון אהרן.",
    });
    const ok = await sendAndLog(supabase, {
      to: (m.email as string).trim(),
      subject: `גמ"ח זכרון אהרן — ${subject}`,
      html,
      event: "manual.sent",
      recipient_type: "member",
      member_id: m.id,
      member_name: m.name,
    });
    if (ok) sent++; else failed++;
  }

  return json({ ok: true, sent, failed });
}
