/**
 * הגשת מסמך — מחליף את createSignedUrl().
 * בסופאבייס הקישור נחתם לשעה; כאן ההרשאה נבדקת בכל בקשה מול ה-session,
 * וזה חזק יותר: קישור שדלף לא מקנה גישה למי שאינו מורשה.
 */
import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { canAccessPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const path = req.nextUrl.searchParams.get("path");
    if (!path) return NextResponse.json({ error: "חסר נתיב" }, { status: 400 });
    if (!canAccessPath(user, path)) {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }

    const doc = await queryOne<{ data: Buffer; content_type: string | null }>(
      `select data, content_type from documents where path = $1`,
      [path],
    );
    if (!doc) return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });

    return new NextResponse(new Uint8Array(doc.data), {
      headers: {
        "Content-Type": doc.content_type || "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[storage/file]", (e as Error).message);
    return NextResponse.json({ error: "שגיאה בטעינת הקובץ" }, { status: 500 });
  }
}
