#!/usr/bin/env node
/**
 * העברת כל הנתונים מ-Supabase ל-Railway PostgreSQL.
 *
 * הרצה:
 *   SUPABASE_DB_URL="postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres" \
 *   RAILWAY_DB_URL="postgresql://postgres:PASS@xxx.proxy.rlwy.net:PORT/railway" \
 *   node railway/migrate.mjs
 *
 * דגלים:
 *   --dry-run   קורא מסופאבייס ומדפיס מה יעבור, בלי לכתוב כלום ל-Railway
 *   --truncate  מרוקן את הטבלאות ב-Railway לפני ההעברה (הרצה נקייה מחדש)
 *
 * הסקריפט בטוח להרצה חוזרת: משתמש ב-ON CONFLICT DO NOTHING, ומעביר את
 * ה-UUID-ים המקוריים כמו שהם — כך שכל הקשרים בין הטבלאות נשמרים.
 */

import pg from "pg";

const { Client } = pg;

const SRC = process.env.SUPABASE_DB_URL;
const DST = process.env.RAILWAY_DB_URL;
const DRY = process.argv.includes("--dry-run");
const TRUNCATE = process.argv.includes("--truncate");

if (!SRC) fail("חסר משתנה SUPABASE_DB_URL");
if (!DST && !DRY) fail("חסר משתנה RAILWAY_DB_URL");

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/**
 * סדר ההעברה חייב לכבד את מפתחות הזרים:
 * members קודם, אחר כך transactions, ורק אז מה שמצביע עליהם.
 */
const TABLES = [
  {
    name: "members",
    columns: ["id", "airtable_id", "code", "name", "address", "phone", "email", "created_at", "updated_at"],
  },
  {
    name: "transactions",
    columns: ["id", "member_id", "amount", "type", "method", "greg_date", "heb_date", "notes", "category", "created_at"],
  },
  {
    name: "checks",
    columns: ["id", "member_id", "transaction_id", "loan_transaction_id", "kind", "amount", "due_date",
              "hebrew_due", "status", "notes", "created_at", "cashed_at"],
  },
  {
    name: "transaction_change_requests",
    columns: ["id", "member_id", "transaction_id", "kind", "proposed", "status", "member_note",
              "admin_note", "document_url", "created_at", "resolved_at"],
  },
  {
    name: "member_requests",
    columns: ["id", "member_id", "type", "subject", "body", "amount", "status", "admin_note",
              "document_url", "created_at", "resolved_at"],
  },
  {
    name: "deleted_transactions",
    columns: ["id", "original_id", "member_id", "member_name", "amount", "type", "method", "greg_date",
              "heb_date", "notes", "category", "original_created_at", "deleted_at", "deleted_by"],
  },
];

const BATCH = 500;

