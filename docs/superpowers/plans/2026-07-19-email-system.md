# ׳׳¢׳¨׳›׳× ׳׳™׳™׳׳™׳ (Gmail + ׳™׳•׳׳ + ׳©׳׳™׳—׳” ׳™׳–׳•׳׳” + ׳”׳’׳“׳¨׳•׳×) ג€” ׳×׳•׳›׳ ׳™׳× ׳™׳™׳©׳•׳

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ׳”׳—׳׳₪׳× ׳©׳׳™׳—׳× ׳”׳׳™׳™׳׳™׳ ׳-Resend ׳-Gmail SMTP, ׳‘׳×׳•׳¡׳₪׳× ׳™׳•׳׳ ׳׳™׳™׳׳™׳, ׳“׳£ ׳ ׳™׳”׳•׳ "׳׳™׳™׳׳™׳" (׳™׳•׳׳ / ׳©׳׳™׳—׳” ׳™׳–׳•׳׳” / ׳”׳’׳“׳¨׳•׳×) ג€” ׳׳₪׳™ ׳”׳׳₪׳¨׳˜ `docs/superpowers/specs/2026-07-19-email-system-design.md`.

**Architecture:** Next.js 15 (App Router) + Supabase. ׳׳•׳“׳•׳ ׳©׳¨׳× ׳׳©׳•׳×׳£ `lib/mailer.ts` (nodemailer) ׳׳©׳¨׳× ׳©׳׳•׳©׳” API routes: `/api/notify` (׳§׳™׳™׳, ׳׳©׳•׳›׳×׳‘), `/api/send-email` (׳—׳“׳©), `/api/resend-email` (׳—׳“׳©). ׳›׳ ׳©׳׳™׳—׳” ׳ ׳¨׳©׳׳× ׳‘׳˜׳‘׳׳× `email_log`; ׳”׳’׳“׳¨׳•׳× ׳‘׳˜׳‘׳׳× `email_settings` (׳©׳•׳¨׳” ׳™׳—׳™׳“׳”). ׳“׳£ ׳׳§׳•׳— ׳—׳“׳© `/emails` ׳¢׳ ׳©׳׳•׳© ׳׳©׳•׳ ׳™׳•׳×.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase JS v2, nodemailer, Tailwind (׳”׳₪׳¨׳•׳™׳§׳˜ ׳׳©׳×׳׳© ׳‘׳¢׳™׳§׳¨ ׳‘-inline styles ג€” ׳׳”׳׳©׳™׳ ׳‘׳“׳₪׳•׳¡ ׳”׳–׳”).

## Global Constraints

- **׳׳™׳ ׳×׳©׳×׳™׳× ׳‘׳“׳™׳§׳•׳× ׳׳•׳˜׳•׳׳˜׳™׳•׳× ׳‘׳₪׳¨׳•׳™׳§׳˜** (׳׳™׳ jest/vitest). ׳׳™׳׳•׳× = `npm run build` (׳—׳™׳™׳‘ ׳׳¢׳‘׳•׳¨ ׳ ׳§׳™) + ׳‘׳“׳™׳§׳•׳× ׳™׳“׳ ׳™׳•׳× ׳׳₪׳•׳¨׳˜׳•׳× ׳‘׳¡׳•׳£.
- ׳›׳ ׳˜׳§׳¡׳˜ ׳‘׳׳׳©׳§ ג€” ׳¢׳‘׳¨׳™׳×. ׳§׳•׳“ ׳•׳׳–׳”׳™׳ ג€” ׳׳ ׳’׳׳™׳×.
- ׳”׳•׳“׳¢׳•׳× commit ׳‘׳¢׳‘׳¨׳™׳×, ׳‘׳“׳₪׳•׳¡ ׳”׳§׳™׳™׳ ׳‘׳”׳™׳¡׳˜׳•׳¨׳™׳”, ׳¢׳ ׳©׳•׳¨׳× `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- ׳׳™׳ ׳׳©׳ ׳•׳× ׳׳£ ׳׳—׳× ׳-28 ׳ ׳§׳•׳“׳•׳× ׳”׳§׳¨׳™׳׳” ׳”׳§׳™׳™׳׳•׳× ׳-`notify()` ג€” ׳”׳§׳˜׳’׳•׳¨׳™׳” ׳ ׳’׳–׳¨׳× ׳‘׳©׳¨׳× ׳׳”׳×׳—׳™׳׳™׳× ׳©׳ `event` (`transaction.` / `member.` / `check.` / `request.` / `import.`).
- ׳›׳©׳ ׳׳™׳™׳ ׳׳¢׳•׳׳ ׳׳ ׳׳₪׳™׳ ׳₪׳¢׳•׳׳” ׳‘׳’׳"׳—: routes ׳׳—׳–׳™׳¨׳™׳ 200 ׳¢׳ ׳₪׳™׳¨׳•׳˜, ׳©׳’׳™׳׳•׳× ׳ ׳¨׳©׳׳•׳× ׳‘׳™׳•׳׳.
- ׳׳©׳×׳ ׳™ ׳¡׳‘׳™׳‘׳” ׳—׳“׳©׳™׳: `GMAIL_USER`, `GMAIL_APP_PASSWORD`; `ADMIN_EMAIL` ׳ ׳©׳׳¨ (׳‘׳¨׳™׳¨׳× ׳׳—׳“׳: `GMAIL_USER`). `RESEND_API_KEY`/`EMAIL_FROM` ׳׳•׳¡׳¨׳™׳.

---

### Task 1: ׳¡׳›׳™׳׳× ׳ ׳×׳•׳ ׳™׳ ג€” `email_log` + `email_settings`

**Files:**
- Create: `supabase/email-schema.sql`

**Interfaces:**
- Produces: ׳˜׳‘׳׳× `email_log` (׳¢׳׳•׳“׳•׳×: `id, created_at, event, recipient_type, recipient, member_id, member_name, subject, html, status, error`) ׳•׳˜׳‘׳׳× `email_settings` (׳©׳•׳¨׳” ׳™׳—׳™׳“׳”, ׳¢׳׳•׳“׳•׳×: `id, send_to_admin, send_to_member, ev_transactions, ev_members, ev_checks, ev_requests, ev_import, updated_at`). ׳›׳ ׳”׳׳©׳™׳׳•׳× ׳”׳‘׳׳•׳× ׳×׳׳•׳™׳•׳× ׳‘׳©׳׳•׳× ׳”׳׳׳” ׳‘׳“׳™׳•׳§.

- [ ] **Step 1: ׳›׳×׳™׳‘׳× ׳§׳•׳‘׳¥ ׳”׳¡׳›׳™׳׳”**

```sql
-- =====================================================================
--  ׳׳¢׳¨׳›׳× ׳׳™׳™׳׳™׳ ג€” ׳™׳•׳׳ ׳•׳”׳’׳“׳¨׳•׳×. ׳”׳¨׳¥ ׳§׳•׳‘׳¥ ׳–׳” ׳‘-SQL Editor ׳©׳ Supabase.
-- =====================================================================

-- ---------- ׳™׳•׳׳ ׳׳™׳™׳׳™׳ ----------
create table if not exists email_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  event          text,                     -- ׳§׳•׳“ ׳”׳׳™׳¨׳•׳¢ ("transaction.created", "manual.sent"...)
  recipient_type text not null check (recipient_type in ('admin','member')),
  recipient      text not null,            -- ׳›׳×׳•׳‘׳× ׳”׳׳™׳™׳ ׳©׳ ׳”׳ ׳׳¢׳
  member_id      uuid references members (id) on delete set null,
  member_name    text,
  subject        text not null,
  html           text not null,            -- ׳”׳×׳•׳›׳ ׳”׳׳׳ ג€” ׳׳׳₪׳©׳¨ "׳©׳׳— ׳©׳•׳‘" ׳׳“׳•׳™׳§
  status         text not null check (status in ('sent','failed')),
  error          text                      -- ׳”׳•׳“׳¢׳× ׳”׳©׳’׳™׳׳” ׳׳ ׳ ׳›׳©׳
);

create index if not exists email_log_created_idx on email_log (created_at desc);
create index if not exists email_log_status_idx  on email_log (status);

-- ---------- ׳”׳’׳“׳¨׳•׳× ׳©׳׳™׳—׳” (׳©׳•׳¨׳” ׳™׳—׳™׳“׳”) ----------
create table if not exists email_settings (
  id              boolean primary key default true check (id),
  send_to_admin   boolean not null default true,
  send_to_member  boolean not null default true,
  ev_transactions boolean not null default true,  -- ׳”׳₪׳§׳“׳•׳×/׳׳©׳™׳›׳•׳×
  ev_members      boolean not null default true,  -- ׳—׳‘׳¨ ׳—׳“׳©/׳¢׳¨׳™׳›׳”/׳׳—׳™׳§׳”
  ev_checks       boolean not null default true,  -- ׳©׳™׳§׳™׳
  ev_requests     boolean not null default true,  -- ׳‘׳§׳©׳•׳×
  ev_import       boolean not null default true,  -- ׳™׳™׳‘׳•׳
  updated_at      timestamptz not null default now()
);

insert into email_settings (id) values (true) on conflict do nothing;

