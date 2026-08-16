/**
 * שלב 2 בשחזור סיסמה: אימות הקוד הזמני וקביעת סיסמה חדשה.
 *
 * דרישות הסיסמה (נאכפות כאן בשרת, לא רק בדפדפן):
 * לפחות 10 תווים, לפחות ספרה אחת ולפחות אות אנגלית אחת.
 *
 * הגנות: הקוד נבדק מול hash, תקף 15 דקות, חד-פעמי, ומוגבל ל-5 ניסיונות.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query, queryOne, transaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

/**
 * בדיקת חוזק הסיסמה. מחזירה הודעת שגיאה, או null אם תקינה.
 * לא מיוצא: Next אוסר על route handler לייצא כל דבר מלבד הפעלים והתצורה.
 * העתק זהה קיים ב-AuthGuard לצורך משוב מיידי בדפדפן; השרת הוא הקובע.
 */
function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "הסיסמה חייבת להיות באורך 10 תווים לפחות";
  if (!/[0-9]/.test(pw)) return "הסיסמה חייבת לכלול לפחות ספרה אחת";
  if (!/[A-Za-z]/.test(pw)) return "הסיסמה חייבת לכלול לפחות אות אחת באנגלית";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = (await req.json()) as {
      email?: string; code?: string; password?: string;
    };

    const lowerEmail = String(email ?? "").toLowerCase().trim();
    const cleanCode = String(code ?? "").trim();
    const newPassword = String(password ?? "");

    if (!lowerEmail || !cleanCode) {
      return NextResponse.json({ error: "חסרים פרטים" }, { status: 400 });
    }

    const problem = passwordProblem(newPassword);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const user = await queryOne<{ id: string }>(
      `select id from app_users where lower(email) = $1`,
      [lowerEmail],
    );
    // הודעה אחידה לכל כשל באימות — לא מגלה אם המייל קיים
    const invalid = () =>
      NextResponse.json({ error: "הקוד שגוי או שפג תוקפו" }, { status: 400 });

    if (!user) return invalid();

    const reset = await queryOne<{ id: string; code_hash: string; attempts: number }>(
      `select id, code_hash, attempts
         from password_resets
        where user_id = $1 and used_at is null and expires_at > now()
        order by created_at desc
        limit 1`,
      [user.id],
    );

    if (!reset) return invalid();

    if (reset.attempts >= MAX_ATTEMPTS) {
      // נועלים את הקוד כדי שלא ימשיכו לנחש אותו
      await query(`update password_resets set used_at = now() where id = $1`, [reset.id]);
      return NextResponse.json(
        { error: "בוצעו יותר מדי ניסיונות. יש לבקש קוד חדש." },
        { status: 429 },
      );
    }

    const ok = await bcrypt.compare(cleanCode, reset.code_hash);
    if (!ok) {
      await query(`update password_resets set attempts = attempts + 1 where id = $1`, [reset.id]);
      return invalid();
    }

    const hash = await bcrypt.hash(newPassword, 10);

    // עדכון הסיסמה וסימון הקוד כמנוצל — יחד, כדי שלא ייווצר מצב ביניים
    await transaction(async (c) => {
      await c.query(
        `update app_users set password_hash = $1, updated_at = now() where id = $2`,
        [hash, user.id],
      );
      await c.query(`update password_resets set used_at = now() where id = $1`, [reset.id]);
    });

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    console.error("[auth/reset-password]", (e as Error).message);
    return NextResponse.json({ error: "אירעה שגיאה. נסה שוב." }, { status: 500 });
  }
}