/** מחזיר רק את העמודות שקיימות בפועל בטבלת המקור. */
async function actualColumns(client, table, wanted) {
  const { rows } = await client.query(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1`,
    [table],
  );
  const present = new Set(rows.map((r) => r.column_name));
  return wanted.filter((c) => present.has(c));
}

async function tableExists(client, table, schema = "public") {
  const { rows } = await client.query(
    `select 1 from information_schema.tables where table_schema = $1 and table_name = $2`,
    [schema, table],
  );
  return rows.length > 0;
}

/** הכנסה בבאצ'ים עם פרמטרים — שומר על טיפוסים ועל תווים עבריים. */
async function insertBatch(dst, table, columns, rows) {
  if (!rows.length) return 0;
  const colList = columns.map((c) => `"${c}"`).join(", ");
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;

    for (const row of slice) {
      const placeholders = columns.map(() => `$${p++}`);
      values.push(`(${placeholders.join(", ")})`);
      for (const c of columns) {
        const v = row[c];
        // jsonb צריך להישלח כמחרוזת JSON
        params.push(v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);
      }
    }

    const sql =
      `insert into "${table}" (${colList}) values ${values.join(", ")} ` +
      `on conflict (id) do nothing`;
    const res = await dst.query(sql, params);
    inserted += res.rowCount;
  }
  return inserted;
}

async function main() {
  console.log("\n🚚 העברת נתונים: Supabase → Railway\n" + "─".repeat(46));

  const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  await src.connect();
  console.log("✅ מחובר ל-Supabase");

  let dst = null;
  if (!DRY) {
    dst = new Client({ connectionString: DST, ssl: { rejectUnauthorized: false } });
    await dst.connect();
    console.log("✅ מחובר ל-Railway");
  } else {
    console.log("🔍 מצב DRY-RUN — לא ייכתב דבר");
  }

  if (TRUNCATE && !DRY) {
    console.log("\n🧹 מרוקן טבלאות קיימות ב-Railway...");
    await dst.query(
      `truncate table deleted_transactions, member_requests, transaction_change_requests,
                     checks, transactions, members, app_users restart identity cascade`,
    );
  }

  const summary = [];

  // ---------- הטבלאות הראשיות ----------
  for (const { name, columns } of TABLES) {
    if (!(await tableExists(src, name))) {
      console.log(`\n⏭️  ${name} — לא קיימת בסופאבייס, מדלג`);
      summary.push({ table: name, source: 0, moved: 0, note: "לא קיימת במקור" });
      continue;
    }

    const cols = await actualColumns(src, name, columns);
    const { rows } = await src.query(`select ${cols.map((c) => `"${c}"`).join(", ")} from "${name}"`);
    console.log(`\n📦 ${name}: ${rows.length} שורות במקור`);

    if (DRY) {
      summary.push({ table: name, source: rows.length, moved: 0, note: "dry-run" });
      continue;
    }

    const moved = await insertBatch(dst, name, cols, rows);
    const { rows: cnt } = await dst.query(`select count(*)::int as n from "${name}"`);
    console.log(`   ✅ הוכנסו ${moved} · סה"כ ב-Railway: ${cnt[0].n}`);
    summary.push({ table: name, source: rows.length, moved, total: cnt[0].n });
  }

  // ---------- משתמשים: auth.users → app_users ----------
  // סופאבייס שומר bcrypt, שהוא פורמט סטנדרטי — הסיסמאות ממשיכות לעבוד.
  if (await tableExists(src, "users", "auth")) {
    const { rows: users } = await src.query(
      `select u.id, u.email, u.encrypted_password, u.created_at,
              m.id as member_id
         from auth.users u
         left join public.members m on lower(m.email) = lower(u.email)
        where u.email is not null and u.encrypted_password is not null`,
    );
    console.log(`\n👤 auth.users: ${users.length} משתמשים במקור`);

    if (!DRY && users.length) {
      const mapped = users.map((u) => ({
        id: u.id,
        email: u.email,
        password_hash: u.encrypted_password,
        // מנהל = משתמש שאינו רשום כחבר (בדיוק כמו is_admin() בסופאבייס)
        role: u.member_id ? "member" : "admin",
        member_id: u.member_id,
        created_at: u.created_at,
      }));
      const moved = await insertBatch(dst, "app_users", ["id", "email", "password_hash", "role", "member_id", "created_at"], mapped);
      console.log(`   ✅ הוכנסו ${moved} משתמשים (הסיסמאות נשמרות — bcrypt תקני)`);
      summary.push({ table: "app_users", source: users.length, moved });
    } else {
      summary.push({ table: "app_users", source: users.length, moved: 0, note: DRY ? "dry-run" : "" });
    }
  } else {
    console.log("\n⏭️  auth.users — אין גישה (נדרש חיבור ישיר, לא pooler)");
  }

  // ---------- אימות ----------
  if (!DRY) {
    console.log("\n" + "─".repeat(46) + "\n🔎 אימות סכומים:");
    const { rows: s } = await src.query(
      `select coalesce(sum(case when type='הפקדה' then amount else -amount end),0)::numeric as bal,
              count(*)::int as n from transactions`,
    );
    const { rows: d } = await dst.query(
      `select coalesce(sum(case when type='הפקדה' then amount else -amount end),0)::numeric as bal,
              count(*)::int as n from transactions`,
    );
    const ok = s[0].n === d[0].n && Number(s[0].bal) === Number(d[0].bal);
    console.log(`   פעולות:  Supabase ${s[0].n}  →  Railway ${d[0].n}`);
    console.log(`   יתרה:    Supabase ${s[0].bal}  →  Railway ${d[0].bal}`);
    console.log(ok ? "   ✅ הנתונים תואמים במדויק" : "   ⚠️  יש פער — בדוק לפני מעבר לייצור");
  }

  console.log("\n" + "─".repeat(46));
  console.table(summary);

  await src.end();
  if (dst) await dst.end();
  console.log("\n🎉 סיום\n");
}

main().catch((e) => {
  console.error("\n❌ שגיאה:", e.message);
  if (e.message.includes("Tenant or user not found") || e.message.includes("password authentication")) {
    console.error("   בדוק את מחרוזת החיבור — צריך את הסיסמה של מסד הנתונים, לא את ה-API key.");
  }
  process.exit(1);
});
