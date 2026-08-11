import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { setSessionCookie, type SessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: "אימייל וסיסמה נדרשים" }, { status: 400 });
    }

    const lower = String(email).toLowerCase().trim();
    const row = await queryOne<{ id: string; email: string; password_hash: string; full_name: string | null }>(
      `select id, email, password_hash, full_name from app_users where lower(email) = $1`,
      [lower],
    );

    // אותה תשובה בדיוק בשני המקרים — לא מסגירים אילו מיילים רשומים
    const ok = row ? await bcrypt.compare(password, row.password_hash) : false;
    if (!row || !ok) {
      return NextResponse.json({ error: "אימייל או סיסמה שגויים" }, { status: 401 });
    }

    // זיהוי התפקיד בדיוק כמו is_admin() בסופאבייס:
    // מנהל = משתמש מחובר שהמייל שלו אינו רשום בטבלת members.
    const member = await queryOne<{ id: string }>(
      `select id from members where lower(email) = $1 limit 1`,
      [lower],
    );

    const user: SessionUser = {
      id: row.id,
      email: row.email,
      role: member ? "member" : "admin",
      member_id: member?.id ?? null,
    };

    await query(`update app_users set last_sign_in_at = now() where id = $1`, [row.id]);
    await setSessionCookie(user);

    return NextResponse.json({
      data: { ...user, user_metadata: { full_name: row.full_name ?? undefined } },
      error: null,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[auth/login]", msg);

    // תקלת תצורה (חסר AUTH_SECRET, אין גישה למסד) אינה טעות של המשתמש.
    // מפרידים אותה מ"סיסמה שגויה" כדי שלא ישלחו את החברים לאפס סיסמאות לחינם.
    const config = /AUTH_SECRET|DATABASE_URL|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH/i.test(msg);
    return NextResponse.json(
      { error: config ? "תקלת תצורה בשרת — פנה למנהל המערכת" : "שגיאת שרת" },
      { status: 500 },
    );
  }
}
