import { query } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { buildEmail } from "@/lib/emailTemplate";
import { sendAndLog } from "@/lib/mailer";

export const runtime = "nodejs";
export const maxDuration = 60; // שליחה סדרתית לכל החברים עלולה לקחת זמן

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

  // שליחה יזומה היא פעולת ניהול בלבד
  const user = await currentUser();
  if (!user) return json({ ok: false, error: "no_auth" }, 401);
  if (user.role !== "admin") return json({ ok: false, error: "forbidden" }, 403);

  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();
  if (!subject || !message) return json({ ok: false, error: "missing_fields" }, 400);

  const all = body.memberIds === "all";
  if (!all && (!Array.isArray(body.memberIds) || body.memberIds.length === 0)) {
    return json({ ok: false, error: "missing_recipients" }, 400);
  }

  // רק חברים עם כתובת מייל תקינה. ב-"all" אין סינון לפי מזהים.
  const members = all
    ? await query<{ id: string; name: string; email: string }>(
        `select id, name, email from members
          where email is not null and btrim(email) <> ''`,
      )
    : await query<{ id: string; name: string; email: string }>(
        `select id, name, email from members
          where email is not null and btrim(email) <> '' and id = any($1::uuid[])`,
        [body.memberIds],
      );

  if (!members.length) return json({ ok: true, sent: 0, failed: 0 });

  const paragraphs = message.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  let sent = 0, failed = 0;

  // שליחה סדרתית — לא במקביל, כדי לא להיחסם על ידי ספק המייל
  for (const m of members) {
    const html = buildEmail({
      heading: subject,
      intro: `שלום ${m.name},`,
      paragraphs,
      rows: [],
      accent: "blue",
      footnote: "מייל זה נשלח מהנהלת גמ\"ח זכרון אהרן.",
    });
    const ok = await sendAndLog({
      to: m.email.trim(),
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
