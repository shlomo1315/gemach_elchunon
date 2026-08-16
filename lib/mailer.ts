// מודול שרת בלבד: שליחת מיילים + רישום ביומן email_log.
// דרך ראשית: Resend מכתובת office@gemach.shlomo4you.com.
// גיבוי: Gmail SMTP (OAuth2 / סיסמת אפליקציה) — רק אם אין RESEND_API_KEY.
// קבלת מיילים ל-office@ נעשית דרך Cloudflare Email Routing (ראה EMAIL_SETUP.md).
// משמש את /api/notify, /api/send-email, /api/resend-email.

import nodemailer from "nodemailer";
import { query, queryOne } from "@/lib/db";

// --- Resend (הדרך הראשית — שליחה מהדומיין gemach.shlomo4you.com) ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// --- Gmail (גיבוי, אם אין RESEND_API_KEY) ---
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || GMAIL_USER || "";
export const OFFICE_EMAIL = "office@gemach.shlomo4you.com";
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  (RESEND_API_KEY
    ? `גמ"ח זכרון אהרן <${OFFICE_EMAIL}>`
    : `"גמ״ח זכרון אהרן" <${GMAIL_USER}>`);

const hasOAuth = !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);

export function mailConfigured(): boolean {
  return !!RESEND_API_KEY || (!!GMAIL_USER && (hasOAuth || !!GMAIL_APP_PASSWORD));
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: hasOAuth
        ? {
            type: "OAuth2",
            user: GMAIL_USER,
            clientId: GMAIL_CLIENT_ID,
            clientSecret: GMAIL_CLIENT_SECRET,
            refreshToken: GMAIL_REFRESH_TOKEN,
          }
        : { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

/** קובץ מצורף למייל (משמש את הגיבוי היומי). */
export type MailAttachment = { filename: string; content: Buffer };

async function sendViaResend(
  to: string, subject: string, html: string, attachments?: MailAttachment[],
): Promise<void> {
  const body: Record<string, unknown> = {
    from: EMAIL_FROM, to: [to], subject, html,
    // reply_to: תשובות של חברים חוזרות ל-office@ (שמועבר לתיבה דרך Cloudflare)
    reply_to: OFFICE_EMAIL,
  };
  if (attachments?.length) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

export async function sendMail(
  to: string, subject: string, html: string, attachments?: MailAttachment[],
): Promise<void> {
  if (!mailConfigured()) throw new Error("not_configured");
  if (RESEND_API_KEY) {
    await sendViaResend(to, subject, html, attachments);
  } else {
    await getTransporter().sendMail({
      from: EMAIL_FROM, to, subject, html, replyTo: OFFICE_EMAIL,
      attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
  }
}

export type EmailSettings = {
  send_to_admin: boolean;
  send_to_member: boolean;
  ev_transactions: boolean;
  ev_members: boolean;
  ev_checks: boolean;
  ev_requests: boolean;
  ev_import: boolean;
};

const DEFAULT_SETTINGS: EmailSettings = {
  send_to_admin: true, send_to_member: true,
  ev_transactions: true, ev_members: true, ev_checks: true,
  ev_requests: true, ev_import: true,
};

export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const row = await queryOne<EmailSettings>(`select * from email_settings limit 1`);
    return row ? { ...DEFAULT_SETTINGS, ...row } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// גוזר את הקטגוריה מהתחילית של קוד האירוע ("transaction.created" → transactions)
export function categoryEnabled(s: EmailSettings, event?: string | null): boolean {
  switch ((event || "").split(".")[0]) {
    case "transaction": return s.ev_transactions;
    case "member":      return s.ev_members;
    case "check":       return s.ev_checks;
    case "request":     return s.ev_requests;
    case "import":      return s.ev_import;
    default:            return true; // אירוע לא מוכר — שולחים (ברירת מחדל פתוחה)
  }
}

export async function sendAndLog(
  args: {
    to: string; subject: string; html: string;
    event?: string | null;
    recipient_type: "admin" | "member";
    member_id?: string | null; member_name?: string | null;
  }
): Promise<boolean> {
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  try {
    await sendMail(args.to, args.subject, args.html);
  } catch (e) {
    status = "failed";
    error = (e as Error).message;
  }
  try {
    await query(
      `insert into email_log
         (event, recipient_type, recipient, member_id, member_name, subject, html, status, error)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        args.event ?? null,
        args.recipient_type,
        args.to,
        args.member_id ?? null,
        args.member_name ?? null,
        args.subject,
        args.html,
        status,
        error,
      ],
    );
  } catch {
    /* כשל ברישום היומן לא מפיל את הזרימה */
  }
  return status === "sent";
}
