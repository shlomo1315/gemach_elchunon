/**
 * הגדרות הגיבוי: לאן לשלוח, האם פעיל, ומתי נשלח לאחרונה.
 * מנהל בלבד.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { ADMIN_EMAIL } from "@/lib/mailer";
import {
  backupRecipient, daysSinceBackup, getBackupSettings, isBackupDue, saveBackupSettings,
} from "@/lib/backupSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await currentUser();
  return user && user.role === "admin" ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const s = await getBackupSettings();
  return NextResponse.json({
    data: {
      ...s,
      effective_email: backupRecipient(s),   // לאן באמת יישלח
      admin_email: ADMIN_EMAIL || null,      // ברירת המחדל, להצגה
      due: isBackupDue(s),
      days_since: daysSinceBackup(s),
    },
    error: null,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  let body: { enabled?: boolean; backup_email?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const email = (body.backup_email ?? "").trim();
  // כתובת ריקה מותרת — משמעותה "השתמש במייל המנהל"
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "כתובת המייל אינה תקינה" }, { status: 400 });
  }

  await saveBackupSettings({ enabled: body.enabled, backup_email: email || null });

  const s = await getBackupSettings();
  return NextResponse.json({
    data: { ...s, effective_email: backupRecipient(s) },
    error: null,
  });
}
