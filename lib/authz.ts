/**
 * שכבת ההרשאות — מחליפה את ה-RLS של סופאבייס.
 *
 * בסופאבייס, המדיניות (`using (is_admin())` וכו') נאכפה בתוך המסד לפי
 * ה-JWT. ב-Postgres רגיל אין auth.jwt(), ולכן אותם כללים בדיוק נאכפים
 * כאן — לפני שנבנית שאילתה כלשהי.
 *
 * עיקרון: הדפדפן לעולם לא מכתיב SQL. הוא שולח תיאור מובנה, וכאן
 * מאמתים אותו מול רשימת היתר של טבלאות ועמודות, ומצמידים בכפייה
 * את סינון החבר לפי ה-session.
 */
import type { SessionUser } from "./session";

export type Action = "select" | "insert" | "update" | "delete";

type TableRule = {
  columns: readonly string[];
  /** עמודה שמקשרת את השורה לחבר — בסיס לסינון של חבר מחובר */
  memberKey: string | null;
  /** אילו פעולות מותרות לחבר רגיל (מנהל תמיד רשאי להכל) */
  memberActions: readonly Action[];
  /** ערכי ברירת מחדל שנכפים על שורה שחבר מוסיף */
  memberInsertForce?: Record<string, string>;
  readOnly?: boolean;
};

const MEMBER_COLS = [
  "id", "airtable_id", "code", "name", "address", "phone", "email", "created_at", "updated_at",
] as const;

const BALANCE_COLS = [
  ...MEMBER_COLS, "balance", "txn_count", "loan_balance", "savings_balance",
] as const;

const TXN_COLS = [
  "id", "member_id", "amount", "type", "method", "greg_date", "heb_date", "notes", "category", "created_at",
] as const;

export const TABLES: Record<string, TableRule> = {
  members: {
    columns: MEMBER_COLS,
    memberKey: "id",
    memberActions: ["select"],
  },
  member_balances: {
    columns: BALANCE_COLS,
    memberKey: "id",
    memberActions: ["select"],
    readOnly: true,
  },
  transactions: {
    columns: TXN_COLS,
    memberKey: "member_id",
    memberActions: ["select"],
  },
  fund_summary: {
    columns: ["members_count", "txn_count", "total_deposits", "total_withdrawals", "total_balance"],
    memberKey: null,          // אין עמודת חבר → חבר לא ניגש בכלל
    memberActions: [],
    readOnly: true,
  },
  checks: {
    columns: [
      "id", "member_id", "transaction_id", "loan_transaction_id", "kind", "amount", "due_date",
      "hebrew_due", "status", "notes", "created_at", "cashed_at",
    ],
    memberKey: "member_id",
    memberActions: ["select"],
  },
  transaction_change_requests: {
    columns: [
      "id", "member_id", "transaction_id", "kind", "proposed", "status", "member_note",
      "admin_note", "document_url", "created_at", "resolved_at",
    ],
    memberKey: "member_id",
    memberActions: ["select", "insert"],
    memberInsertForce: { status: "pending" },
  },
  member_requests: {
    columns: [
      "id", "member_id", "type", "subject", "body", "amount", "status", "admin_note",
      "document_url", "created_at", "resolved_at",
    ],
    memberKey: "member_id",
    memberActions: ["select", "insert"],
    memberInsertForce: { status: "open" },
  },
  deleted_transactions: {
    columns: [
      "id", "original_id", "member_id", "member_name", "amount", "type", "method", "greg_date",
      "heb_date", "notes", "category", "original_created_at", "deleted_at", "deleted_by",
    ],
    memberKey: null,          // ארכיון — מנהל בלבד
    memberActions: [],
  },
  email_log: {
    columns: [
      "id", "created_at", "event", "recipient_type", "recipient", "member_id",
      "member_name", "subject", "html", "status", "error",
    ],
    // יומן המיילים נקרא מדף הניהול בלבד. הכתיבה נעשית בשרת (lib/mailer.ts)
    // ולא עוברת דרך /api/db, ולכן אין כאן הרשאת insert לאיש.
    memberKey: null,          // מנהל בלבד — היומן חושף תוכן של כל החברים
    memberActions: [],
  },
  email_settings: {
    columns: [
      "id", "send_to_admin", "send_to_member", "ev_transactions", "ev_members",
      "ev_checks", "ev_requests", "ev_import", "updated_at",
    ],
    memberKey: null,          // הגדרות מערכת — מנהל בלבד
    memberActions: [],
  },
};

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function getTable(name: string): TableRule {
  const rule = TABLES[name];
  if (!rule) throw new AuthzError(`טבלה לא מורשית: ${name}`, 400);
  return rule;
}

/** מוודא ששם עמודה מוכר — חוסם כל ניסיון הזרקה דרך שמות עמודות. */
export function assertColumn(rule: TableRule, table: string, col: string): string {
  if (!rule.columns.includes(col)) {
    throw new AuthzError(`עמודה לא מורשית: ${table}.${col}`, 400);
  }
  return col;
}

/**
 * בודק שהפעולה מותרת, ומחזיר סינון כפוי שיש לצרף לשאילתה.
 * עבור חבר מחובר זהו התחליף המדויק ל-`using (member_id = current_member_id())`.
 */
export function authorize(
  user: SessionUser | null,
  table: string,
  action: Action,
): { rule: TableRule; forcedFilter: { column: string; value: string } | null } {
  if (!user) throw new AuthzError("לא מחובר", 401);

  const rule = getTable(table);

  if (rule.readOnly && action !== "select") {
    throw new AuthzError(`${table} הוא מבט לקריאה בלבד`, 400);
  }

  // מנהל — גישה מלאה, בדיוק כמו `using (is_admin())`
  if (user.role === "admin") return { rule, forcedFilter: null };

  // חבר — רק מה שהוגדר, ורק על השורות שלו
  if (!rule.memberActions.includes(action)) {
    throw new AuthzError(`אין הרשאה לבצע ${action} על ${table}`, 403);
  }
  if (!rule.memberKey || !user.member_id) {
    throw new AuthzError(`אין הרשאה לגשת ל-${table}`, 403);
  }

  return { rule, forcedFilter: { column: rule.memberKey, value: user.member_id } };
}
