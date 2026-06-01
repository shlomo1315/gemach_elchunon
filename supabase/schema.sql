-- =====================================================================
--  גמ"ח אייזנבלט — סכמת בסיס נתונים (Supabase / PostgreSQL)
--  הרץ קובץ זה ב-SQL Editor של Supabase, ואחריו את seed.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- חברים ----------
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  airtable_id text unique,                 -- מזהה מקורי מ-Airtable (לקישור הייבוא)
  code        text,                        -- קוד אישי (4 ספרות אחרונות של הטלפון)
  name        text not null default '',    -- שם ומשפחה
  address     text default '',
  phone       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists members_name_idx on members (name);
create index if not exists members_code_idx on members (code);

-- ---------- פעולות (הפקדות / משיכות) ----------
create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members (id) on delete cascade,
  amount      numeric(14,2) not null default 0,     -- סכום חיובי
  type        text not null check (type in ('הפקדה','משיכה')),
  method      text check (method in ('העברה בנקאית','צ''יקים','מזומן','העברה לצד ג')),
  greg_date   date,                                  -- תאריך לועזי (אופציונלי)
  heb_date    text,                                  -- תאריך עברי (טקסט חופשי)
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_member_idx on transactions (member_id);
create index if not exists transactions_type_idx   on transactions (type);
create index if not exists transactions_created_idx on transactions (created_at);

-- סכום חתום: משיכה => שלילי, הפקדה => חיובי
create or replace function signed_amount(p_amount numeric, p_type text)
returns numeric language sql immutable as $$
  select case when p_type = 'משיכה' then -p_amount else p_amount end;
$$;

-- ---------- מבט: יתרת כל חבר ----------
create or replace view member_balances as
select
  m.*,
  coalesce(sum(signed_amount(t.amount, t.type)), 0) as balance,
  count(t.id)                                        as txn_count
from members m
left join transactions t on t.member_id = m.id
group by m.id;

-- ---------- מבט: סיכום כללי ----------
create or replace view fund_summary as
select
  (select count(*) from members)                                          as members_count,
  (select count(*) from transactions)                                     as txn_count,
  coalesce((select sum(amount) from transactions where type='הפקדה'),0)   as total_deposits,
  coalesce((select sum(amount) from transactions where type='משיכה'),0)   as total_withdrawals,
  coalesce((select sum(signed_amount(amount,type)) from transactions),0)  as total_balance;

-- עדכון אוטומטי של updated_at
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists members_touch on members;
create trigger members_touch before update on members
  for each row execute function touch_updated_at();

-- ---------- הרשאות גישה ----------
-- מערכת פנימית: אנו מאפשרים גישה מלאה למפתח ה-anon.
-- ⚠️ לפני חשיפה ציבורית מומלץ להוסיף הזדהות (Auth) ולהגביל מדיניות זו.
alter table members      enable row level security;
alter table transactions enable row level security;

drop policy if exists members_all on members;
create policy members_all on members for all using (true) with check (true);

drop policy if exists transactions_all on transactions;
create policy transactions_all on transactions for all using (true) with check (true);

-- הרשאות ל-API (anon / authenticated)
grant usage on schema public to anon, authenticated;
grant all on members, transactions to anon, authenticated;
grant select on member_balances, fund_summary to anon, authenticated;
