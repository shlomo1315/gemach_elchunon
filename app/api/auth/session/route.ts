import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentUser();
  if (!session) return NextResponse.json({ user: null });

  // מעשירים מה-DB כדי שדף ההגדרות יציג פרטי חשבון עדכניים
  const row = await queryOne<{
    email: string; full_name: string | null;
    created_at: string; last_sign_in_at: string | null;
  }>(
    `select email, full_name, created_at, last_sign_in_at from app_users where id = $1`,
    [session.id],
  );

  // המשתמש נמחק מאז שהעוגייה הונפקה
  if (!row) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      ...session,
      email: row.email,
      created_at: row.created_at,
      last_sign_in_at: row.last_sign_in_at,
      user_metadata: { full_name: row.full_name ?? undefined },
    },
  });
}
