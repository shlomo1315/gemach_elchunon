/**
 * שחזור המערכת מקובץ גיבוי — הפעולה ההרסנית ביותר במערכת.
 *
 * שכבות ההגנה:
 * 1. מנהל בלבד.
 * 2. הקובץ נבדק לפני שנוגעים במסד (מבנה, גרסה, טבלאות).
 * 3. ?preview=1 מחזיר מה ישתנה, בלי לבצע דבר.
 * 4. לביצוע בפועל חובה לשלוח confirm: "שחזר" — לחיצה בלבד לא מספיקה.
 * 5. לפני הדריסה נשלח גיבוי של המצב הנוכחי למייל המנהל.
 * 6. השחזור עצמו רץ בטרנזקציה: או הכל, או כלום.
 */
import { NextRequest, NextResponse } from "next/server";
import { createBackup, previewRestore, restoreBackup, validateBackup } from "@/lib/backup";
import { ADMIN_EMAIL, mailConfigured, sendMail } from "@/lib/mailer";
import { buildEmail } from "@/lib/emailTemplate";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** מילת האישור שהמנהל חייב להקליד. */
const CONFIRM_WORD = "שחזר";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה — רק מנהל יכול לשחזר" }, { status: 403 });
  }

  const preview = req.nextUrl.searchParams.get("preview") === "1";

  let body: { file?: unknown; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "הקובץ אינו JSON תקין" }, { status: 400 });
  }

  const check = validateBackup(body.file);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const file = check.file;

  // --- תצוגה מקדימה: מה יקרה, בלי לגעת בכלום ---
  if (preview) {
    const diff = await previewRestore(file);
    return NextResponse.json({
      data: {
        preview: true,
        created_at: file.created_at,
        version: file.version,
        tables: diff,
      },
      error: null,
    });
  }

  // --- ביצוע בפועל ---
  if (body.confirm !== CONFIRM_WORD) {
    return NextResponse.json(
      { error: `לאישור השחזור יש להקליד "${CONFIRM_WORD}"` },
      { status: 400 },
    );
  }

  try {
    // רשת ביטחון: גיבוי של המצב הנוכחי לפני שהוא נדרס
    let safetyNote = "לא נשלח גיבוי מקדים (מערכת המיילים אינה מוגדרת)";
    if (mailConfigured() && ADMIN_EMAIL) {
      try {
        const before = await createBackup("pre-restore");
        const json = Buffer.from(JSON.stringify(before), "utf8");
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const filename = `gemach-before-restore-${stamp}.json`;

        await sendMail(
          ADMIN_EMAIL,
          'גמ"ח זכרון אהרן — גיבוי לפני שחזור',
          buildEmail({
            heading: "גיבוי לפני שחזור",
            intro: "מצורף גיבוי של המצב שהיה במערכת רגע לפני ביצוע שחזור מקובץ.",
            accent: "gold",
            rows: [
              ["חברים", String(before.counts.members ?? 0)],
              ["פעולות", String(before.counts.transactions ?? 0)],
              ["שיקים", String(before.counts.checks ?? 0)],
            ],
            paragraphs: ["שמור מייל זה — הוא מאפשר לחזור למצב הקודם אם השחזור לא היה מכוון."],
            footnote: "נשלח אוטומטית לפני פעולת שחזור.",
          }),
          [{ filename, content: json }],
        );
        safetyNote = `נשלח גיבוי מקדים למייל (${filename})`;
      } catch (e) {
        // אם הגיבוי המקדים נכשל — עוצרים. לא דורסים בלי רשת ביטחון.
        return NextResponse.json(
          {
            error:
              "השחזור בוטל: לא הצלחנו לשלוח גיבוי של המצב הנוכחי למייל, ולכן לא נדרוס את הנתונים. " +
              "בדוק את הגדרות המייל ונסה שוב. (" + (e as Error).message + ")",
          },
          { status: 500 },
        );
      }
    }

    const restored = await restoreBackup(file);
    const total = Object.values(restored).reduce((s, n) => s + n, 0);

    return NextResponse.json({
      data: { ok: true, restored, total, safetyNote },
      error: null,
    });
  } catch (e) {
    console.error("[api/backup/restore]", (e as Error).message);
    return NextResponse.json(
      { error: "השחזור נכשל והנתונים לא שונו: " + (e as Error).message },
      { status: 500 },
    );
  }
}
