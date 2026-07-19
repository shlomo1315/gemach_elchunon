-- =====================================================================
--  מערכת מיילים — יומן והגדרות. הרץ קובץ זה ב-SQL Editor של Supabase.
-- =====================================================================

-- ---------- יומן מיילים ----------
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

-- ---------- הגדרות שליחה (שורה יחידה) ----------
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

-- ---------- הרשאות — באותו דפוס של שאר הטבלאות ----------
alter table email_log      enable row level security;
alter table email_settings enable row level security;

drop policy if exists email_log_all on email_log;
create policy email_log_all on email_log for all using (true) with check (true);

drop policy if exists email_settings_all on email_settings;
create policy email_settings_all on email_settings for all using (true) with check (true);

grant all on email_log, email_settings to anon, authenticated;