-- ---------- ׳”׳¨׳©׳׳•׳× ג€” ׳‘׳׳•׳×׳• ׳“׳₪׳•׳¡ ׳©׳ ׳©׳׳¨ ׳”׳˜׳‘׳׳׳•׳× ----------
alter table email_log      enable row level security;
alter table email_settings enable row level security;

drop policy if exists email_log_all on email_log;
create policy email_log_all on email_log for all using (true) with check (true);

drop policy if exists email_settings_all on email_settings;
create policy email_settings_all on email_settings for all using (true) with check (true);

grant all on email_log, email_settings to anon, authenticated;
```

- [ ] **Step 2: ׳׳™׳׳•׳× ׳×׳—׳‘׳™׳¨ ׳‘׳¡׳™׳¡׳™**

׳׳™׳ PostgreSQL ׳׳§׳•׳׳™; ׳׳•׳•׳“׳ ׳™׳“׳ ׳™׳×: ׳©׳׳•׳× ׳¢׳׳•׳“׳•׳× ׳×׳•׳׳׳™׳ ׳-Interfaces ׳׳׳¢׳׳”, ׳›׳ `create` ׳¢׳ `if not exists`, ׳׳“׳™׳ ׳™׳•׳× RLS ׳–׳”׳” ׳׳“׳₪׳•׳¡ ׳‘-`supabase/schema.sql:78-85`.

- [ ] **Step 3: Commit**

```powershell
git add supabase/email-schema.sql
git commit -m @'
׳¡׳›׳™׳׳× ׳׳™׳™׳׳™׳: ׳˜׳‘׳׳׳•׳× email_log ׳•-email_settings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

> **׳”׳¢׳¨׳” ׳׳׳‘׳¦׳¢:** ׳׳× ׳”׳§׳•׳‘׳¥ ׳”׳–׳” ׳”׳׳©׳×׳׳© ׳™׳¨׳™׳¥ ׳™׳“׳ ׳™׳× ׳‘-SQL Editor ׳©׳ Supabase (׳©׳׳‘ "׳”׳₪׳¢׳׳”" ׳‘׳¡׳•׳£). ׳׳™׳ ׳“׳¨׳ ׳׳”׳¨׳™׳¥ ׳׳•׳×׳• ׳׳”׳¡׳‘׳™׳‘׳” ׳”׳׳§׳•׳׳™׳×.

---

### Task 2: ׳׳•׳“׳•׳ ׳©׳׳™׳—׳” ׳׳©׳•׳×׳£ ג€” `lib/mailer.ts`

**Files:**
- Modify: `package.json` (׳”׳×׳§׳ ׳× nodemailer)
- Create: `lib/mailer.ts`

**Interfaces:**
- Consumes: ׳˜׳‘׳׳׳•׳× `email_log`, `email_settings` ׳-Task 1.
- Produces (׳׳©׳™׳׳•׳© ׳”-routes ׳‘׳׳©׳™׳׳•׳× 4ג€“6):
  - `mailConfigured(): boolean`
  - `ADMIN_EMAIL: string` (׳§׳‘׳•׳¢ ׳׳™׳•׳¦׳)
  - `sendMail(to: string, subject: string, html: string): Promise<void>` ג€” ׳–׳•׳¨׳§ Error ׳‘׳›׳©׳
  - `type EmailSettings = { send_to_admin: boolean; send_to_member: boolean; ev_transactions: boolean; ev_members: boolean; ev_checks: boolean; ev_requests: boolean; ev_import: boolean }`
  - `getEmailSettings(db: SupabaseClient): Promise<EmailSettings>` ג€” ׳‘׳¨׳™׳¨׳× ׳׳—׳“׳ ׳”׳›׳ true ׳׳ ׳׳™׳ ׳©׳•׳¨׳”
  - `categoryEnabled(s: EmailSettings, event?: string | null): boolean`
  - `sendAndLog(db: SupabaseClient, args: { to: string; subject: string; html: string; event?: string | null; recipient_type: "admin" | "member"; member_id?: string | null; member_name?: string | null }): Promise<boolean>` ג€” ׳©׳•׳׳—, ׳¨׳•׳©׳ ׳‘׳™׳•׳׳ (׳’׳ ׳›׳©׳), ׳׳—׳–׳™׳¨ ׳”׳׳ ׳”׳¦׳׳™׳—

- [ ] **Step 1: ׳”׳×׳§׳ ׳× nodemailer**

Run: `npm install nodemailer @types/nodemailer`
Expected: ׳ ׳•׳¡׳£ ׳-dependencies/devDependencies ׳‘-package.json ׳‘׳׳™ ׳©׳’׳™׳׳•׳×.

- [ ] **Step 2: ׳›׳×׳™׳‘׳× `lib/mailer.ts`**

```ts
// ׳׳•׳“׳•׳ ׳©׳¨׳× ׳‘׳׳‘׳“: ׳©׳׳™׳—׳× ׳׳™׳™׳׳™׳ ׳“׳¨׳ Gmail SMTP + ׳¨׳™׳©׳•׳ ׳‘׳™׳•׳׳ email_log.
// ׳׳©׳׳© ׳׳× /api/notify, /api/send-email, /api/resend-email.

import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || GMAIL_USER || "";
const EMAIL_FROM = `"׳’׳׳´׳— ׳–׳›׳¨׳•׳ ׳׳”׳¨׳" <${GMAIL_USER}>`;

export function mailConfigured(): boolean {
  return !!(GMAIL_USER && GMAIL_APP_PASSWORD);
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!mailConfigured()) throw new Error("not_configured");
  await getTransporter().sendMail({ from: EMAIL_FROM, to, subject, html });
}

export type EmailSettings = {
  send_to_admin: boolean;
  send_to_member: boolean;
  ev_transactions: boolean;
  ev_members: boolean;
  ev_checks: boolean;
  ev_requests: boolean;
  ev_import: boolean;
};

const DEFAULT_SETTINGS: EmailSettings = {
  send_to_admin: true, send_to_member: true,
  ev_transactions: true, ev_members: true, ev_checks: true,
  ev_requests: true, ev_import: true,
};

export async function getEmailSettings(db: SupabaseClient): Promise<EmailSettings> {
  try {
    const { data } = await db.from("email_settings").select("*").maybeSingle();
    return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ׳’׳•׳–׳¨ ׳׳× ׳”׳§׳˜׳’׳•׳¨׳™׳” ׳׳”׳×׳—׳™׳׳™׳× ׳©׳ ׳§׳•׳“ ׳”׳׳™׳¨׳•׳¢ ("transaction.created" ג†’ transactions)
export function categoryEnabled(s: EmailSettings, event?: string | null): boolean {
  switch ((event || "").split(".")[0]) {
    case "transaction": return s.ev_transactions;
    case "member":      return s.ev_members;
    case "check":       return s.ev_checks;
    case "request":     return s.ev_requests;
    case "import":      return s.ev_import;
    default:            return true; // ׳׳™׳¨׳•׳¢ ׳׳ ׳׳•׳›׳¨ ג€” ׳©׳•׳׳—׳™׳ (׳‘׳¨׳™׳¨׳× ׳׳—׳“׳ ׳₪׳×׳•׳—׳”)
  }
}

export async function sendAndLog(
  db: SupabaseClient,
  args: {
    to: string; subject: string; html: string;
    event?: string | null;
    recipient_type: "admin" | "member";
    member_id?: string | null; member_name?: string | null;
  }
): Promise<boolean> {
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  try {
    await sendMail(args.to, args.subject, args.html);
  } catch (e) {
    status = "failed";
    error = (e as Error).message;
  }
  try {
    await db.from("email_log").insert({
      event: args.event ?? null,
      recipient_type: args.recipient_type,
      recipient: args.to,
      member_id: args.member_id ?? null,
      member_name: args.member_name ?? null,
      subject: args.subject,
      html: args.html,
      status, error,
    });
  } catch {
    /* ׳›׳©׳ ׳‘׳¨׳™׳©׳•׳ ׳”׳™׳•׳׳ ׳׳ ׳׳₪׳™׳ ׳׳× ׳”׳–׳¨׳™׳׳” */
  }
  return status === "sent";
}
```

- [ ] **Step 3: ׳׳™׳׳•׳× build**

Run: `npm run build`
Expected: build ׳¢׳•׳‘׳¨ ׳‘׳׳™ ׳©׳’׳™׳׳•׳× TypeScript.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json lib/mailer.ts
git commit -m @'
׳׳•׳“׳•׳ ׳©׳׳™׳—׳× ׳׳™׳™׳׳™׳ ׳“׳¨׳ Gmail SMTP ׳¢׳ ׳¨׳™׳©׳•׳ ׳‘׳™׳•׳׳

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 3: ׳©׳›׳×׳•׳‘ `/api/notify` ג€” Gmail + ׳”׳’׳“׳¨׳•׳× + ׳™׳•׳׳

**Files:**
- Modify: `app/api/notify/route.ts` (׳©׳›׳×׳•׳‘ ׳׳׳)

