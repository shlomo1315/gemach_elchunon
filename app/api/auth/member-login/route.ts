/**
 * יצירת/עדכון חשבון התחברות לחבר — מחליף את ה-Edge Function
 * "create-member-login" (שהופעלה בקוד בשם "quick-service").
 *
 * כל ההגנות של הפונקציה המקורית נשמרות: רק מנהל רשאי, אסור להשתמש
 * במייל של המנהל עצמו, ואסור לשייך מייל שכבר שייך לחבר אחר.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne, transaction } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const caller = await currentUser();
    if (!caller) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    if (caller.role !== "admin") {
      return NextResponse.json({ error: "אין הרשאה — רק מנהל יכול ליצור התחברות" }, { status: 403 });
    }

    const { email, password, memberId } = (await req.json()) as {
      email?: string; password?: string; memberId?: string;
    };

    if (!email || !password || String(password).length < 6) {
      return NextResponse.json({ error: "מייל וסיסמה (לפחות 6 תווים) נדרשים" }, { status: 400 });
    }

    const lowerEmail = String(email).toLowerCase().trim();

    // 1) המייל של המנהל המחובר הוא אותו חשבון — חסימה
    if (lowerEmail === caller.email.toLowerCase()) {
      return NextResponse.json(
        { error: "לא ניתן להגדיר את המייל שלך (מנהל) כהתחברות של חבר. השתמש במייל הפרטי של החבר." },
        { status: 400 },
      );
    }

    // 2) המייל כבר משויך לחבר אחר?
    const other = await queryOne<{ id: string }>(
      `select id from members
        where lower(email) = $1 and id <> $2
        limit 1`,
      [lowerEmail, memberId || "00000000-0000-0000-0000-000000000000"],
    );
    if (other) {
      return NextResponse.json({ error: "המייל כבר משויך לחבר אחר." }, { status: 400 });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const result = await transaction(async (c) => {
      const existing = await c.query<{ id: string }>(
        `select id from app_users where lower(email) = $1`,
        [lowerEmail],
      );

      let userId: string;
      let updated = false;

      if (existing.rows.length) {
        // אידמפוטנטי — אותה התנהגות כמו הפונקציה המקורית (איפוס סיסמה)
        userId = existing.rows[0].id;
        updated = true;
        await c.query(
          `update app_users set password_hash = $1, role = 'member', member_id = $2 where id = $3`,
          [hash, memberId ?? null, userId],
        );
      } else {
        const ins = await c.query<{ id: string }>(
          `insert into app_users (email, password_hash, role, member_id)
           values ($1, $2, 'member', $3) returning id`,
          [lowerEmail, hash, memberId ?? null],
        );
        userId = ins.rows[0].id;
      }

      // שיוך המייל לשורת החבר
      if (memberId) {
        await c.query(`update members set email = $1 where id = $2`, [lowerEmail, memberId]);
      }

      return { userId, updated };
    });

    return NextResponse.json({ data: { ok: true, ...result }, error: null });
  } catch (e) {
    console.error("[auth/member-login]", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
