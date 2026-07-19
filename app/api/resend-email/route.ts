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

  // שליחה חוזרת של אותו מייל בדיוק — נרשמת כשורת יומן חדשה, המקור לא משתנה
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
