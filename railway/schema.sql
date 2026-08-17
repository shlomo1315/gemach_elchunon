-- =====================================================================
--  גמ"ח — סכמת בסיס נתונים ל-Railway PostgreSQL
--  ---------------------------------------------------------------
--  איחוד של כל קבצי ה-SQL שהורצו בסופאבייס, לקובץ אחד שניתן להריץ
--  על מסד Postgres רגיל ב-Railway.
--
--  הבדלים מהותיים מול הגרסה של סופאבייס:
--   1. אין RLS — סופאבייס אכף הרשאות דרך auth.jwt() שלא קיים ב-Postgres
--      רגיל. ההרשאות נאכפות בשכבת האפליקציה (API routes).
--   2. אין grants ל-anon/authenticated — התפקידים האלה שייכים לסופאבייס.
--   3. הוספנו app_users שמחליף את auth.users של סופאבייס.
--   4. אין storage.buckets — קבצים מטופלים מחוץ למסד.
--
--  בטוח להרצה חוזרת (idempotent).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- חברים ----------
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  code        text,
  name        text not null default '',
  address     text default '',
  phone       text default '',
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists members_name_idx  on members (name);
create index if not exists members_code_idx  on members (code);
create index if not exists members_email_idx on members (lower(email));

-- ---------- פעולות (הפקדות / משיכות) ----------
create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members (id) on delete cascade,
  amount      numeric(14,2) not null default 0,
  type        text not null check (type in ('הפקדה','משיכה')),
  method      text check (method in ('העברה בנקאית','צ''יקים','מזומן','העברה לצד ג')),
  greg_date   date,
  heb_date    text,
  notes       text,
  category    text,   -- loan | repayment | deposit | refund
  created_at  timestamptz not null default now()
);

create index if not exists transactions_member_idx  on transactions (member_id);
create index if not exists transactions_type_idx    on transactions (type);
create index if not exists transactions_created_idx on transactions (created_at);

-- ---------- שיקים דחויים ----------
create table if not exists checks (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references members(id) on delete cascade,
  transaction_id      uuid references transactions(id) on delete set null,
  loan_transaction_id uuid references transactions(id) on delete set null,
  kind                text not null default 'repayment',  -- repayment | deposit
  amount              numeric not null,
  due_date            date,
  hebrew_due          text,
  status              text not null default 'pending' check (status in ('pending','cashed','bounced')),
  notes               text,
  created_at          timestamptz not null default now(),
  cashed_at           timestamptz
);

create index if not exists checks_member_idx     on checks(member_id);
create index if not exists checks_status_due_idx on checks(status, due_date);
create index if not exists checks_loan_idx       on checks(loan_transaction_id);

