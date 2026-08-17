/**
 * הגדרות הגיבוי היומי.
 *
 * הגיבוי אינו מתוזמן על ידי שירות חיצוני אלא נבדק בכל כניסה למערכת:
 * אם עבר יממה מאז הגיבוי האחרון, הוא נשלח ברקע. כך אין תלות בהגדרה
 * ב-Railway, אבל חשוב להבין את המשמעות — גיבוי נוצר רק בימים שבהם
 * מישהו נכנס למערכת. בגלל זה נשמר last_sent_at, ומוצגת התראה כשנוצר
 * פער של יותר מיממה.
 */
import { queryOne, query } from "@/lib/db";
import { ADMIN_EMAIL } from "@/lib/mailer";

export type BackupSettings = {
  enabled: boolean;
  backup_email: string | null;
  last_sent_at: string | null;
  last_status: string | null;
  last_error: string | null;
};

const DEFAULTS: BackupSettings = {
  enabled: true,
  backup_email: null,
  last_sent_at: null,
  last_status: null,
  last_error: null,
};

export async function getBackupSettings(): Promise<BackupSettings> {
  try {
    const row = await queryOne<BackupSettings>(`select * from backup_settings limit 1`);
    return row ? { ...DEFAULTS, ...row } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** לאן נשלח הגיבוי: הכתובת שהוגדרה במערכת, ואם אין — מייל המנהל. */
export function backupRecipient(s: BackupSettings): string {
  return (s.backup_email ?? "").trim() || ADMIN_EMAIL;
}

/** כמה זמן חייב לעבור בין גיבויים. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** האם הגיע הזמן לשלוח גיבוי חדש. */
export function isBackupDue(s: BackupSettings, now = Date.now()): boolean {
  if (!s.enabled) return false;
  if (!s.last_sent_at) return true;
  const last = new Date(s.last_sent_at).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= DAY_MS;
}

/** כמה ימים עברו מאז הגיבוי האחרון (null אם מעולם לא נשלח). */
export function daysSinceBackup(s: BackupSettings, now = Date.now()): number | null {
  if (!s.last_sent_at) return null;
  const last = new Date(s.last_sent_at).getTime();
  if (Number.isNaN(last)) return null;
  return Math.floor((now - last) / DAY_MS);
}

export async function recordBackupResult(
  status: "sent" | "failed",
  error: string | null,
): Promise<void> {
  try {
    await query(
      `update backup_settings
          set last_sent_at = case when $1 = 'sent' then now() else last_sent_at end,
              last_status = $1,
              last_error = $2,
              updated_at = now()
        where id = true`,
      [status, error],
    );
  } catch {
    /* כשל ברישום לא מפיל את הגיבוי עצמו */
  }
}

export async function saveBackupSettings(
  patch: { enabled?: boolean; backup_email?: string | null },
): Promise<void> {
  await query(
    `insert into backup_settings (id, enabled, backup_email, updated_at)
     values (true, coalesce($1, true), $2, now())
     on conflict (id) do update
       set enabled = coalesce($1, backup_settings.enabled),
           backup_email = $2,
           updated_at = now()`,
    [patch.enabled ?? null, (patch.backup_email ?? "").trim() || null],
  );
}
