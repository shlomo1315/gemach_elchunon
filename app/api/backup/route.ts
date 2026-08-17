/**
 * גיבוי המערכת.
 *
 * GET  — הורדת קובץ גיבוי ישירות לדפדפן (מנהל בלבד).
 * POST — יצירת גיבוי ושליחתו במייל למנהל.
 *
 * ההפעלה היומית האוטומטית עושה POST עם כותרת Authorization הנושאת את
 * CRON_SECRET, ולכן אינה דורשת התחברות. כל שאר הקריאות דורשות מנהל.
 */
import { NextRequest, NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { buildEmail } from "@/lib/emailTemplate";
import { currentUser } from "@/lib/session";
import { query } from "@/lib/db";
import {
  backupRecipient, getBackupSettings, isBackupDue, recordBackupResult,
} from "@/lib/backupSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** שם קובץ נושא תאריך, כדי שגיבויים לא ידרסו זה את זה בתיבה. */
function backupFilename(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `gemach-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** הרצה אוטומטית מזוהה בסוד משותף במקום בעוגיית התחברות. */
function isCronCall(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const backup = await createBackup("download");
  const json = JSON.stringify(backup);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const cron = isCronCall(req);
  // auto=1 — בדיקה יזומה מהדפדפן בכניסה למערכת: שולחת רק אם הגיע הזמן
  const auto = req.nextUrl.searchParams.get("auto") === "1";

  if (!cron) {
    const user = await currentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }
  }

  const settings = await getBackupSettings();
  const to = backupRecipient(settings);

  // בהרצה אוטומטית — לא שולחים אם כבר נשלח היום, או אם הגיבוי כובה
  if ((auto || cron) && !isBackupDue(settings)) {
    return NextResponse.json({ data: { ok: true, skipped: "not_due" }, error: null });
  }

  if (!mailConfigured() || !to) {
    const msg = "לא הוגדרה כתובת מייל לגיבוי (או שמערכת המיילים אינה מוגדרת)";
    if (auto || cron) await recordBackupResult("failed", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const backup = await createBackup(cron ? "cron" : auto ? "daily" : "manual");
    const json = Buffer.from(JSON.stringify(backup), "utf8");
    const filename = backupFilename();

    const totalRows = Object.values(backup.counts).reduce((s, n) => s + n, 0);
    const rows: [string, string][] = [
      ["חברים", String(backup.counts.members ?? 0)],
      ["פעולות", String(backup.counts.transactions ?? 0)],
      ["שיקים", String(backup.counts.checks ?? 0)],
      ["מסמכים", String(backup.counts.documents ?? 0)],
      ["סה״כ רשומות", String(totalRows)],
      ["גודל הקובץ", humanSize(json.length)],
    ];

    const html = buildEmail({
      heading: "גיבוי יומי",
      intro: "מצורף גיבוי מלא של נתוני המערכת נכון להיום.",
      accent: "blue",
      rows,
      paragraphs: [
        "מומלץ לשמור את הקובץ במקום נוסף (מחשב או ענן), כדי שיהיה עותק גם אם יקרה משהו לשרת.",
        "לשחזור מהקובץ: הגדרות ← גיבוי ושחזור ← העלאת קובץ.",
      ],
      footnote: "מייל זה נשלח אוטומטית אחת ליום. הגיבוי אינו כולל את יומן המיילים.",
    });

    await sendMail(to, `גמ"ח זכרון אהרן — גיבוי יומי (${filename})`, html, [
      { filename, content: json },
    ]);

    await recordBackupResult("sent", null);

    // רישום ביומן, כדי שאפשר יהיה לראות שהגיבוי אכן נשלח
    try {
      await query(
        `insert into email_log (event, recipient_type, recipient, subject, html, status)
         values ($1, 'admin', $2, $3, $4, 'sent')`,
        ["backup.daily", to, `גיבוי יומי (${filename})`, html],
      );
    } catch {
      /* כשל ברישום לא מפיל את הגיבוי */
    }

    return NextResponse.json({
      data: { ok: true, filename, size: json.length, counts: backup.counts, to },
      error: null,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[api/backup]", msg);
    await recordBackupResult("failed", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
