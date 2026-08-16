/**
 * שלב 1 בשחזור סיסמה: שליחת קוד זמני למייל.
 *
 * הגנות:
 * - התשובה זהה תמיד ("אם המייל רשום — נשלח קוד"), כדי שלא ניתן יהיה
 *   לגלות דרך המערכת מי חבר בגמ"ח (user enumeration).
 * - הקוד נשמר כ-hash בלבד, לא כטקסט.
 * - תוקף 15 דקות, שימוש חד-פעמי.
 * - קודים קודמים של אותו משתמש מבוטלים בעת בקשה חדשה.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { query, queryOne } from "@/lib/db";
import { buildEmail } from "@/lib/emailTemplate";
import { mailConfigured, sendAndLog } from "@/lib/mailer";
import { PORTAL_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 15;

/** תשובה אחידה — לא חושפת אם המייל קיים במערכת. */
function genericOk() {
  return NextResponse.json({
    data: { ok: true, message: "אם המייל רשום במערכת, נשלח אליו קוד זמני." },
    error: null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const lowerEmail = String(email ?? "").toLowerCase().trim();

    if (!lowerEmail || !lowerEmail.includes("@")) {
      return NextResponse.json({ error: "יש להזין כתובת מייל תקינה" }, { status: 400 });
    }

    const user = await queryOne<{ id: string; email: string; member_id: string | null }>(
      `select id, email, member_id from app_users where lower(email) = $1`,
      [lowerEmail],
    );

    // אין משתמש — מחזירים בדיוק את אותה תשובה, בלי לשלוח דבר.
    if (!user) return genericOk();

    // אם המערכת לא מוגדרת לשליחת מיילים אין טעם לייצר קוד שלא יגיע לאיש.
    if (!mailConfigured()) return genericOk();

    // קוד בן 6 ספרות ממקור אקראי קריפטוגרפי (לא Math.random)
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

    // בקשה חדשה מבטלת קודים קודמים שטרם נוצלו
    await query(
      `update password_resets set used_at = now()
        where user_id = $1 and used_at is null`,
      [user.id],
    );

    await query(
      `insert into password_resets (user_id, code_hash, expires_at) values ($1, $2, $3)`,
      [user.id, codeHash, expiresAt],
    );

    const html = buildEmail({
      heading: "קוד לאיפוס סיסמה",
      intro: "קיבלנו בקשה לאיפוס הסיסמה שלך במערכת הגמ\"ח.",
      accent: "gold",
      amount: code,
      rows: [
        ["תוקף הקוד", `${CODE_TTL_MINUTES} דקות`],
        ["כתובת המערכת", PORTAL_URL.replace(/^https?:\/\//, "")],
      ],
      paragraphs: [
        "הזן את הקוד בדף הכניסה כדי לבחור סיסמה חדשה.",
      ],
      footnote:
        "אם לא ביקשת לאפס סיסמה — אפשר להתעלם מהמייל הזה, והסיסמה הקיימת תישאר בתוקף. אין למסור את הקוד לאף אחד.",
    });

    await sendAndLog({
      to: user.email,
      subject: 'גמ"ח זכרון אהרן — קוד לאיפוס סיסמה',
      html,
      event: "auth.password_reset",
      recipient_type: user.member_id ? "member" : "admin",
      member_id: user.member_id,
      member_name: null,
    });

    return genericOk();
  } catch (e) {
    console.error("[auth/forgot-password]", (e as Error).message);
    // גם בשגיאה לא חושפים פרטים החוצה
    return genericOk();
  }
}
