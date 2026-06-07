-- ============================================================
-- שיוך שיק להלוואה (משיכה) מסוימת
-- ------------------------------------------------------------
-- מוסיף עמודה loan_transaction_id לטבלת checks, המצביעה על
-- פעולת המשיכה (ההלוואה) שאליה קבוצת השיקים משויכת.
-- בטוח להרצה חוזרת. להריץ ב-Supabase SQL Editor.
-- ============================================================

alter table checks
  add column if not exists loan_transaction_id uuid references transactions(id) on delete set null;

create index if not exists checks_loan_idx on checks(loan_transaction_id);
