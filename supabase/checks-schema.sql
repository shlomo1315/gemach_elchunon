-- ============================================================
-- A5: מעקב שיקים (שיקים דחויים) + תזכורות + הורדת חוב לפי פירעון
-- להריץ ב-Supabase SQL Editor (אחרי requests-schema.sql, או עצמאית).
-- ============================================================

-- עזר: id של החבר המחובר (אם לא קיים כבר מ-requests-schema.sql)
create or replace function current_member_id() returns uuid
language sql stable security definer as $$
  select id from members where lower(email) = lower(auth.jwt()->>'email') limit 1;
$$;

create table if not exists checks (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references members(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null, -- ההפקדה שנוצרה בעת הפדיון
  amount         numeric not null,
  due_date       date,
  hebrew_due     text,
  status         text not null default 'pending' check (status in ('pending','cashed','bounced')),
  notes          text,
  created_at     timestamptz not null default now(),
  cashed_at      timestamptz
);
create index if not exists checks_member_idx on checks(member_id);
create index if not exists checks_status_due_idx on checks(status, due_date);

alter table checks enable row level security;

drop policy if exists checks_admin_all on checks;
create policy checks_admin_all on checks for all
  using (is_admin()) with check (is_admin());

-- חבר רשאי לראות את השיקים של עצמו (צפייה בלבד)
drop policy if exists checks_member_select on checks;
create policy checks_member_select on checks for select
  using (member_id = current_member_id());
