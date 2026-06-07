-- ============================================================
-- מעקב הלוואות נפרד מיתרת חיסכון
-- ------------------------------------------------------------
-- 1) transactions.category — סיווג הפעולה:
--      'loan'      = הלוואה (משיכה)         → מגדיל חוב
--      'repayment' = פרעון הלוואה (הפקדה)   → מקטין חוב (לא חיסכון)
--      'deposit'   = פיקדון / חיסכון (הפקדה)→ מגדיל חיסכון
--      'refund'    = החזר פיקדון (משיכה)    → מקטין חיסכון
--    פעולות ישנות (category ריק): משיכה נחשבת הלוואה, הפקדה נחשבת פיקדון.
-- 2) checks.kind — האם קבוצת השיקים היא פרעון הלוואה או פיקדון.
-- 3) רענון ה-view: יתרת חיסכון (savings_balance) וחוב הלוואות (loan_balance)
--    בנוסף ליתרה הכוללת (balance). היתרה הכוללת לא משתנה.
-- בטוח להרצה חוזרת. להריץ ב-Supabase SQL Editor.
-- ============================================================

alter table transactions add column if not exists category text;
alter table checks add column if not exists kind text not null default 'repayment';

drop view if exists member_balances;
create view member_balances as
select
  m.*,
  coalesce(sum(signed_amount(t.amount, t.type)), 0) as balance,
  count(t.id)                                        as txn_count,
  -- חוב הלוואות: הלוואות (משיכה שאינה החזר פיקדון) פחות פרעונות (הפקדה שסומנה כפרעון)
  coalesce(sum(case
    when t.type = 'משיכה' and coalesce(t.category, 'loan') <> 'refund' then t.amount
    when t.type = 'הפקדה' and t.category = 'repayment'                  then -t.amount
    else 0 end), 0) as loan_balance,
  -- יתרת חיסכון: הפקדות חיסכון פחות החזרי פיקדון
  coalesce(sum(case
    when t.type = 'הפקדה' and coalesce(t.category, 'deposit') <> 'repayment' then t.amount
    when t.type = 'משיכה' and t.category = 'refund'                          then -t.amount
    else 0 end), 0) as savings_balance
from members m
left join transactions t on t.member_id = m.id
group by m.id;
