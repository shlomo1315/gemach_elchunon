#!/usr/bin/env node
/**
 * הרצת הסכמה על המסד לפני עליית האפליקציה.
 *
 * schema.sql בטוח להרצה חוזרת (הכל create ... if not exists / or replace),
 * ולכן אפשר להריץ אותו בכל דיפלוי — בפעם הראשונה הוא יוצר את המבנה,
 * ובכל פעם אחריו הוא לא משנה דבר.
 *
 * הרצה: node railway/setup.mjs
 */

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("❌ חסר DATABASE_URL — מדלג על הרצת הסכמה");
  process.exit(1);
}

const sql = await readFile(join(here, "schema.sql"), "utf8");
const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);

  const { rows } = await client.query(
    `select
       (select count(*) from members)      as members,
       (select count(*) from transactions) as txns,
       (select count(*) from app_users)    as users`,
  );
  const r = rows[0];
  console.log(`✅ הסכמה עודכנה · חברים: ${r.members} · פעולות: ${r.txns} · משתמשים: ${r.users}`);

  if (Number(r.users) === 0) {
    console.warn("⚠️  אין משתמשים במערכת — אי אפשר להתחבר.");
    console.warn("   הרץ: node railway/create-admin.mjs <email> <password>");
  }
} catch (e) {
  console.error("❌ שגיאה בהרצת הסכמה:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
