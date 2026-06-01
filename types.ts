export type Member = {
  id: string;
  airtable_id: string | null;
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
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
