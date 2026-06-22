-- =====================================================================
--  חיזוק אבטחה — גמ"ח (Supabase / PostgreSQL)
--  ---------------------------------------------------------------------
--  מתקן פרצות אבטחה קריטיות:
--   1) הטבלאות members / transactions היו פתוחות לחלוטין למפתח anon
--      (קריאה + כתיבה + מחיקה לכל אדם באינטרנט). כאן מהדקים ל:
--        • מנהל  → גישה מלאה
--        • חבר   → קריאה של הנתונים שלו בלבד
--        • anon  → אין גישה כלל
--   2) is_admin() הגדיר כל משתמש מחובר שאינו "חבר" כמנהל — כך שכל מי
--      שנרשם עם מייל שרירותי הפך למנהל. כאן עוברים לרשימת היתר (admins).
--   3) deleted_transactions היה פתוח לכל משתמש מחובר — מהדקים למנהל בלבד.
--   4) member_balances / fund_summary (views) עקפו RLS — מפעילים
--      security_invoker כדי שיכבדו את מדיניות ההרשאות של הטבלאות.
--   5) Storage: חבר יכול היה להעלות לכל נתיב — מגבילים לתיקייה שלו בלבד.
--
--  בטוח להרצה חוזרת (idempotent). להריץ ב-Supabase SQL Editor אחרי
--  schema.sql, requests-schema.sql, checks-schema.sql,
--  deleted-transactions-schema.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) רשימת היתר של מנהלים (allowlist)
-- ---------------------------------------------------------------------
create table if not exists admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

-- זריעה אוטומטית: כל המשתמשים המחוברים הקיימים שאינם רשומים כחברים
-- נחשבים כמנהלים הנוכחיים — כך לא ננעל בחוץ אף מנהל קיים בעת המעבר.
insert into admins (email)
  select lower(u.email)
  from auth.users u
  where u.email is not null
    and not exists (
      select 1 from members m where lower(m.email) = lower(u.email)
    )
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- 1) פונקציות עזר
-- ---------------------------------------------------------------------

-- מנהל = מייל ה-JWT מופיע ברשימת ההיתר admins (ולא "כל מי שאינו חבר").
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins
    where lower(email) = lower(auth.jwt()->>'email')
  );
$$;

-- ה-id של החבר המחובר (לפי המייל ב-JWT).
create or replace function current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members
  where lower(email) = lower(auth.jwt()->>'email')
  limit 1;
$$;

grant execute on function is_admin()         to authenticated;
grant execute on function current_member_id() to authenticated;

-- מדיניות לטבלת admins: מנהל בלבד רשאי לראות/לנהל.
drop policy if exists admins_admin_all on admins;
create policy admins_admin_all on admins for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- 2) members — מנהל: הכל ; חבר: קריאת השורה שלו בלבד ; anon: כלום
-- ---------------------------------------------------------------------
alter table members enable row level security;

drop policy if exists members_all          on members;  -- מדיניות "using(true)" הישנה
drop policy if exists members_admin_all     on members;
drop policy if exists members_self_select    on members;

create policy members_admin_all on members for all
  using (is_admin()) with check (is_admin());

create policy members_self_select on members for select
  using (id = current_member_id());

-- ---------------------------------------------------------------------
-- 3) transactions — מנהל: הכל ; חבר: קריאת הפעולות שלו בלבד
-- ---------------------------------------------------------------------
alter table transactions enable row level security;

drop policy if exists transactions_all         on transactions;  -- "using(true)" הישנה
drop policy if exists transactions_admin_all    on transactions;
drop policy if exists transactions_self_select   on transactions;

create policy transactions_admin_all on transactions for all
  using (is_admin()) with check (is_admin());

create policy transactions_self_select on transactions for select
  using (member_id = current_member_id());

-- ---------------------------------------------------------------------
-- 4) deleted_transactions — מנהל בלבד (היה פתוח לכל משתמש מחובר)
-- ---------------------------------------------------------------------
alter table deleted_transactions enable row level security;

drop policy if exists "Authenticated users full access" on deleted_transactions;
drop policy if exists deleted_admin_all                  on deleted_transactions;

create policy deleted_admin_all on deleted_transactions for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- 5) Views — שיכבדו RLS (security_invoker). חבר יראה רק את שלו.
-- ---------------------------------------------------------------------
drop view if exists member_balances;
create view member_balances
  with (security_invoker = on) as
select
  m.*,
  coalesce(sum(signed_amount(t.amount, t.type)), 0) as balance,
  count(t.id)                                        as txn_count,
  coalesce(sum(case
    when t.type = 'משיכה' and coalesce(t.category, 'loan') <> 'refund' then t.amount
    when t.type = 'הפקדה' and t.category = 'repayment'                  then -t.amount
    else 0 end), 0) as loan_balance,
  coalesce(sum(case
    when t.type = 'הפקדה' and coalesce(t.category, 'deposit') <> 'repayment' then t.amount
    when t.type = 'משיכה' and t.category = 'refund'                          then -t.amount
    else 0 end), 0) as savings_balance
from members m
left join transactions t on t.member_id = m.id
group by m.id;

drop view if exists fund_summary;
create view fund_summary
  with (security_invoker = on) as
select
  (select count(*) from members)                                          as members_count,
  (select count(*) from transactions)                                     as txn_count,
  coalesce((select sum(amount) from transactions where type='הפקדה'),0)   as total_deposits,
  coalesce((select sum(amount) from transactions where type='משיכה'),0)   as total_withdrawals,
  coalesce((select sum(signed_amount(amount,type)) from transactions),0)  as total_balance;

-- ---------------------------------------------------------------------
-- 6) Storage — חבר יכול להעלות אך ורק לתיקייה שלו (member-docs/<member_id>/...)
-- ---------------------------------------------------------------------
drop policy if exists "member_docs_upload" on storage.objects;
create policy "member_docs_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'member-docs'
    and (
      (storage.foldername(name))[1] = current_member_id()::text
      or is_admin()
    )
  );

-- קריאה: בעל הקובץ או מנהל בלבד (ללא שינוי — מוודאים שקיים)
drop policy if exists "member_docs_read" on storage.objects;
create policy "member_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'member-docs' and (owner = auth.uid() or is_admin()));

-- ---------------------------------------------------------------------
-- 7) הרשאות API — שלילת גישה ממפתח anon, מתן גישה ל-authenticated בלבד
--    (RLS ממילא מסנן; זו שכבת הגנה נוספת לפי עקרון ההרשאה המינימלית)
-- ---------------------------------------------------------------------
revoke all on members, transactions from anon;
revoke all on deleted_transactions, admins from anon;
revoke all on member_balances, fund_summary from anon;

grant select, insert, update, delete on members, transactions to authenticated;
grant select, insert, update, delete on deleted_transactions to authenticated;
grant select, insert, update, delete on admins to authenticated;
grant select on member_balances, fund_summary to authenticated;

-- =====================================================================
--  לאחר ההרצה — בדיקת שפיות:
--    select * from admins;                 -- ודא שהמייל שלך מופיע כאן!
--    -- אם חסר:  insert into admins(email) values ('you@example.com');
-- =====================================================================
