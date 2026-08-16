#!/usr/bin/env node
/**
 * בדיקת שלמות של כל היתרות במערכת — כסף של אנשים, לאגורה.
 *
 * לכל חבר מושווית היתרה שהמערכת מציגה מול סכימה עצמאית של התנועות,
 * ומאומת שסיווג השיקים זהה בכל המסכים. כל פער מדווח.
 *
 * קריאה בלבד — הסקריפט לא כותב דבר למסד.
 * הרצה: node railway/audit-balances.mjs
 */
import pg from "pg";

const { types, Client } = pg;
// אותה המרה כמו ב-lib/db.ts, אחרת הסכימות כאן ישרשרו מחרוזות
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ חסר DATABASE_URL");
  process.exit(1);
}

// הסיווג חייב להיות זהה ל-checkKind ב-lib/money.ts
const checkKind = (c) => (c.kind === "deposit" ? "deposit" : "repayment");
const ils = (n) =>
  Number(n || 0).toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });

const client = new Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

const problems = [];
const AGORA = 0.005; // סף השוואה — חצי אגורה

try {
  await client.connect();

  const { rows: members } = await client.query(
    `select id, name, code, balance, loan_balance, savings_balance, txn_count
       from member_balances order by name`,
  );
  const { rows: txns } = await client.query(
    `select member_id, amount, type, category from transactions`,
  );
  const { rows: checks } = await client.query(
    `select member_id, amount, kind, status from checks`,
  );

  console.log(`נבדקים ${members.length} חברים · ${txns.length} תנועות · ${checks.length} שיקים\n`);

  // --- שפיות טיפוסים: אחרי setTypeParser הכל חייב להיות מספר ---
  const badType = [...txns, ...checks].find((r) => typeof r.amount !== "number");
  if (badType) {
    problems.push(`טיפוס שגוי: amount הוא ${typeof badType.amount} ולא number`);
  }
  const nanRow = [...txns, ...checks].find((r) => Number.isNaN(r.amount));
  if (nanRow) problems.push("נמצא amount שהוא NaN");

  const byMember = (rows) => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.member_id)) m.set(r.member_id, []);
      m.get(r.member_id).push(r);
    }
    return m;
  };
  const txnsOf = byMember(txns);
  const checksOf = byMember(checks);

  let checked = 0;
  for (const m of members) {
    const mt = txnsOf.get(m.id) ?? [];
    const mc = checksOf.get(m.id) ?? [];

    // 1) היתרה מהמבט מול סכימה עצמאית
    const dep = mt.filter((t) => t.type === "הפקדה").reduce((s, t) => s + t.amount, 0);
    const wit = mt.filter((t) => t.type === "משיכה").reduce((s, t) => s + t.amount, 0);
    const expected = dep - wit;
    if (Math.abs(expected - m.balance) > AGORA) {
      problems.push(
        `${m.name} (${m.code ?? "—"}): יתרה במבט ${ils(m.balance)} ≠ הפקדות ${ils(dep)} − משיכות ${ils(wit)} = ${ils(expected)}`,
      );
    }

    // 2) מספר התנועות
    if (m.txn_count !== mt.length) {
      problems.push(`${m.name}: txn_count=${m.txn_count} אך נמצאו ${mt.length} תנועות`);
    }

    // 3) חיסכון פחות חוב חייב להשתוות ליתרה
    const sav = Number(m.savings_balance ?? 0);
    const loan = Number(m.loan_balance ?? 0);
    if (Math.abs(sav - loan - m.balance) > AGORA) {
      problems.push(
        `${m.name}: חיסכון ${ils(sav)} − חוב ${ils(loan)} = ${ils(sav - loan)} ≠ יתרה ${ils(m.balance)}`,
      );
    }

    // 4) סיווג השיקים — הבאג שהתגלה אצל מרדכי
    const pendDeposit = mc.filter((c) => checkKind(c) === "deposit" && c.status === "pending");
    const pendSum = pendDeposit.reduce((s, c) => s + c.amount, 0);
    // הסינון השגוי שהיה בפורטל, לשם השוואה
    const buggy = mc.filter((c) => c.kind !== "repayment" && c.status === "pending");
    const buggySum = buggy.reduce((s, c) => s + c.amount, 0);
    if (Math.abs(buggySum - pendSum) > AGORA) {
      problems.push(
        `${m.name}: סיווג שיקים — הנכון ${ils(pendSum)} (${pendDeposit.length}) מול השגוי ${ils(buggySum)} (${buggy.length}); שיקים ללא kind`,
      );
    }

    // 5) שיק בסכום לא חוקי
    for (const c of mc) {
      if (!Number.isFinite(c.amount) || c.amount <= 0) {
        problems.push(`${m.name}: שיק בסכום לא תקין (${c.amount})`);
      }
    }

    checked++;
    // הדפסת פירוט לחברים עם שיקים ממתינים
    if (pendDeposit.length > 0) {
      console.log(
        `  ${m.name.padEnd(22)} יתרה ${ils(m.balance).padStart(14)} + צפוי ${ils(pendSum).padStart(13)} (${pendDeposit.length} שיקים) = ${ils(m.balance + pendSum)}`,
      );
    }
  }

  console.log(`\nנבדקו ${checked} חברים.`);
  if (problems.length) {
    console.log(`\n❌ נמצאו ${problems.length} בעיות:\n`);
    problems.forEach((p) => console.log("  • " + p));
    process.exitCode = 1;
  } else {
    console.log("\n✅ כל היתרות תואמות לאגורה, וסיווג השיקים אחיד.");
  }
} catch (e) {
  console.error("❌ שגיאה:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
