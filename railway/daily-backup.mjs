#!/usr/bin/env node
/**
 * גיבוי יומי — מופעל על ידי Railway Cron.
 *
 * הסקריפט קורא ל-/api/backup באפליקציה, שמייצר את הגיבוי ושולח אותו
 * למייל המנהל. ההרצה מזוהה באמצעות CRON_SECRET ולכן אינה דורשת התחברות.
 *
 * חשוב (דרישת Railway): התהליך חייב לצאת בסיום, אחרת הרצות הבאות יידלגו.
 *
 * משתני סביבה:
 *   CRON_SECRET  — חובה. אותו ערך שמוגדר בשירות האפליקציה.
 *   BACKUP_URL   — כתובת הבסיס של האפליקציה. ברירת מחדל: הדומיין הקבוע.
 */

const secret = process.env.CRON_SECRET;
const base = (process.env.BACKUP_URL || "https://gemach.shlomo4you.com").replace(/\/+$/, "");

if (!secret) {
  console.error("❌ חסר CRON_SECRET — הגיבוי לא רץ");
  process.exit(1);
}

const started = Date.now();

try {
  const res = await fetch(`${base}/api/backup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (!res.ok) {
    console.error(`❌ הגיבוי נכשל (HTTP ${res.status}):`, json?.error ?? text.slice(0, 300));
    process.exit(1);
  }

  const d = json?.data ?? {};
  const kb = d.size ? ` · ${(d.size / 1024).toFixed(0)} KB` : "";
  const counts = d.counts ?? {};
  console.log(
    `✅ הגיבוי נשלח: ${d.filename ?? "?"}${kb} · ` +
    `חברים ${counts.members ?? "?"} · פעולות ${counts.transactions ?? "?"} · שיקים ${counts.checks ?? "?"} · ` +
    `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  process.exit(0);
} catch (e) {
  console.error("❌ שגיאה בהרצת הגיבוי:", e.message);
  process.exit(1);
}