**Interfaces:**
- Consumes: ׳›׳ ׳”׳₪׳•׳ ׳§׳¦׳™׳•׳× ׳-`lib/mailer.ts` (Task 2), `buildEmail` ׳-`lib/emailTemplate.ts` (׳§׳™׳™׳).
- Produces: ׳׳•׳×׳• ׳—׳•׳–׳” ׳—׳™׳¦׳•׳ ׳™ ׳›׳׳₪׳™ `lib/notify.ts` ג€” POST ׳¢׳ `NotifyBody`, ׳׳—׳–׳™׳¨ `{ ok, results }` ׳׳• `{ ok, skipped }`. ׳׳™׳ ׳©׳™׳ ׳•׳™ ׳‘׳¦׳“ ׳”׳׳§׳•׳—.

- [ ] **Step 1: ׳©׳›׳×׳•׳‘ ׳”׳§׳•׳‘׳¥**

```ts
import { createClient } from "@supabase/supabase-js";
import { buildEmail, type EmailRow } from "@/lib/emailTemplate";
import { ADMIN_EMAIL, categoryEnabled, getEmailSettings, sendAndLog } from "@/lib/mailer";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type NotifyBody = {
  event?: string;
  heading: string;
  intro?: string;
  accent?: "green" | "red" | "gold" | "blue";
  amount?: string;
  rows?: EmailRow[];
  memberId?: string | null;
  memberName?: string | null;
  toMember?: boolean; // ׳‘׳¨׳™׳¨׳× ׳׳—׳“׳: true (׳׳ ׳™׳© memberId ׳•׳™׳© ׳׳• ׳׳™׳™׳)
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return json({ ok: true, skipped: "not_configured" });
  }

  // ׳׳™׳׳•׳×: ׳¨׳§ ׳׳©׳×׳׳© ׳׳—׳•׳‘׳¨ ׳™׳›׳•׳ ׳׳”׳₪׳¢׳™׳ ׳©׳׳™׳—׳” (׳׳•׳ ׳¢ ׳ ׳™׳¦׳•׳ ׳׳¨׳¢׳”)
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "no_auth" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ ok: false, error: "invalid_auth" }, 401);
  }

  if (!body?.heading) return json({ ok: false, error: "missing_heading" }, 400);

  // ׳”׳’׳“׳¨׳•׳× ׳©׳׳™׳—׳”: ׳§׳˜׳’׳•׳¨׳™׳” ׳›׳‘׳•׳™׳” => ׳׳ ׳©׳•׳׳—׳™׳ ׳•׳׳ ׳¨׳•׳©׳׳™׳
  const settings = await getEmailSettings(supabase);
  if (!categoryEnabled(settings, body.event)) {
    return json({ ok: true, skipped: "category_disabled" });
  }

  const rows: EmailRow[] = Array.isArray(body.rows) ? body.rows : [];

  // ׳©׳׳™׳₪׳× ׳₪׳¨׳˜׳™ ׳”׳—׳‘׳¨ (׳©׳ + ׳׳™׳™׳) ׳׳₪׳™ memberId, ׳׳ ׳§׳™׳™׳
  let memberEmail: string | null = null;
  let memberName: string | null = body.memberName ?? null;
  if (body.memberId) {
    const { data: m } = await supabase
      .from("members")
      .select("name,email")
      .eq("id", body.memberId)
      .maybeSingle();
    if (m) {
      memberName = m.name ?? memberName;
      memberEmail = (m.email ?? "").trim() || null;
    }
  }

  const subjectBase = `׳’׳"׳— ׳–׳›׳¨׳•׳ ׳׳”׳¨׳ ג€” ${body.heading}`;
  const results: Record<string, string> = {};

  // === ׳׳™׳™׳ ׳׳׳ ׳”׳ ===
  if (settings.send_to_admin && ADMIN_EMAIL) {
    const adminHtml = buildEmail({
      heading: body.heading,
      intro: memberName ? `׳₪׳¢׳•׳׳” ׳ ׳¨׳©׳׳” ׳‘׳›׳¨׳˜׳™׳¡ ׳”׳—׳‘׳¨: ${memberName}` : "׳₪׳¢׳•׳׳” ׳ ׳¨׳©׳׳” ׳‘׳׳¢׳¨׳›׳×.",
      amount: body.amount,
      accent: body.accent,
      rows,
      footnote: "׳׳™׳™׳ ׳–׳” ׳ ׳©׳׳— ׳׳׳™׳ ׳›׳׳ ׳”׳ ׳”׳׳¢׳¨׳›׳× ׳‘׳¢׳§׳‘׳•׳× ׳₪׳¢׳•׳׳” ׳©׳‘׳•׳¦׳¢׳”.",
    });
    const ok = await sendAndLog(supabase, {
      to: ADMIN_EMAIL, subject: `[׳ ׳™׳”׳•׳] ${subjectBase}`, html: adminHtml,
      event: body.event, recipient_type: "admin",
      member_id: body.memberId, member_name: memberName,
    });
    results.admin = ok ? "sent" : "failed";
  } else {
    results.admin = "skipped";
  }

  // === ׳׳™׳™׳ ׳׳—׳‘׳¨ (׳׳ ׳§׳©׳•׳¨ ׳׳׳™׳•, ׳™׳© memberId, ׳•׳™׳© ׳׳• ׳׳™׳™׳) ===
  const wantMember = settings.send_to_member && body.toMember !== false && !!body.memberId;
  if (wantMember && memberEmail) {
    const memberHtml = buildEmail({
      heading: body.heading,
      intro: `׳©׳׳•׳${memberName ? ` ${memberName}` : ""}, ׳ ׳¨׳©׳׳” ׳₪׳¢׳•׳׳” ׳”׳§׳©׳•׳¨׳” ׳׳—׳©׳‘׳•׳ ׳ ׳‘׳’׳"׳—.`,
      amount: body.amount,
      accent: body.accent,
      rows,
      footnote: "׳׳›׳ ׳©׳׳׳” ׳ ׳™׳×׳ ׳׳₪׳ ׳•׳× ׳׳”׳ ׳”׳׳× ׳”׳’׳\"׳—. ׳׳™׳™׳ ׳–׳” ׳ ׳©׳׳— ׳׳•׳˜׳•׳׳˜׳™׳×.",
    });
    const ok = await sendAndLog(supabase, {
      to: memberEmail, subject: subjectBase, html: memberHtml,
      event: body.event, recipient_type: "member",
      member_id: body.memberId, member_name: memberName,
    });
    results.member = ok ? "sent" : "failed";
  } else {
    results.member = wantMember ? "no_email_on_file" : "skipped";
  }

  return json({ ok: true, results });
}
```

- [ ] **Step 2: ׳׳™׳׳•׳× build**

Run: `npm run build`
Expected: ׳¢׳•׳‘׳¨ ׳ ׳§׳™.

- [ ] **Step 3: Commit**

```powershell
git add app/api/notify/route.ts
git commit -m @'
׳©׳׳™׳—׳× ׳”׳×׳¨׳׳•׳× ׳“׳¨׳ Gmail ׳‘׳׳§׳•׳ Resend, ׳¢׳ ׳”׳’׳“׳¨׳•׳× ׳•׳™׳•׳׳

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 4: ׳×׳׳™׳›׳” ׳‘׳₪׳¡׳§׳׳•׳× ׳—׳•׳₪׳©׳™׳•׳× ׳‘׳×׳‘׳ ׳™׳× + `/api/send-email` (׳©׳׳™׳—׳” ׳™׳–׳•׳׳”)

**Files:**
- Modify: `lib/emailTemplate.ts` (׳”׳•׳¡׳₪׳× `paragraphs`)
- Create: `app/api/send-email/route.ts`

**Interfaces:**
- Consumes: `sendAndLog` ׳-Task 2, `buildEmail` ׳”׳׳•׳¨׳—׳‘.
- Produces:
  - `buildEmail` ׳׳§׳‘׳ ׳©׳“׳” ׳׳•׳₪׳¦׳™׳•׳ ׳׳™ ׳—׳“׳© `paragraphs?: string[]` ג€” ׳₪׳¡׳§׳׳•׳× ׳˜׳§׳¡׳˜ ׳—׳•׳₪׳©׳™ ׳׳—׳¨׳™ ׳”-intro.
  - POST `/api/send-email` ׳¢׳ `{ memberIds: string[] | "all", subject: string, message: string }` (Bearer token ׳—׳•׳‘׳”) ג†’ `{ ok: true, sent: number, failed: number }`. ׳”׳“׳£ ׳‘-Task 6 ׳§׳•׳¨׳ ׳׳–׳”.
  - ׳׳™׳™׳׳™׳ ׳™׳–׳•׳׳™׳ ׳ ׳¨׳©׳׳™׳ ׳‘׳™׳•׳׳ ׳¢׳ `event: "manual.sent"`.

- [ ] **Step 1: ׳”׳¨׳—׳‘׳× `buildEmail`**

׳‘-`lib/emailTemplate.ts`, ׳׳”׳•׳¡׳™׳£ ׳׳—׳×׳™׳׳× `opts` ׳׳× ׳”׳©׳“׳” `paragraphs?: string[]` (׳׳—׳¨׳™ `intro`), ׳•׳׳™׳“ ׳׳—׳¨׳™ ׳©׳•׳¨׳× ׳”-intro ׳‘׳×׳‘׳ ׳™׳× (׳”׳©׳•׳¨׳” `${opts.intro ? ... : ""}`) ׳׳”׳•׳¡׳™׳£:

