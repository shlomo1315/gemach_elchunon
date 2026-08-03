#!/usr/bin/env node
/**
 * יצירת משתמש מנהל ב-Railway.
 *
 * שימושי כאשר לא הועברו משתמשים מסופאבייס (למשל אם ההעברה נעשתה דרך
 * ה-pooler, שאין דרכו גישה ל-auth.users), או כדי לפתוח חשבון מנהל נוסף.
 *
 * הרצה:
 *   RAILWAY_DB_URL="postgresql://..." node railway/create-admin.mjs <email> <password>
 *
 * שים לב: מנהל מזוהה לפי כך שהמייל שלו אינו רשום בטבלת members —
 * בדיוק כמו בסופאבייס. לכן אין להשתמש במייל של חבר קיים.
 */

import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.RAILWAY_DB_URL || process.env.DATABASE_URL;
const [email, password] = process.argv.slice(2);

if (!url) {
  console.error("❌ חסר RAILWAY_DB_URL");
  process.exit(1);
}
if (!email || !password || password.length < 6) {
  console.error("❌ שימוש: node railway/create-admin.mjs <email> <password>  (סיסמה: 6 תווים לפחות)");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
});
await client.connect();

const lower = email.toLowerCase().trim();

// מנהל = מייל שאינו שייך לחבר. אחרת הוא ייכנס כחבר ולא כמנהל.
const member = await client.query(`select id, name from members where lower(email) = $1`, [lower]);
if (member.rows.length) {
  console.error(`❌ המייל ${lower} משויך לחבר "${member.rows[0].name}" — הוא ייכנס כחבר, לא כמנהל.`);
  console.error("   בחר מייל אחר, או הסר את המייל משורת החבר.");
  await client.end();
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const res = await client.query(
  `insert into app_users (email, password_hash, role)
   values ($1, $2, 'admin')
   on conflict (email) do update set password_hash = excluded.password_hash, role = 'admin'
   returning id, (xmax = 0) as created`,
  [lower, hash],
);

const { id, created } = res.rows[0];
console.log(`✅ ${created ? "נוצר" : "עודכן"} מנהל: ${lower}  (id: ${id})`);

await client.end();
