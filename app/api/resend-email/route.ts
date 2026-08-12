import { queryOne } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { sendAndLog } from "@/lib/mailer";

export const runtime = "nodejs";

type LogRow = {
  recipient: string;
  subject: string;
  html: string;
  event: string | null;
  recipient_type: "admin" | "member";
  member_id: string | null;
  member_name: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  let body: { logId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  if (!body.logId) return json({ ok: false, error: "missing_log_id" }, 400);

  // רק מנהל מחובר רשאי לשלוח מחדש (היומן חושף תוכן של כל החברים)
  const user = await currentUser();
  if (!user) return json({ ok: false, error: "no_auth" }, 401);
  if (user.role !== "admin") return json({ ok: false, error: "forbidden" }, 403);

  const row = await queryOne<LogRow>(
    `select recipient, subject, html, event, recipient_type, member_id, member_name
       from email_log where id = $1`,
    [body.logId],
  );
  if (!row) return json({ ok: false, error: "log_not_found" }, 404);

  // שליחה חוזרת של אותו מייל בדיוק — נרשמת כשורת יומן חדשה, המקור לא משתנה
  const ok = await sendAndLog({
    to: row.recipient,
    subject: row.subject,
    html: row.html,
    event: row.event,
    recipient_type: row.recipient_type,
    member_id: row.member_id,
    member_name: row.member_name,
  });

  return json({ ok: true, status: ok ? "sent" : "failed" });
}