```ts
          ${(opts.paragraphs ?? [])
            .map(p => `<p style="margin:0 0 14px;color:#14203a;font-size:15px;line-height:1.7;">${esc(p)}</p>`)
            .join("")}
```

- [ ] **Step 2: ׳›׳×׳™׳‘׳× `app/api/send-email/route.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { buildEmail } from "@/lib/emailTemplate";
import { sendAndLog } from "@/lib/mailer";

export const runtime = "nodejs";
export const maxDuration = 60; // ׳©׳׳™׳—׳” ׳¡׳“׳¨׳×׳™׳× ׳׳›׳ ׳”׳—׳‘׳¨׳™׳ ׳¢׳׳•׳׳” ׳׳§׳—׳× ׳–׳׳

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type SendBody = {
  memberIds: string[] | "all"; // "all" = ׳›׳ ׳”׳—׳‘׳¨׳™׳ ׳©׳™׳© ׳׳”׳ ׳׳™׳™׳
  subject: string;
  message: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ ok: false, error: "not_configured" }, 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "no_auth" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ ok: false, error: "invalid_auth" }, 401);

  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();
  if (!subject || !message) return json({ ok: false, error: "missing_fields" }, 400);
  if (body.memberIds !== "all" && (!Array.isArray(body.memberIds) || body.memberIds.length === 0)) {
    return json({ ok: false, error: "missing_recipients" }, 400);
  }

  let query = supabase.from("members").select("id,name,email")
    .not("email", "is", null).neq("email", "");
  if (body.memberIds !== "all") query = query.in("id", body.memberIds);
  const { data: members, error: qErr } = await query;
  if (qErr) return json({ ok: false, error: qErr.message }, 500);
  if (!members?.length) return json({ ok: true, sent: 0, failed: 0 });

  const paragraphs = message.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  let sent = 0, failed = 0;

  // ׳©׳׳™׳—׳” ׳¡׳“׳¨׳×׳™׳× ג€” ׳׳ ׳‘׳׳§׳‘׳™׳, ׳›׳“׳™ ׳׳ ׳׳”׳™׳—׳¡׳ ׳¢׳ ׳™׳“׳™ Gmail
  for (const m of members) {
    const html = buildEmail({
      heading: subject,
      intro: `׳©׳׳•׳ ${m.name},`,
      paragraphs,
      rows: [],
      accent: "blue",
      footnote: "׳׳™׳™׳ ׳–׳” ׳ ׳©׳׳— ׳׳”׳ ׳”׳׳× ׳’׳\"׳— ׳–׳›׳¨׳•׳ ׳׳”׳¨׳.",
    });
    const ok = await sendAndLog(supabase, {
      to: (m.email as string).trim(),
      subject: `׳’׳"׳— ׳–׳›׳¨׳•׳ ׳׳”׳¨׳ ג€” ${subject}`,
      html,
      event: "manual.sent",
      recipient_type: "member",
      member_id: m.id,
      member_name: m.name,
    });
    if (ok) sent++; else failed++;
  }

  return json({ ok: true, sent, failed });
}
```

- [ ] **Step 3: ׳׳™׳׳•׳× build**

Run: `npm run build`
Expected: ׳¢׳•׳‘׳¨ ׳ ׳§׳™.

- [ ] **Step 4: Commit**

```powershell
git add lib/emailTemplate.ts app/api/send-email/route.ts
git commit -m @'
׳©׳׳™׳—׳” ׳™׳–׳•׳׳” ׳©׳ ׳׳™׳™׳ ׳׳—׳‘׳¨ ׳‘׳•׳“׳“ ׳׳• ׳׳›׳ ׳”׳—׳‘׳¨׳™׳

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 5: `/api/resend-email` ג€” ׳©׳׳™׳—׳” ׳—׳•׳–׳¨׳× ׳׳”׳™׳•׳׳

**Files:**
- Create: `app/api/resend-email/route.ts`

**Interfaces:**
- Consumes: `sendAndLog` ׳-Task 2, ׳˜׳‘׳׳× `email_log` ׳-Task 1.
- Produces: POST `/api/resend-email` ׳¢׳ `{ logId: string }` (Bearer token ׳—׳•׳‘׳”) ג†’ `{ ok: true, status: "sent" | "failed" }`. ׳”׳©׳׳™׳—׳” ׳”׳—׳•׳–׳¨׳× ׳ ׳¨׳©׳׳× ׳›׳©׳•׳¨׳× ׳™׳•׳׳ ׳—׳“׳©׳”; ׳”׳׳§׳•׳¨ ׳׳ ׳׳©׳×׳ ׳”.

- [ ] **Step 1: ׳›׳×׳™׳‘׳× ׳”׳§׳•׳‘׳¥**

```ts
import { createClient } from "@supabase/supabase-js";
import { sendAndLog } from "@/lib/mailer";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  let body: { logId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ ok: false, error: "not_configured" }, 500);
  if (!body.logId) return json({ ok: false, error: "missing_log_id" }, 400);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "no_auth" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ ok: false, error: "invalid_auth" }, 401);

  const { data: row } = await supabase.from("email_log").select("*").eq("id", body.logId).maybeSingle();
  if (!row) return json({ ok: false, error: "log_not_found" }, 404);

  const ok = await sendAndLog(supabase, {
    to: row.recipient,
    subject: row.subject,
    html: row.html,
    event: row.event,
    recipient_type: row.recipient_type,
    member_id: row.member_id,
    member_name: row.member_name,
  });

  return json({ ok: true, status: ok ? "sent" : "failed" });
}
```

- [ ] **Step 2: ׳׳™׳׳•׳× build**

Run: `npm run build`
Expected: ׳¢׳•׳‘׳¨ ׳ ׳§׳™.

- [ ] **Step 3: Commit**

```powershell
git add app/api/resend-email/route.ts
git commit -m @'
׳©׳׳™׳—׳” ׳—׳•׳–׳¨׳× ׳©׳ ׳׳™׳™׳ ׳׳”׳™׳•׳׳

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 6: ׳“׳£ "׳׳™׳™׳׳™׳" (`/emails`) + ׳§׳™׳©׳•׳¨ ׳‘׳×׳₪׳¨׳™׳˜ ׳”׳¦׳“

**Files:**
- Create: `app/emails/page.tsx`
- Modify: `components/Sidebar.tsx:5` (׳™׳™׳‘׳•׳ ׳׳™׳™׳§׳•׳ `Mail`) ׳•-`components/Sidebar.tsx:9-17` (׳”׳•׳¡׳₪׳× ׳§׳™׳©׳•׳¨)

**Interfaces:**
- Consumes: ׳˜׳‘׳׳׳•׳× `email_log`, `email_settings` (׳§׳¨׳™׳׳”/׳›׳×׳™׳‘׳” ׳™׳©׳™׳¨׳” ׳“׳¨׳ supabase client ג€” ׳›׳׳• ׳©׳׳¨ ׳”׳“׳₪׳™׳); `/api/send-email` (Task 4); `/api/resend-email` (Task 5); ׳¨׳›׳™׳‘׳™ `PageTitle, Card, Button, Loading, Empty` ׳-`components/ui.tsx`.
- Produces: ׳“׳£ `/emails` ׳¢׳ ׳©׳׳•׳© ׳׳©׳•׳ ׳™׳•׳×: ׳™׳•׳׳ / ׳©׳׳™׳—׳” ׳™׳–׳•׳׳” / ׳”׳’׳“׳¨׳•׳×.

- [ ] **Step 1: ׳¢׳“׳›׳•׳ Sidebar**

׳‘-`components/Sidebar.tsx` ג€” ׳׳”׳•׳¡׳™׳£ `Mail` ׳׳™׳™׳‘׳•׳ ׳-lucide-react, ׳•׳‘׳׳¢׳¨׳ `links` ׳׳”׳•׳¡׳™׳£ ׳‘׳™׳ "׳“׳•׳—׳•׳×" ׳"׳”׳’׳“׳¨׳•׳×":

```ts
  { href: "/emails", label: "׳׳™׳™׳׳™׳", icon: Mail },
```

- [ ] **Step 2: ׳›׳×׳™׳‘׳× `app/emails/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { PageTitle, Card, Button, Loading, Empty } from "@/components/ui";
import { CheckCircle2, XCircle, RotateCw, Eye, Send, Mail } from "lucide-react";

const PAGE_SIZE = 50;

type EmailLogRow = {
  id: string;
  created_at: string;
  event: string | null;
  recipient_type: "admin" | "member";
  recipient: string;
  member_id: string | null;
  member_name: string | null;
  subject: string;
  html: string;
  status: "sent" | "failed";
  error: string | null;
};

type Settings = {
  send_to_admin: boolean;
  send_to_member: boolean;
  ev_transactions: boolean;
  ev_members: boolean;
  ev_checks: boolean;
  ev_requests: boolean;
  ev_import: boolean;
};

type MemberOption = { id: string; name: string; email: string };

