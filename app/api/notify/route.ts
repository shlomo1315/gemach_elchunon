import { buildEmail, type EmailRow, type BalanceSummary } from "@/lib/emailTemplate";
import { ADMIN_EMAIL, categoryEnabled, getEmailSettings, mailConfigured, sendAndLog } from "@/lib/mailer";
import { queryOne } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { ils } from "@/lib/format";
import { PORTAL_URL } from "@/lib/site";

export const runtime = "nodejs";

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

export async function POST(req: Request) {
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  // אם המערכת לא הוגדרה — לא שגיאה, פשוט מדלגים (האפליקציה ממשיכה לעבוד)
  if (!mailConfigured()) {
    return json({ ok: true, skipped: "not_configured" });
  }

  // אימות: רק משתמש מחובר יכול להפעיל שליחה (מונע ניצול לרעה).
  // ההזדהות מגיעה מעוגיית ה-session, לא מטוקן ב-header.
  const user = await currentUser();
  if (!user) return json({ ok: false, error: "no_auth" }, 401);

  if (!body?.heading) return json({ ok: false, error: "missing_heading" }, 400);

  // הגדרות שליחה: קטגוריה כבויה => לא שולחים ולא רושמים
  const settings = await getEmailSettings();
  if (!categoryEnabled(settings, body.event)) {
    return json({ ok: true, skipped: "category_disabled" });
  }

  const rows: EmailRow[] = Array.isArray(body.rows) ? body.rows : [];

  // שליפת פרטי החבר (שם + מייל) לפי memberId, אם קיים
  let memberEmail: string | null = null;
  let memberName: string | null = body.memberName ?? null;
  let balanceSummary: BalanceSummary | null = null;
  if (body.memberId) {
    const m = await queryOne<{ name: string | null; email: string | null; balance: number | null }>(
      `select m.name, m.email, b.balance
         from members m
         left join member_balances b on b.id = m.id
        where m.id = $1`,
      [body.memberId],
    );
    if (m) {
      memberName = m.name ?? memberName;
      memberEmail = (m.email ?? "").trim() || null;

      // שיקים להפקדה שטרם נפדו. הסיווג זהה ל-checkKind ב-lib/money:
      // רק kind = 'deposit' הוא שיק לזכות; כל השאר (כולל ריק/null בשיקים
      // ישנים) הוא שיק לפרעון הלוואה ואינו נספר כאן.
      const pend = await queryOne<{ sum: number | null; cnt: number }>(
        `select coalesce(sum(amount), 0) as sum, count(*)::int as cnt
           from checks
          where member_id = $1 and status = 'pending' and kind = 'deposit'`,
        [body.memberId],
      );
      const balance = Number(m.balance ?? 0) || 0;
      const pendSum = Number(pend?.sum ?? 0) || 0;
      const pendCount = Number(pend?.cnt ?? 0) || 0;

      balanceSummary = {
        balance: ils(balance),
        pendingChecks: pendCount > 0 ? ils(pendSum) : null,
        pendingCount: pendCount,
        projected: pendCount > 0 ? ils(balance + pendSum) : null,
      };
    }
  }

  const subjectBase = `גמ"ח זכרון אהרן — ${body.heading}`;
  const results: Record<string, string> = {};

  // === מייל למנהל ===
  if (settings.send_to_admin && ADMIN_EMAIL) {
    const adminHtml = buildEmail({
      heading: body.heading,
      intro: memberName ? `פעולה נרשמה בכרטיס החבר: ${memberName}` : "פעולה נרשמה במערכת.",
      amount: body.amount,
      accent: body.accent,
      rows,
      footnote: "מייל זה נשלח אליך כמנהל המערכת בעקבות פעולה שבוצעה.",
    });
    const ok = await sendAndLog({
      to: ADMIN_EMAIL, subject: `[ניהול] ${subjectBase}`, html: adminHtml,
      event: body.event, recipient_type: "admin",
      member_id: body.memberId, member_name: memberName,
    });
    results.admin = ok ? "sent" : "failed";
  } else {
    results.admin = "skipped";
  }

  // === מייל לחבר (אם קשור אליו, יש memberId, ויש לו מייל) ===
  const wantMember = settings.send_to_member && body.toMember !== false && !!body.memberId;
  if (wantMember && memberEmail) {
    const memberHtml = buildEmail({
      heading: body.heading,
      intro: `שלום${memberName ? ` ${memberName}` : ""}, נרשמה פעולה הקשורה לחשבונך בגמ"ח.`,
      amount: body.amount,
      accent: body.accent,
      rows,
      balance: balanceSummary,
      portalUrl: PORTAL_URL,
      portalEmail: memberEmail,
      footnote: "לכל שאלה ניתן לפנות להנהלת הגמ\"ח. מייל זה נשלח אוטומטית.",
    });
    const ok = await sendAndLog({
      to: memberEmail, subject: subjectBase, html: memberHtml,
      event: body.event, recipient_type: "member",
      member_id: body.memberId, member_name: memberName,
    });
    results.member = ok ? "sent" : "failed";
  } else {
    results.member = wantMember ? "no_email_on_file" : "skipped";
  }

  return json({ ok: true, results });
}
