#!/usr/bin/env node
/**
 * אימות לוגיקת החישובים הכספיים — ללא צורך במסד.
 * משחזר את המקרה של מרדכי פריזנד ובודק מקרי קצה.
 *
 * הרצה: node railway/verify-money-logic.mjs
 */

// --- העתק מדויק של lib/money.ts ---
const checkKind = (c) => (c.kind === "deposit" ? "deposit" : "repayment");
const amount = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sumAmounts = (items, pick) => items.reduce((s, i) => s + amount(pick(i)), 0);
const pendingDepositChecks = (checks) =>
  checks.filter((c) => checkKind(c) === "deposit" && c.status === "pending");

const ils = (n) => Number(n || 0).toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = Math.abs(Number(got) - Number(want)) < 0.005 || got === want;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: ${got}${ok ? "" : `  (ציפייה: ${want})`}`);
  ok ? pass++ : fail++;
}

console.log("=== המקרה של מרדכי פריזנד ===\n");

const txns = [
  { type: "הפקדה", amount: 7000 }, { type: "הפקדה", amount: 25000 },
  { type: "הפקדה", amount: 7000 }, { type: "הפקדה", amount: 4000 },
  { type: "משיכה", amount: 25000 },
  { type: "הפקדה", amount: 2750 }, { type: "הפקדה", amount: 2750 },
  { type: "הפקדה", amount: 5600 },
];
const dep = sumAmounts(txns.filter(t => t.type === "הפקדה"), t => t.amount);
const wit = sumAmounts(txns.filter(t => t.type === "משיכה"), t => t.amount);
check("סך הפקדות", dep, 54100);
check("סך משיכות", wit, 25000);
check("יתרה נוכחית", dep - wit, 29100);

// 12 שיקים להפקדה: 2 נפדו, 10 ממתינים
const checks = [];
for (let i = 0; i < 12; i++) {
  checks.push({ kind: "deposit", amount: 2750, status: i < 2 ? "cashed" : "pending" });
}
const pend = pendingDepositChecks(checks);
const pendSum = sumAmounts(pend, c => c.amount);
check("שיקים ממתינים", pend.length, 10);
check("צפוי להיזקף", pendSum, 27500);
check("יתרה צפויה", (dep - wit) + pendSum, 56600);

console.log("\n=== הבאג: שיקים ישנים ללא kind ===\n");

// תרחיש מעורב: שיקי הפקדה + שיקי פרעון ישנים ללא kind
const mixed = [
  { kind: "deposit",   amount: 2750, status: "pending" },
  { kind: "deposit",   amount: 2750, status: "pending" },
  { kind: null,        amount: 5000, status: "pending" },  // ישן = פרעון
  { kind: undefined,   amount: 2500, status: "pending" },  // ישן = פרעון
  { kind: "repayment", amount: 3000, status: "pending" },
];
const correct = sumAmounts(pendingDepositChecks(mixed), c => c.amount);
const buggy = sumAmounts(mixed.filter(c => c.kind !== "repayment" && c.status === "pending"), c => c.amount);
check("חישוב נכון (רק deposit)", correct, 5500);
check("החישוב השגוי הקודם", buggy, 13000);
console.log(`      הפער שהיה נוצר: ${ils(buggy - correct)}`);

console.log("\n=== מקרי קצה ===\n");
check("מחרוזת מה-DB", amount("2750.50"), 2750.5);
check("null", amount(null), 0);
check("undefined", amount(undefined), 0);
check("מחרוזת ריקה", amount(""), 0);
check("טקסט לא מספרי", amount("abc"), 0);
check("NaN", amount(NaN), 0);
check("סכימה עם ערכים פגומים", sumAmounts([{a:"100"},{a:null},{a:"50.25"},{a:"x"}], r => r.a), 150.25);
check("kind ריק = פרעון", checkKind({ kind: "" }), "repayment");
check("kind null = פרעון", checkKind({ kind: null }), "repayment");
check("kind deposit = הפקדה", checkKind({ kind: "deposit" }), "deposit");

console.log("\n=== דיוק לאגורה ===\n");
const cents = [{ a: "0.10" }, { a: "0.20" }, { a: "0.30" }];
const sum = sumAmounts(cents, r => r.a);
check("0.10 + 0.20 + 0.30", sum.toFixed(2), "0.60");
const agorot = Array.from({ length: 100 }, () => ({ a: "0.01" }));
check("100 × 0.01", sumAmounts(agorot, r => r.a).toFixed(2), "1.00");

console.log(`\n--- ${pass} עברו, ${fail} נכשלו ---`);
process.exit(fail ? 1 : 0);
