-- ============================================================
-- A3 + A4: טבלאות בקשות חברים
-- בקשות לתיקון פעולה (החבר מציע, המנהל מאשר/דוחה) + פניות/הלוואה/החזר פיקדון
-- מבוסס על is_admin() ומדיניות self הקיימת. להריץ ב-Supabase SQL Editor.
-- ============================================================

-- פונקציית עזר: ה-id של החבר המחובר (לפי המייל ב-JWT)
create or replace function current_member_id() returns uuid
language sql stable security definer as $$
  select id from members where lower(email) = lower(auth.jwt()->>'email') limit 1;
$$;

-- ------------------------------------------------------------
-- A3: בקשות לתיקון/הוספה/מחיקה של פעולה
-- ------------------------------------------------------------
create table if not exists transaction_change_requests (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references members(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  kind           text not null default 'edit' check (kind in ('edit','add','delete')),
  proposed       jsonb,                 -- {amount,type,method,greg_date,heb_date,notes}
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  member_note    text,
  admin_note     text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
-- מסמך תיעוד מצורף (נתיב בקובץ ב-Storage)
alter table transaction_change_requests add column if not exists document_url text;

create index if not exists tcr_member_idx on transaction_change_requests(member_id);
create index if not exists tcr_status_idx on transaction_change_requests(status);

alter table transaction_change_requests enable row level security;

drop policy if exists tcr_admin_all on transaction_change_requests;
create policy tcr_admin_all on transaction_change_requests for all
  using (is_admin()) with check (is_admin());

drop policy if exists tcr_member_select on transaction_change_requests;
create policy tcr_member_select on transaction_change_requests for select
  using (member_id = current_member_id());

drop policy if exists tcr_member_insert on transaction_change_requests;
create policy tcr_member_insert on transaction_change_requests for insert
  with check (member_id = current_member_id() and status = 'pending');

-- ------------------------------------------------------------
-- A4: פניות / בקשת הלוואה / בקשת החזר פיקדון
-- ------------------------------------------------------------
create table if not exists member_requests (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  type         text not null check (type in ('message','loan','deposit_refund')),
  subject      text,
  body         text,
  amount       numeric,
  status       text not null default 'open' check (status in ('open','in_progress','done','rejected')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists mr_member_idx on member_requests(member_id);
create index if not exists mr_status_idx on member_requests(status);

alter table member_requests enable row level security;

drop policy if exists mr_admin_all on member_requests;
create policy mr_admin_all on member_requests for all
  using (is_admin()) with check (is_admin());

drop policy if exists mr_member_select on member_requests;
create policy mr_member_select on member_requests for select
  using (member_id = current_member_id());

drop policy if exists mr_member_insert on member_requests;
create policy mr_member_insert on member_requests for insert
  with check (member_id = current_member_id() and status = 'open');

-- ------------------------------------------------------------
-- Storage: מסמכי תיעוד שחברים מצרפים לבקשות (bucket פרטי)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('member-docs', 'member-docs', false)
on conflict (id) do nothing;

-- חבר מחובר יכול להעלות מסמך
drop policy if exists "member_docs_upload" on storage.objects;
create policy "member_docs_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-docs');

-- קריאה: בעל הקובץ או מנהל בלבד
drop policy if exists "member_docs_read" on storage.objects;
create policy "member_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'member-docs' and (owner = auth.uid() or is_admin()));
