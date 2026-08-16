/**
 * חיבור ל-Postgres של Railway.
 * צד שרת בלבד — לעולם לא נטען בדפדפן.
 */
import { Pool, types } from "pg";

/**
 * דרייבר pg מחזיר numeric ו-bigint כמחרוזות (כדי לא לאבד דיוק במספרים
 * ענקיים). התוצאה בקוד הייתה שרשור במקום חיבור: "5000" + "3000" = "50003000",
 * ומכאן גם NaN בכל חישוב שהמשיך משם. הסכומים כאן הם שקלים ב-numeric(14,2),
 * הרחק מגבול הדיוק של Number, ולכן ההמרה בטוחה.
 *
 * הרישום חייב לקרות לפני יצירת ה-pool, ולכן הוא ברמת המודול.
 * 1700 = numeric, 20 = int8/bigint (למשל count()).
 */
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

declare global {
  // eslint-disable-next-line no-var
  var __gemachPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("חסר משתנה הסביבה DATABASE_URL");
  }
  return new Pool({
    connectionString,
    // Railway מגיש את Postgres עם תעודה עצמית — הצפנה כן, אימות תעודה לא.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * ה-pool נוצר בפעם הראשונה שמשתמשים בו, ולא בזמן טעינת המודול.
 * חשוב: `next build` סורק את ה-route handlers וטוען את המודול הזה, וכל
 * שגיאה בטעינה מפילה את הבנייה. בזמן בנייה אין (ולא צריך) DATABASE_URL —
 * הוא נדרש רק בזמן ריצה.
 *
 * ב-dev, Next מרענן מודולים בכל שינוי — שומרים pool אחד גלובלי.
 */
export function getPool(): Pool {
  if (!global.__gemachPool) global.__gemachPool = createPool();
  return global.__gemachPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** מריץ קבוצת פעולות בטרנזקציה אחת. */
export async function transaction<T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
