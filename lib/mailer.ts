// מודול שרת בלבד: שליחת מיילים דרך Gmail SMTP + רישום ביומן email_log.
// משמש את /api/notify, /api/send-email, /api/resend-email.

import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
// חיבור OAuth2 — לא דורש אימות דו-שלבי בחשבון (ראה EMAIL_SETUP.md)
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || GMAIL_USER || "";
const EMAIL_FROM = `"גמ״ח זכרון אהרן" <${GMAIL_USER}>`;

const hasOAuth = !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);

export function mailConfigured(): boolean {
  return !!GMAIL_USER && (hasOAuth || !!GMAIL_APP_PASSWORD);
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

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!mailConfigured()) throw new Error("not_configured");
  await getTransporter().sendMail({ from: EMAIL_FROM, to, subject, html });
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

export async function getEmailSettings(db: SupabaseClient): Promise<EmailSettings> {
  try {
    const { data } = await db.from("email_settings").select("*").maybeSingle();
    return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
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
  db: SupabaseClient,
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
    await db.from("email_log").insert({
      event: args.event ?? null,
      recipient_type: args.recipient_type,
      recipient: args.to,
      member_id: args.member_id ?? null,
      member_name: args.member_name ?? null,
      subject: args.subject,
      html: args.html,
      status, error,
    });
  } catch {
    /* כשל ברישום היומן לא מפיל את הזרימה */
  }
  return status === "sent";
}
