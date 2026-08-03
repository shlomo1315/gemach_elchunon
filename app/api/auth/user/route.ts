/**
 * עדכון פרטי המשתמש המחובר — מחליף את supabase.auth.updateUser().
 * תומך בשינוי סיסמה, מייל ושם תצוגה.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { currentUser, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const { password, email, data } = (await req.json()) as {
      password?: string;
      email?: string;
      data?: { full_name?: string };
    };

    const sets: string[] = [];
    const params: unknown[] = [];

    if (password !== undefined) {
      if (String(password).length < 6) {
        return NextResponse.json({ error: "סיסמה חייבת להיות לפחות 6 תווים" }, { status: 400 });
      }
      params.push(await bcrypt.hash(String(password), 10));
      sets.push(`password_hash = $${params.length}`);
    }

    if (email !== undefined) {
      const lower = String(email).toLowerCase().trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lower)) {
        return NextResponse.json({ error: "כתובת מייל לא תקינה" }, { status: 400 });
      }
      const taken = await queryOne<{ id: string }>(
        `select id from app_users where lower(email) = $1 and id <> $2`,
        [lower, user.id],
      );
      if (taken) return NextResponse.json({ error: "המייל כבר בשימוש" }, { status: 409 });
      params.push(lower);
      sets.push(`email = $${params.length}`);
    }

    if (data?.full_name !== undefined) {
      params.push(data.full_name);
      sets.push(`full_name = $${params.length}`);
    }

    if (!sets.length) return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });

    params.push(user.id);
    const updated = await queryOne<{ id: string; email: string; full_name: string | null }>(
      `update app_users set ${sets.join(", ")} where id = $${params.length}
       returning id, email, full_name`,
      params,
    );

    // המייל נשמר ב-session — יש לרענן אותו כדי שהתצוגה תישאר עקבית
    if (updated && email !== undefined) {
      await setSessionCookie({ ...user, email: updated.email });
    }

    return NextResponse.json({ data: updated, error: null });
  } catch (e) {
    console.error("[auth/user]", (e as Error).message);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