-- ---------- בקשות לתיקון/הוספה/מחיקה של פעולה ----------
create table if not exists transaction_change_requests (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references members(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  kind           text not null default 'edit' check (kind in ('edit','add','delete')),
  proposed       jsonb,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  member_note    text,
  admin_note     text,
  document_url   text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create index if not exists tcr_member_idx on transaction_change_requests(member_id);
create index if not exists tcr_status_idx on transaction_change_requests(status);

-- ---------- פניות / בקשת הלוואה / החזר פיקדון ----------
create table if not exists member_requests (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  type         text not null check (type in ('message','loan','deposit_refund')),
  subject      text,
  body         text,
  amount       numeric,
  status       text not null default 'open' check (status in ('open','in_progress','done','rejected')),
  admin_note   text,
  document_url text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists mr_member_idx on member_requests(member_id);
create index if not exists mr_status_idx on member_requests(status);

-- ---------- ארכיון פעולות שנמחקו ----------
create table if not exists deleted_transactions (
  id                  uuid primary key default gen_random_uuid(),
  original_id         uuid not null,
  member_id           uuid,
  member_name         text,
  amount              numeric,
  type                text,
  method              text,
  greg_date           text,
  heb_date            text,
  notes               text,
  category            text,
  original_created_at timestamptz,
  deleted_at          timestamptz not null default now(),
  deleted_by          text
);

-- ---------- משתמשים (מחליף את auth.users של סופאבייס) ----------
-- סופאבייס שומר סיסמאות כ-bcrypt, שהוא פורמט סטנדרטי — ולכן ההאשים
-- מועברים כמו שהם והמשתמשים ממשיכים להתחבר עם אותה סיסמה בדיוק.
create table if not exists app_users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  password_hash   text not null,
  full_name       text,
  role            text not null default 'member' check (role in ('admin','member')),
  member_id       uuid references members(id) on delete cascade,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists app_users_email_idx  on app_users (lower(email));
create index if not exists app_users_member_idx on app_users (member_id);

-- ---------- מסמכים (מחליף את Storage bucket "member-docs") ----------
-- הקבצים קטנים ומעטים (מסמכים שחברים מצרפים לבקשות), ולכן נשמרים
-- במסד עצמו — כך אין תלות בשירות אחסון חיצוני והגיבוי הוא אחד.
-- ה-path נשמר בפורמט המקורי "<member_id>/<filename>" כדי שהערכים
-- הקיימים ב-document_url ימשיכו להצביע נכון.
create table if not exists documents (
  path         text primary key,
  member_id    uuid references members(id) on delete cascade,
  content_type text,
  size_bytes   integer,
  data         bytea not null,
  created_at   timestamptz not null default now()
);

create index if not exists documents_member_idx on documents (member_id);

-- ---------- פונקציות עזר ----------
-- סכום חתום: משיכה => שלילי, הפקדה => חיובי
create or replace function signed_amount(p_amount numeric, p_type text)
returns numeric language sql immutable as $$
  select case when p_type = 'משיכה' then -p_amount else p_amount end;
$$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists members_touch on members;
create trigger members_touch before update on members
  for each row execute function touch_updated_at();

drop trigger if exists app_users_touch on app_users;
create trigger app_users_touch before update on app_users
  for each row execute function touch_updated_at();

-- ---------- מבט: יתרת כל חבר ----------
-- כולל את הגרסה העדכנית ביותר (loan-savings-tracking.sql):
-- יתרה כוללת + חוב הלוואות + יתרת חיסכון.
drop view if exists member_balances;
create view member_balances as
select
  m.*,
  coalesce(sum(signed_amount(t.amount, t.type)), 0) as balance,
  count(t.id)                                        as txn_count,
  -- חוב הלוואות: הלוואות (משיכה שאינה החזר פיקדון) פחות פרעונות
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

-- ---------- מבט: סיכום כללי ----------
create or replace view fund_summary as
select
  (select count(*) from members)                                          as members_count,
  (select count(*) from transactions)                                     as txn_count,
  coalesce((select sum(amount) from transactions where type='הפקדה'),0)   as total_deposits,
  coalesce((select sum(amount) from transactions where type='משיכה'),0)   as total_withdrawals,
  coalesce((select sum(signed_amount(amount,type)) from transactions),0)  as total_balance;

-- ---------- מערכת מיילים: יומן והגדרות ----------
-- ההרשאות נאכפות בשרת (lib/authz.ts), ולכן אין כאן RLS.
create table if not exists email_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  event          text,                     -- קוד האירוע ("transaction.created", "manual.sent"...)
  recipient_type text not null check (recipient_type in ('admin','member')),
  recipient      text not null,            -- כתובת המייל של הנמען
  member_id      uuid references members (id) on delete set null,
  member_name    text,
  subject        text not null,
  html           text not null,            -- התוכן המלא — מאפשר "שלח שוב" מדויק
  status         text not null check (status in ('sent','failed')),
  error          text                      -- הודעת השגיאה אם נכשל
);

create index if not exists email_log_created_idx on email_log (created_at desc);
create index if not exists email_log_status_idx  on email_log (status);
create index if not exists email_log_member_idx  on email_log (member_id, created_at desc);

-- הגדרות שליחה — שורה יחידה
create table if not exists email_settings (
  id              boolean primary key default true check (id),
  send_to_admin   boolean not null default true,
  send_to_member  boolean not null default true,
  ev_transactions boolean not null default true,  -- הפקדות/משיכות
  ev_members      boolean not null default true,  -- חבר חדש/עריכה/מחיקה
  ev_checks       boolean not null default true,  -- שיקים
  ev_requests     boolean not null default true,  -- בקשות
  ev_import       boolean not null default true,  -- ייבוא
  updated_at      timestamptz not null default now()
);

insert into email_settings (id) values (true) on conflict do nothing;

-- ---------- הגדרות גיבוי ----------
-- שורה יחידה, כמו email_settings. backup_email ריק => נשלח ל-ADMIN_EMAIL.
create table if not exists backup_settings (
  id            boolean primary key default true check (id),
  enabled       boolean not null default true,
  backup_email  text,
  last_sent_at  timestamptz,          -- מתי נשלח הגיבוי האחרון בפועל
  last_status   text,                 -- sent | failed
  last_error    text,
  updated_at    timestamptz not null default now()
);

insert into backup_settings (id) values (true) on conflict do nothing;

-- ---------- שחזור סיסמה: קודים זמניים ----------
-- הקוד עצמו לעולם לא נשמר כטקסט — רק hash שלו (bcrypt), בדיוק כמו סיסמה.
-- כך דליפה של המסד לא מאפשרת התחברות. הקוד תקף 15 דקות ולשימוש חד-פעמי.
create table if not exists password_resets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app_users(id) on delete cascade,
  code_hash  text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  attempts   int not null default 0,   -- הגנה מפני ניחוש הקוד בכוח
  created_at timestamptz not null default now()
);

create index if not exists password_resets_user_idx on password_resets (user_id, created_at desc);
create index if not exists password_resets_exp_idx  on password_resets (expires_at);
