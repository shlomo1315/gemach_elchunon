/**
 * חישובי כספים — מקור אמת יחיד.
 *
 * הכללים כאן חייבים להיות זהים בכל מסך: כרטיס הניהול, האזור האישי של
 * החבר והמיילים. פיצול של אותו חישוב לשני מקומות כבר גרם לפער אמיתי
 * בסכומים המוצגים לחבר, ולכן כל חישוב כספי מרוכז כאן ולא משוכפל.
 */
import type { Check, CheckKind } from "@/types";

/**
 * סיווג שיק. עמודת kind נוספה בשלב מאוחר, ולכן בשיקים ישנים היא ריקה.
 * שיק כזה נחשב שיק לפרעון הלוואה — כך נהגה המערכת מאז ומעולם, ושינוי
 * ברירת המחדל היה הופך שיקי פרעון לזכות בטעות.
 */
export function checkKind(c: Pick<Check, "kind">): CheckKind {
  return c.kind === "deposit" ? "deposit" : "repayment";
}

/** סכום בטוח: numeric מה-DB, מחרוזת מטופס, null — הכל הופך למספר תקין. */
export function amount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** סכימת סכומים בבטחה (לעולם לא מחזירה NaN). */
export function sumAmounts<T>(items: T[], pick: (item: T) => unknown): number {
  return items.reduce((s, item) => s + amount(pick(item)), 0);
}

/** שיקים להפקדה שטרם נפדו — הסכום שצפוי להיזקף לזכות החבר. */
export function pendingDepositChecks(checks: Check[]): Check[] {
  return checks.filter((c) => checkKind(c) === "deposit" && c.status === "pending");
}

/** שיקים לפרעון הלוואה שטרם נפדו. */
export function pendingRepaymentChecks(checks: Check[]): Check[] {
  return checks.filter((c) => checkKind(c) === "repayment" && c.status === "pending");
}