// ׳×׳¨׳’׳•׳ ׳§׳•׳“ ׳׳™׳¨׳•׳¢ ׳׳×׳•׳•׳™׳× ׳¢׳‘׳¨׳™׳× (׳׳₪׳™ ׳”׳×׳—׳™׳׳™׳×)
function eventLabel(event: string | null): string {
  switch ((event || "").split(".")[0]) {
    case "transaction": return "׳₪׳¢׳•׳׳”";
    case "member":      return "׳—׳‘׳¨";
    case "check":       return "׳©׳™׳§";
    case "request":     return "׳‘׳§׳©׳”";
    case "import":      return "׳™׳™׳‘׳•׳";
    case "manual":      return "׳™׳“׳ ׳™";
    default:            return "׳׳—׳¨";
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function EmailsPage() {
  const [tab, setTab] = useState<"log" | "compose" | "settings">("log");

  return (
    <div>
      <PageTitle>׳׳™׳™׳׳™׳</PageTitle>

      {/* ׳׳©׳•׳ ׳™׳•׳× */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {([["log", "׳™׳•׳׳"], ["compose", "׳©׳׳™׳—׳” ׳™׳–׳•׳׳”"], ["settings", "׳”׳’׳“׳¨׳•׳×"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "0.5rem 1.1rem", borderRadius: 10, border: "none", cursor: "pointer",
            fontSize: ".92rem", fontWeight: tab === key ? 700 : 500,
            background: tab === key ? "var(--brand)" : "var(--card-bg, #fff)",
            color: tab === key ? "#fff" : "var(--text, #14203a)",
            boxShadow: tab === key ? "0 4px 14px rgba(12,86,66,.25)" : "0 1px 4px rgba(16,30,54,.08)",
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "log" && <LogTab />}
      {tab === "compose" && <ComposeTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

/* ================= ׳׳©׳•׳ ׳™׳× ׳™׳•׳׳ ================= */

function LogTab() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [statusF, setStatusF] = useState<"" | "sent" | "failed">("");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<EmailLogRow | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(async (offset = 0) => {
    setLoading(offset === 0);
    const { data } = await supabase
      .from("email_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    const page = (data ?? []) as EmailLogRow[];
    setRows(prev => offset === 0 ? page : [...prev, ...page]);
    setHasMore(page.length === PAGE_SIZE);
    setLoading(false);
  }, []);

  useEffect(() => { load(0); }, [load]);

  const filtered = useMemo(() => rows.filter(r => {
    if (statusF && r.status !== statusF) return false;
    if (q.trim()) {
      const hay = `${r.recipient} ${r.member_name || ""} ${r.subject} ${eventLabel(r.event)}`;
      if (!hay.includes(q.trim())) return false;
    }
    return true;
  }), [rows, statusF, q]);

  async function resend(row: EmailLogRow) {
    setResending(row.id);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/resend-email", {
        method: "POST", headers, body: JSON.stringify({ logId: row.id }),
      });
      const data = await res.json();
      alert(data.status === "sent" ? "׳”׳׳™׳™׳ ׳ ׳©׳׳— ׳׳—׳“׳© ׳‘׳”׳¦׳׳—׳”" : "׳”׳©׳׳™׳—׳” ׳”׳—׳•׳–׳¨׳× ׳ ׳›׳©׳׳” ג€” ׳¨׳׳” ׳‘׳™׳•׳׳");
      load(0);
    } finally {
      setResending(null);
    }
  }

  if (loading) return <Loading />;

  return (
    <Card>
      {/* ׳¡׳™׳ ׳•׳ */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="׳—׳™׳₪׳•׳© ׳ ׳׳¢׳ / ׳—׳‘׳¨ / ׳ ׳•׳©׳ג€¦"
          style={{ flex: 1, minWidth: 200, padding: "0.5rem 0.8rem", borderRadius: 9, border: "1px solid var(--border, #dde3ec)", fontSize: ".9rem" }} />
        <select value={statusF} onChange={e => setStatusF(e.target.value as "" | "sent" | "failed")}
          style={{ padding: "0.5rem 0.8rem", borderRadius: 9, border: "1px solid var(--border, #dde3ec)", fontSize: ".9rem" }}>
          <option value="">׳›׳ ׳”׳¡׳˜׳˜׳•׳¡׳™׳</option>
          <option value="sent">׳ ׳©׳׳—</option>
          <option value="failed">׳ ׳›׳©׳</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty text="׳׳™׳ ׳׳™׳™׳׳™׳ ׳‘׳™׳•׳׳" icon={<Mail size={38} />} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
            <thead>
              <tr style={{ textAlign: "right", color: "var(--muted, #6b7688)", fontSize: ".8rem" }}>
                <th style={{ padding: "8px 6px" }}>׳×׳׳¨׳™׳</th>
                <th style={{ padding: "8px 6px" }}>׳׳™׳¨׳•׳¢</th>
                <th style={{ padding: "8px 6px" }}>׳ ׳׳¢׳</th>
                <th style={{ padding: "8px 6px" }}>׳—׳‘׳¨</th>
                <th style={{ padding: "8px 6px" }}>׳ ׳•׳©׳</th>
                <th style={{ padding: "8px 6px" }}>׳¡׳˜׳˜׳•׳¡</th>
                <th style={{ padding: "8px 6px" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border, #eef2f7)" }}>
                  <td style={{ padding: "9px 6px", whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding: "9px 6px" }}>{eventLabel(r.event)}</td>
                  <td style={{ padding: "9px 6px", direction: "ltr", textAlign: "right" }}>
                    {r.recipient}{r.recipient_type === "admin" ? " (׳׳ ׳”׳)" : ""}
                  </td>
                  <td style={{ padding: "9px 6px" }}>{r.member_name || "ג€”"}</td>
                  <td style={{ padding: "9px 6px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</td>
                  <td style={{ padding: "9px 6px", whiteSpace: "nowrap" }}>
                    {r.status === "sent"
                      ? <span style={{ color: "#107a5e", display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={15} /> ׳ ׳©׳׳—</span>
                      : <span style={{ color: "#d64545", display: "inline-flex", alignItems: "center", gap: 4 }} title={r.error || ""}><XCircle size={15} /> ׳ ׳›׳©׳</span>}
                  </td>
                  <td style={{ padding: "9px 6px", whiteSpace: "nowrap" }}>
                    <button onClick={() => setPreview(r)} title="׳¦׳₪׳™׳™׳” ׳‘׳׳™׳™׳" style={iconBtn}><Eye size={16} /></button>
                    {r.status === "failed" && (
                      <button onClick={() => resend(r)} disabled={resending === r.id} title="׳©׳׳— ׳©׳•׳‘" style={iconBtn}>
                        <RotateCw size={16} style={resending === r.id ? { animation: "spin 1s linear infinite" } : undefined} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Button onClick={() => load(rows.length)}>׳˜׳¢׳ ׳¢׳•׳“</Button>
        </div>
      )}

      {/* ׳×׳¦׳•׳’׳” ׳׳§׳“׳™׳׳” */}
      {preview && (
        <div onClick={e => { if (e.target === e.currentTarget) setPreview(null); }} style={overlay}>
          <div style={{ ...modalBox, width: "min(640px, 94vw)", padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.2rem", borderBottom: "1px solid var(--border, #eef2f7)" }}>
              <strong style={{ fontSize: ".95rem" }}>{preview.subject}</strong>
              <button onClick={() => setPreview(null)} style={{ ...iconBtn, fontSize: "1.1rem" }}>ג•</button>
            </div>
            <iframe srcDoc={preview.html} title="׳×׳¦׳•׳’׳× ׳׳™׳™׳" style={{ width: "100%", height: "70vh", border: "none", background: "#f4f6fa" }} />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ================= ׳׳©׳•׳ ׳™׳× ׳©׳׳™׳—׳” ׳™׳–׳•׳׳” ================= */

function ComposeTab() {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"single" | "all">("single");
  const [memberId, setMemberId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("members").select("id,name,email")
        .not("email", "is", null).neq("email", "").order("name");
      setMembers((data ?? []) as MemberOption[]);
      setLoading(false);
    })();
  }, []);

  async function send() {
    if (!subject.trim() || !message.trim()) { alert("׳™׳© ׳׳׳׳ ׳ ׳•׳©׳ ׳•׳”׳•׳“׳¢׳”"); return; }
    if (mode === "single" && !memberId) { alert("׳™׳© ׳׳‘׳—׳•׳¨ ׳—׳‘׳¨"); return; }
    if (mode === "all" && !confirm(`׳׳©׳׳•׳— ׳׳× ׳”׳׳™׳™׳ ׳׳›׳ ${members.length} ׳”׳—׳‘׳¨׳™׳ ׳©׳™׳© ׳׳”׳ ׳›׳×׳•׳‘׳× ׳׳™׳™׳?`)) return;

    setSending(true);
    setResult(null);
    try {
      const headers = await authHeaders();
      if (!headers) { alert("׳™׳© ׳׳”׳×׳—׳‘׳¨ ׳׳—׳“׳©"); return; }
      const res = await fetch("/api/send-email", {
        method: "POST", headers,
        body: JSON.stringify({
          memberIds: mode === "all" ? "all" : [memberId],
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) { alert("׳©׳’׳™׳׳”: " + (data.error || "׳׳ ׳™׳“׳•׳¢")); return; }
      setResult({ sent: data.sent, failed: data.failed });
      if (data.failed === 0) { setSubject(""); setMessage(""); }
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Card>
      <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* ׳‘׳—׳™׳¨׳× ׳ ׳׳¢׳ */}
        <div style={{ display: "flex", gap: 10 }}>
          <label style={radioLabel}>
            <input type="radio" checked={mode === "single"} onChange={() => setMode("single")} /> ׳—׳‘׳¨ ׳‘׳•׳“׳“
          </label>
          <label style={radioLabel}>
            <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} /> ׳›׳ ׳”׳—׳‘׳¨׳™׳ ׳¢׳ ׳׳™׳™׳ ({members.length})
          </label>
        </div>

        {mode === "single" && (
          <select value={memberId} onChange={e => setMemberId(e.target.value)} style={field}>
            <option value="">׳‘׳—׳¨ ׳—׳‘׳¨ג€¦</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name} ג€” {m.email}</option>)}
          </select>
        )}

        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="׳ ׳•׳©׳" style={field} />
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="׳×׳•׳›׳ ׳”׳”׳•׳“׳¢׳”ג€¦ (׳›׳ ׳©׳•׳¨׳” ׳¨׳™׳§׳” ׳׳×׳—׳™׳׳” ׳₪׳¡׳§׳” ׳—׳“׳©׳”)"
          rows={7} style={{ ...field, resize: "vertical", lineHeight: 1.6 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button onClick={send} disabled={sending}>
            <Send size={15} style={{ marginInlineEnd: 6, verticalAlign: "-2px" }} />
            {sending ? "׳©׳•׳׳—ג€¦" : "׳©׳׳™׳—׳”"}
          </Button>
          {result && (
            <span style={{ fontSize: ".9rem", color: result.failed ? "#d64545" : "#107a5e", fontWeight: 600 }}>
              ׳ ׳©׳׳—׳• {result.sent}{result.failed ? ` ֲ· ׳ ׳›׳©׳׳• ${result.failed} (׳¨׳׳” ׳‘׳™׳•׳׳)` : ""}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ================= ׳׳©׳•׳ ׳™׳× ׳”׳’׳“׳¨׳•׳× ================= */

const SETTING_LABELS: [keyof Settings, string, string][] = [
  ["send_to_admin", "׳©׳׳™׳—׳× ׳”׳×׳¨׳׳•׳× ׳׳׳ ׳”׳", "׳׳™׳™׳ ׳׳׳ ׳”׳ ׳¢׳ ׳›׳ ׳₪׳¢׳•׳׳” ׳‘׳׳¢׳¨׳›׳×"],
  ["send_to_member", "׳©׳׳™׳—׳× ׳”׳×׳¨׳׳•׳× ׳׳—׳‘׳¨׳™׳", "׳׳™׳™׳ ׳׳—׳‘׳¨ ׳¢׳ ׳₪׳¢׳•׳׳” ׳‘׳—׳©׳‘׳•׳ ׳• (׳׳ ׳™׳© ׳׳• ׳›׳×׳•׳‘׳× ׳׳™׳™׳)"],
  ["ev_transactions", "׳”׳₪׳§׳“׳•׳× ׳•׳׳©׳™׳›׳•׳×", "׳”׳•׳¡׳₪׳”, ׳¢׳¨׳™׳›׳” ׳•׳׳—׳™׳§׳” ׳©׳ ׳₪׳¢׳•׳׳•׳×"],
  ["ev_members", "׳—׳‘׳¨׳™׳", "׳”׳•׳¡׳₪׳”, ׳¢׳¨׳™׳›׳” ׳•׳׳—׳™׳§׳” ׳©׳ ׳—׳‘׳¨׳™׳"],
  ["ev_checks", "׳©׳™׳§׳™׳", "׳¨׳™׳©׳•׳, ׳₪׳™׳¨׳¢׳•׳ ׳•׳”׳—׳–׳¨׳” ׳©׳ ׳©׳™׳§׳™׳"],
  ["ev_requests", "׳‘׳§׳©׳•׳×", "׳׳™׳©׳•׳¨, ׳¢׳“׳›׳•׳ ׳•׳“׳—׳™׳™׳” ׳©׳ ׳‘׳§׳©׳•׳×"],
  ["ev_import", "׳™׳™׳‘׳•׳ ׳׳׳§׳¡׳", "׳¡׳™׳•׳ ׳™׳™׳‘׳•׳ ׳ ׳×׳•׳ ׳™׳"],
];

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("email_settings").select("*").maybeSingle();
      setSettings((data as Settings | null) ?? {
        send_to_admin: true, send_to_member: true,
        ev_transactions: true, ev_members: true, ev_checks: true,
        ev_requests: true, ev_import: true,
      });
    })();
  }, []);

  async function toggle(key: keyof Settings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    const { error } = await supabase.from("email_settings").upsert({
      id: true,
      send_to_admin: next.send_to_admin, send_to_member: next.send_to_member,
      ev_transactions: next.ev_transactions, ev_members: next.ev_members,
      ev_checks: next.ev_checks, ev_requests: next.ev_requests, ev_import: next.ev_import,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { alert("׳©׳’׳™׳׳” ׳‘׳©׳׳™׳¨׳”: " + error.message); setSettings(settings); return; }
    setSavedAt(Date.now());
  }

  if (!settings) return <Loading />;

  return (
    <Card>
      <div style={{ maxWidth: 560, display: "flex", flexDirection: "column" }}>
        {SETTING_LABELS.map(([key, label, desc], i) => (
          <div key={key} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            padding: "0.85rem 0", borderTop: i === 0 ? "none" : "1px solid var(--border, #eef2f7)",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: ".95rem" }}>{label}</div>
              <div style={{ fontSize: ".8rem", color: "var(--muted, #6b7688)" }}>{desc}</div>
            </div>
            <button onClick={() => toggle(key)} disabled={saving} title={settings[key] ? "׳›׳‘׳”" : "׳”׳₪׳¢׳"} style={{
              width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
              background: settings[key] ? "var(--brand, #0c5642)" : "#c3ccd8", transition: "background .15s", flexShrink: 0,
            }}>
              <span style={{
                position: "absolute", top: 3, insetInlineStart: settings[key] ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s",
              }} />
            </button>
          </div>
        ))}
        {savedAt && <div style={{ fontSize: ".8rem", color: "#107a5e", marginTop: 10, fontWeight: 600 }}>ג“ ׳”׳”׳’׳“׳¨׳•׳× ׳ ׳©׳׳¨׳•</div>}
      </div>
    </Card>
  );
}

/* ================= ׳¡׳’׳ ׳•׳ ׳•׳× ׳׳©׳•׳×׳₪׳™׳ ================= */

const field: CSSProperties = {
  padding: "0.6rem 0.85rem", borderRadius: 10, border: "1px solid var(--border, #dde3ec)",
  fontSize: ".92rem", width: "100%", background: "var(--card-bg, #fff)", color: "inherit",
};

const radioLabel: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, fontSize: ".92rem", cursor: "pointer",
};

const iconBtn: CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 5,
  color: "var(--muted, #6b7688)", borderRadius: 7,
};

const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(10,20,16,.45)", zIndex: 60,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};

const modalBox: CSSProperties = {
  background: "var(--card-bg, #fff)", borderRadius: 16, padding: "1.4rem",
  boxShadow: "0 18px 50px rgba(7,30,22,.35)", maxHeight: "90vh", overflowY: "auto",
};
```

> **׳”׳¢׳¨׳” ׳׳׳‘׳¦׳¢:** ׳׳₪׳ ׳™ ׳”׳›׳×׳™׳‘׳”, ׳™׳© ׳׳”׳¦׳™׳¥ ׳‘׳“׳£ ׳§׳™׳™׳ (׳׳׳©׳ `app/transactions/page.tsx` ׳©׳•׳¨׳•׳× 280ג€“300) ׳•׳׳•׳•׳“׳ ׳©׳”׳¡׳’׳ ׳•׳ ׳•׳× (׳׳©׳×׳ ׳™ CSS, ׳׳‘׳ ׳” `Card`/`PageTitle`) ׳×׳•׳׳׳™׳ ׳׳׳” ׳©׳§׳™׳™׳ ׳‘׳₪׳•׳¢׳ ג€” ׳•׳׳”׳×׳׳™׳ ׳׳ ׳¦׳¨׳™׳.

- [ ] **Step 3: ׳׳™׳׳•׳× build**

Run: `npm run build`
Expected: ׳¢׳•׳‘׳¨ ׳ ׳§׳™, ׳”׳ ׳×׳™׳‘ `/emails` ׳׳•׳₪׳™׳¢ ׳‘׳¨׳©׳™׳׳× ׳”׳“׳₪׳™׳.

- [ ] **Step 4: Commit**

```powershell
git add app/emails/page.tsx components/Sidebar.tsx
git commit -m @'
׳“׳£ "׳׳™׳™׳׳™׳": ׳™׳•׳׳, ׳©׳׳™׳—׳” ׳™׳–׳•׳׳” ׳•׳”׳’׳“׳¨׳•׳× ׳©׳׳™׳—׳”

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 7: ׳×׳™׳¢׳•׳“ ג€” EMAIL_SETUP.md ׳•-.env.local.example

**Files:**
- Modify: `EMAIL_SETUP.md` (׳©׳›׳×׳•׳‘ ׳׳׳)
- Modify: `.env.local.example:7-15` (׳”׳—׳׳₪׳× ׳‘׳׳•׳§ Resend)

**Interfaces:**
- Consumes: ׳©׳׳•׳× ׳׳©׳×׳ ׳™ ׳”׳¡׳‘׳™׳‘׳” ׳-Task 2: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_EMAIL`.

- [ ] **Step 1: ׳©׳›׳×׳•׳‘ `EMAIL_SETUP.md`**

```markdown
# נ“§ ׳”׳₪׳¢׳׳× ׳׳¢׳¨׳›׳× ׳”׳׳™׳™׳׳™׳ ג€” ׳’׳"׳— ׳–׳›׳¨׳•׳ ׳׳”׳¨׳

׳”׳׳¢׳¨׳›׳× ׳©׳•׳׳—׳× ׳׳™׳™׳ HTML ׳׳¢׳•׳¦׳‘ **׳‘׳›׳ ׳₪׳¢׳•׳׳”** (׳”׳₪׳§׳“׳”, ׳׳©׳™׳›׳”, ׳—׳‘׳¨ ׳—׳“׳©, ׳¢׳¨׳™׳›׳”,
׳׳—׳™׳§׳”, ׳©׳™׳§׳™׳, ׳׳™׳©׳•׳¨ ׳‘׳§׳©׳•׳×, ׳™׳™׳‘׳•׳) ׳“׳¨׳ ׳—׳©׳‘׳•׳ ׳”-Gmail ׳”׳™׳™׳¢׳•׳“׳™ ׳©׳ ׳”׳’׳"׳—:

- **׳׳׳ ׳”׳** ג€” ׳¢׳ ׳›׳ ׳₪׳¢׳•׳׳” (׳ ׳™׳×׳ ׳׳›׳™׳‘׳•׳™ ׳‘׳“׳£ "׳׳™׳™׳׳™׳" ג†’ ׳”׳’׳“׳¨׳•׳×).
- **׳׳—׳‘׳¨** ג€” ׳׳ ׳”׳₪׳¢׳•׳׳” ׳§׳©׳•׳¨׳” ׳׳׳™׳• **׳•׳™׳© ׳׳• ׳›׳×׳•׳‘׳× ׳׳™׳™׳ ׳©׳׳•׳¨׳”** ׳‘׳›׳¨׳˜׳™׳¡.

׳‘׳ ׳•׳¡׳£, ׳‘׳“׳£ **"׳׳™׳™׳׳™׳"** ׳‘׳׳¢׳¨׳›׳×: ׳™׳•׳׳ ׳›׳ ׳”׳׳™׳™׳׳™׳ ׳©׳ ׳©׳׳—׳• (׳›׳•׳׳ ׳›׳©׳׳™׳
׳•׳©׳׳™׳—׳” ׳—׳•׳–׳¨׳×), ׳©׳׳™׳—׳” ׳™׳–׳•׳׳” ׳©׳ ׳”׳•׳“׳¢׳” ׳׳—׳‘׳¨ ׳‘׳•׳“׳“ ׳׳• ׳׳›׳•׳׳, ׳•׳”׳’׳“׳¨׳•׳× ׳©׳׳™׳—׳”.

> ׳‘׳׳™ ׳”׳”׳’׳“׳¨׳” ׳׳׳˜׳” ׳”׳׳¢׳¨׳›׳× ׳¢׳•׳‘׳“׳× ׳¨׳’׳™׳ ג€” ׳׳™׳™׳׳™׳ ׳׳ ׳ ׳©׳׳—׳™׳, ׳•׳”׳›׳©׳׳™׳
> ׳׳•׳₪׳™׳¢׳™׳ ׳‘׳™׳•׳׳ ׳¢׳ ׳”׳©׳’׳™׳׳” `not_configured`.

---

## ׳”׳₪׳¢׳׳” ג€” 4 ׳¦׳¢׳“׳™׳ (׳—׳“-׳₪׳¢׳׳™)

### 1. ׳¡׳™׳¡׳׳× ׳׳₪׳׳™׳§׳¦׳™׳” ׳‘׳—׳©׳‘׳•׳ ׳”-Gmail
1. ׳ ׳›׳ ׳¡׳™׳ ׳׳—׳©׳‘׳•׳ ׳”-Gmail ׳”׳™׳™׳¢׳•׳“׳™ ׳©׳ ׳”׳’׳"׳—.
2. ׳׳₪׳¢׳™׳׳™׳ **׳׳™׳׳•׳× ׳“׳•-׳©׳׳‘׳™**: https://myaccount.google.com/security ג†’
   "׳׳™׳׳•׳× ׳“׳•-׳©׳׳‘׳™" ג†’ ׳׳₪׳¢׳™׳׳™׳ (׳—׳•׳‘׳” ג€” ׳‘׳׳¢׳“׳™׳• ׳׳™׳ ׳¡׳™׳¡׳׳׳•׳× ׳׳₪׳׳™׳§׳¦׳™׳”).
3. ׳™׳•׳¦׳¨׳™׳ **׳¡׳™׳¡׳׳× ׳׳₪׳׳™׳§׳¦׳™׳”**: https://myaccount.google.com/apppasswords ג†’
   ׳ ׳•׳×׳ ׳™׳ ׳©׳ (׳׳׳©׳ "׳׳¢׳¨׳›׳× ׳’׳׳—") ג†’ **Create** ג†’ ׳׳¢׳×׳™׳§׳™׳ ׳׳× ׳”׳¡׳™׳¡׳׳” ׳‘׳×
   16 ׳”׳×׳•׳•׳™׳ (׳‘׳׳™ ׳”׳¨׳•׳•׳—׳™׳).

### 2. ׳”׳•׳¡׳₪׳× ׳׳©׳×׳ ׳™ ׳¡׳‘׳™׳‘׳” ׳‘-Vercel
׳‘-**Vercel ג†’ ׳”׳₪׳¨׳•׳™׳§׳˜ ג†’ Settings ג†’ Environment Variables**, ׳׳•׳¡׳™׳₪׳™׳:

| ׳©׳ | ׳¢׳¨׳ |
|----|-----|
| `GMAIL_USER` | ׳›׳×׳•׳‘׳× ׳”-Gmail ׳”׳׳׳׳” (׳׳׳©׳ `gemach@gmail.com`) |
| `GMAIL_APP_PASSWORD` | ׳¡׳™׳¡׳׳× ׳”׳׳₪׳׳™׳§׳¦׳™׳” ׳‘׳× 16 ׳”׳×׳•׳•׳™׳ |
| `ADMIN_EMAIL` | (׳׳•׳₪׳¦׳™׳•׳ ׳׳™) ׳׳׳ ׳™׳’׳™׳¢׳• ׳”׳×׳¨׳׳•׳× ׳”׳׳ ׳”׳. ׳‘׳¨׳™׳¨׳× ׳׳—׳“׳: `GMAIL_USER` |

> ׳׳ ׳”׳™׳• ׳׳•׳’׳“׳¨׳™׳ `RESEND_API_KEY` / `EMAIL_FROM` ג€” ׳׳₪׳©׳¨ ׳׳׳—׳•׳§ ׳׳•׳×׳, ׳”׳ ׳׳ ׳‘׳©׳™׳׳•׳© ׳™׳•׳×׳¨.

### 3. ׳™׳¦׳™׳¨׳× ׳˜׳‘׳׳׳•׳× ׳”׳™׳•׳׳ ׳•׳”׳”׳’׳“׳¨׳•׳×
׳‘-**Supabase ג†’ SQL Editor** ׳׳¨׳™׳¦׳™׳ ׳₪׳¢׳ ׳׳—׳× ׳׳× ׳”׳§׳•׳‘׳¥
`supabase/email-schema.sql` (׳™׳•׳¦׳¨ ׳׳× `email_log` ׳•-`email_settings`).

### 4. Redeploy
׳‘-Vercel ג†’ **Deployments** ג†’ ׳¢׳ ׳”׳₪׳¨׳™׳¡׳” ׳”׳׳—׳¨׳•׳ ׳” ג†’ **Redeploy**.

---

## ׳׳™׳ ׳–׳” ׳¢׳•׳‘׳“ ׳˜׳›׳ ׳™׳×
- ׳›׳ ׳₪׳¢׳•׳׳” ׳§׳•׳¨׳׳× ׳-`notify()` (׳¦׳“ ׳׳§׳•׳—) ׳©׳׳₪׳¢׳™׳ ׳׳× `/api/notify` (׳¦׳“ ׳©׳¨׳×).
- ׳”׳©׳¨׳× ׳‘׳•׳“׳§ ׳׳× ׳”׳”׳’׳“׳¨׳•׳× (׳“׳£ "׳׳™׳™׳׳™׳" ג†’ ׳”׳’׳“׳¨׳•׳×), ׳©׳•׳׳— ׳“׳¨׳ SMTP ׳©׳ Gmail
  (`lib/mailer.ts`), ׳•׳¨׳•׳©׳ ׳›׳ ׳©׳׳™׳—׳” ג€” ׳”׳¦׳׳—׳” ׳׳• ׳›׳©׳ ג€” ׳‘׳˜׳‘׳׳× `email_log`.
- ׳”׳©׳׳™׳—׳” ׳”׳™׳ "׳©׳’׳¨ ׳•׳©׳›׳—" ג€” ׳׳ ׳׳™׳™׳ ׳ ׳›׳©׳, **׳”׳₪׳¢׳•׳׳” ׳‘׳׳¢׳¨׳›׳× ׳›׳‘׳¨ ׳ ׳©׳׳¨׳”**.
  ׳”׳›׳©׳ ׳׳•׳₪׳™׳¢ ׳‘׳™׳•׳׳ ׳•׳׳₪׳©׳¨ ׳׳©׳׳•׳— ׳©׳•׳‘ ׳‘׳׳—׳™׳¦׳”.
- ׳©׳׳™׳—׳” ׳™׳–׳•׳׳”: ׳“׳£ "׳׳™׳™׳׳™׳" ג†’ "׳©׳׳™׳—׳” ׳™׳–׳•׳׳”" ג†’ `/api/send-email`.
- ׳׳’׳‘׳׳× Gmail: ׳¢׳“ ~500 ׳ ׳׳¢׳ ׳™׳ ׳‘׳™׳•׳ ג€” ׳׳¡׳₪׳™׳§ ׳‘׳”׳—׳׳˜ ׳׳’׳"׳—.

## ׳›׳“׳™ ׳©׳’׳ ׳”׳—׳‘׳¨׳™׳ ׳™׳§׳‘׳׳• ׳׳™׳™׳
׳¦׳¨׳™׳ ׳©׳׳›׳¨׳˜׳™׳¡ ׳”׳—׳‘׳¨ ׳×׳”׳™׳” ׳›׳×׳•׳‘׳× ׳׳™׳™׳. ׳—׳‘׳¨׳™׳ ׳‘׳׳™ ׳׳™׳™׳ ג€” ׳¨׳§ ׳”׳׳ ׳”׳ ׳™׳§׳‘׳ ׳”׳×׳¨׳׳”.
```

- [ ] **Step 2: ׳¢׳“׳›׳•׳ `.env.local.example`**

׳׳”׳—׳׳™׳£ ׳׳× ׳”׳‘׳׳•׳§ `# ===== ׳”׳×׳¨׳׳•׳× ׳׳™׳™׳ (Resend) ... EMAIL_FROM=...` (׳©׳•׳¨׳•׳× 7ג€“15) ׳‘:

```
# ===== ׳׳¢׳¨׳›׳× ׳׳™׳™׳׳™׳ (Gmail) ג€” ׳׳•׳₪׳¦׳™׳•׳ ׳׳™ =====
# ׳‘׳׳™ ׳”׳׳©׳×׳ ׳™׳ ׳”׳׳׳” ׳”׳׳¢׳¨׳›׳× ׳¢׳•׳‘׳“׳× ׳¨׳’׳™׳, ׳₪׳©׳•׳˜ ׳׳ ׳ ׳©׳׳—׳™׳ ׳׳™׳™׳׳™׳.
# ׳”׳•׳¨׳׳•׳× ׳׳׳׳•׳×: EMAIL_SETUP.md
# 1) GMAIL_USER = ׳›׳×׳•׳‘׳× ׳”-Gmail ׳”׳™׳™׳¢׳•׳“׳™׳× ׳©׳ ׳”׳’׳"׳—.
# 2) GMAIL_APP_PASSWORD = "׳¡׳™׳¡׳׳× ׳׳₪׳׳™׳§׳¦׳™׳”" (myaccount.google.com/apppasswords,
#    ׳“׳•׳¨׳© ׳׳™׳׳•׳× ׳“׳•-׳©׳׳‘׳™ ׳‘׳—׳©׳‘׳•׳).
# 3) ADMIN_EMAIL = ׳׳׳ ׳™׳’׳™׳¢׳• ׳”׳×׳¨׳׳•׳× ׳”׳׳ ׳”׳ (׳‘׳¨׳™׳¨׳× ׳׳—׳“׳: GMAIL_USER).
GMAIL_USER=gemach@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
ADMIN_EMAIL=manager@example.com
```

- [ ] **Step 3: Commit**

```powershell
git add EMAIL_SETUP.md .env.local.example
git commit -m @'
׳¢׳“׳›׳•׳ ׳×׳™׳¢׳•׳“ ׳”׳₪׳¢׳׳× ׳׳™׳™׳׳™׳: Gmail ׳‘׳׳§׳•׳ Resend

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 8: ׳׳™׳׳•׳× ׳׳§׳¦׳” ׳׳§׳¦׳” (׳™׳“׳ ׳™)

**Files:** ׳׳׳ ׳©׳™׳ ׳•׳™׳™ ׳§׳•׳“.

- [ ] **Step 1: build ׳¡׳•׳₪׳™**

Run: `npm run build`
Expected: ׳¢׳•׳‘׳¨ ׳ ׳§׳™, ׳›׳ ׳”׳ ׳×׳™׳‘׳™׳ (`/emails`, `/api/notify`, `/api/send-email`, `/api/resend-email`) ׳׳•׳₪׳™׳¢׳™׳.

- [ ] **Step 2: ׳‘׳“׳™׳§׳” ׳™׳“׳ ׳™׳× ׳׳§׳•׳׳™׳× (׳׳ ׳§׳™׳™׳ `.env.local` ׳¢׳ ׳₪׳¨׳˜׳™ Supabase)**

1. `npm run dev`, ׳›׳ ׳™׳¡׳” ׳׳׳¢׳¨׳›׳×.
2. ׳“׳£ "׳׳™׳™׳׳™׳" ׳ ׳˜׳¢׳, ׳©׳׳•׳© ׳”׳׳©׳•׳ ׳™׳•׳× ׳¢׳•׳‘׳“׳•׳×.
3. **׳‘׳׳™** `GMAIL_USER`/`GMAIL_APP_PASSWORD`: ׳‘׳™׳¦׳•׳¢ ׳”׳₪׳§׳“׳” ג†’ ׳”׳₪׳¢׳•׳׳” ׳ ׳©׳׳¨׳×,
   ׳•׳‘׳™׳•׳׳ ׳׳•׳₪׳™׳¢׳” ׳©׳•׳¨׳× `failed` ׳¢׳ `not_configured` (׳¨׳§ ׳׳—׳¨׳™ ׳”׳¨׳¦׳× ׳”-SQL ׳‘-Supabase).
4. ׳׳©׳•׳ ׳™׳× ׳”׳’׳“׳¨׳•׳×: ׳›׳™׳‘׳•׳™ "׳”׳₪׳§׳“׳•׳× ׳•׳׳©׳™׳›׳•׳×" ג†’ ׳‘׳™׳¦׳•׳¢ ׳”׳₪׳§׳“׳” ג†’ ׳׳ ׳ ׳¨׳©׳ ׳›׳׳•׳ ׳‘׳™׳•׳׳; ׳”׳“׳׳§׳” ׳—׳–׳¨׳”.
5. **׳¢׳** ׳₪׳¨׳˜׳™ Gmail (׳׳ ׳”׳׳©׳×׳׳© ׳¡׳™׳₪׳§): ׳”׳₪׳§׳“׳” ג†’ ׳׳™׳™׳ ׳׳’׳™׳¢ ׳׳׳ ׳”׳; ׳©׳׳™׳—׳” ׳™׳–׳•׳׳” ׳׳—׳‘׳¨ ׳‘׳•׳“׳“ ג†’ ׳׳’׳™׳¢ ׳•׳ ׳¨׳©׳.

> ׳׳ ׳׳™׳ `.env.local` ׳׳• ׳©׳”-SQL ׳˜׳¨׳ ׳”׳•׳¨׳¥ ג€” ׳׳“׳•׳•׳— ׳׳׳©׳×׳׳© ׳‘׳“׳™׳•׳§ ׳׳™׳׳• ׳‘׳“׳™׳§׳•׳× ׳‘׳•׳¦׳¢׳• ׳•׳׳™׳׳• ׳׳׳×׳™׳ ׳•׳× ׳׳”׳’׳“׳¨׳” ׳©׳׳•.

- [ ] **Step 3: ׳“׳™׳•׳•׳— ׳¡׳™׳›׳•׳ ׳׳׳©׳×׳׳©**

׳׳›׳׳•׳: ׳׳” ׳”׳•׳©׳׳, ׳”׳¦׳¢׳“׳™׳ ׳”׳™׳“׳ ׳™׳™׳ ׳©׳ ׳•׳×׳¨׳• (׳¡׳™׳¡׳׳× ׳׳₪׳׳™׳§׳¦׳™׳”, ׳׳©׳×׳ ׳™ ׳¡׳‘׳™׳‘׳” ׳‘-Vercel, ׳”׳¨׳¦׳× `supabase/email-schema.sql`, Redeploy).

