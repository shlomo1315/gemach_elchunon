/** העלאת מסמך — מחליף את supabase.storage.from("member-docs").upload(). */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { canAccessPath, MAX_UPLOAD_BYTES, ALLOWED_TYPES } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const form = await req.formData();
    const path = String(form.get("path") ?? "");
    const file = form.get("file");

    if (!path || !(file instanceof File)) {
      return NextResponse.json({ error: "חסר קובץ או נתיב" }, { status: 400 });
    }
    // חבר יכול להעלות רק לתיקייה שלו; מנהל לכל מקום
    if (!canAccessPath(user, path)) {
      return NextResponse.json({ error: "אין הרשאה לנתיב זה" }, { status: 403 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 10MB)" }, { status: 413 });
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const memberId = path.split("/")[0];

    // upsert:false בקוד המקורי → נתיב קיים הוא שגיאה
    const existing = await query(`select 1 from documents where path = $1`, [path]);
    if (existing.length) {
      return NextResponse.json({ error: "קובץ בנתיב זה כבר קיים" }, { status: 409 });
    }

    await query(
      `insert into documents (path, member_id, content_type, size_bytes, data)
       values ($1, $2, $3, $4, $5)`,
      [path, memberId || null, file.type || "application/octet-stream", file.size, buffer],
    );

    return NextResponse.json({ data: { path }, error: null });
  } catch (e) {
    console.error("[storage/upload]", (e as Error).message);
    return NextResponse.json({ error: "שגיאה בהעלאת הקובץ" }, { status: 500 });
  }
}
