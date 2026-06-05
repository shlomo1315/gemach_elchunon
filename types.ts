export type Member = {
  id: string;
  airtable_id: string | null;
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberBalance = Member & {
  balance: number;
  txn_count: number;
};

export type TxnType = "הפקדה" | "משיכה";
export type TxnMethod = "העברה בנקאית" | "צ'יקים" | "מזומן" | "העברה לצד ג";

export type Transaction = {
  id: string;
  member_id: string;
  amount: number;
  type: TxnType;
  method: TxnMethod | null;
  greg_date: string | null;
  heb_date: string | null;
  notes: string | null;
  created_at: string;
};

export type FundSummary = {
  members_count: number;
  txn_count: number;
  total_deposits: number;
  total_withdrawals: number;
  total_balance: number;
};

// A3: בקשת תיקון פעולה
export type TxnProposed = {
  amount?: number;
  type?: TxnType;
  method?: TxnMethod | null;
  greg_date?: string | null;
  heb_date?: string | null;
  notes?: string | null;
};

export type ChangeRequest = {
  id: string;
  member_id: string;
  transaction_id: string | null;
  kind: "edit" | "add" | "delete";
  proposed: TxnProposed | null;
  status: "pending" | "approved" | "rejected";
  member_note: string | null;
  admin_note: string | null;
  document_url: string | null;
  created_at: string;
  resolved_at: string | null;
  members?: { name: string } | null;
};

// A5: שיק דחוי
export type Check = {
  id: string;
  member_id: string;
  transaction_id: string | null;
  amount: number;
  due_date: string | null;
  hebrew_due: string | null;
  status: "pending" | "cashed" | "bounced";
  notes: string | null;
  created_at: string;
  cashed_at: string | null;
  members?: { name: string } | null;
};

// A4: פנייה / בקשת הלוואה / החזר פיקדון
export type MemberRequestType = "message" | "loan" | "deposit_refund";

export type MemberRequest = {
  id: string;
  member_id: string;
  type: MemberRequestType;
  subject: string | null;
  body: string | null;
  amount: number | null;
  status: "open" | "in_progress" | "done" | "rejected";
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  members?: { name: string } | null;
};
