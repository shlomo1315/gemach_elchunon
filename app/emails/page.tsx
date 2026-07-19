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

// תרגום קוד אירוע לתווית עברית (לפי התחילית)
function eventLabel(event: string | null): string {
  switch ((event || "").split(".")[0]) {
    case "transaction": return "פעולה";
    case "member":      return "חבר";
    case "check":       return "שיק";
    case "request":     return "בקשה";
    case "import":      return "ייבוא";
    case "manual":      return "ידני";
    default:            return "אחר";
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
      <PageTitle subtitle="יומן שליחות, שליחה יזומה והגדרות ההתראות">מיילים</PageTitle>

      {/* לשוניות */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {([["log", "יומן"], ["compose", "שליחה יזומה"], ["settings", "הגדרות"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "0.5rem 1.1rem", borderRadius: 10, border: "1px solid var(--line)", cursor: "pointer",
            fontSize: ".92rem", fontWeight: tab === key ? 700 : 500,
            background: tab === key ? "var(--grad-brand, var(--brand))" : "var(--card)",
            color: tab === key ? "#fff" : "var(--ink, inherit)",
            boxShadow: tab === key ? "var(--shadow-brand)" : "var(--shadow)",
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

/* ================= לשונית יומן ================= */

function LogTab() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [statusF, setStatusF] = useState<"" | "sent" | "failed">("");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<EmailLogRow | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) setLoading(true);
    const { data, error } = await supabase
      .from("email_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    setLoadError(error ? error.message : null);
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
      alert(data.status === "sent" ? "המייל נשלח מחדש בהצלחה" : "השליחה החוזרת נכשלה — ראה ביומן");
      load(0);
    } finally {
      setResending(null);
    }
  }

  if (loading) return <Loading />;

  return (
    <Card>
      {loadError && (
        <div style={{ background: "#fdeaea", color: "#d64545", borderRadius: 10, padding: "0.7rem 1rem", marginBottom: 14, fontSize: ".88rem" }}>
          שגיאה בטעינת היומן: {loadError}. ודא שהרצת את supabase/email-schema.sql ב-Supabase.
        </div>
      )}

      {/* סינון */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש נמען / חבר / נושא…"
          style={{ ...field, flex: 1, minWidth: 200, width: "auto" }} />
        <select value={statusF} onChange={e => setStatusF(e.target.value as "" | "sent" | "failed")}
          style={{ ...field, width: "auto" }}>
          <option value="">כל הסטטוסים</option>
          <option value="sent">נשלח</option>
          <option value="failed">נכשל</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty text="אין מיילים ביומן" icon={<Mail size={38} />} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
            <thead>
              <tr style={{ textAlign: "right", color: "var(--muted)", fontSize: ".8rem" }}>
                <th style={th}>תאריך</th>
                <th style={th}>אירוע</th>
                <th style={th}>נמען</th>
                <th style={th}>חבר</th>
                <th style={th}>נושא</th>
                <th style={th}>סטטוס</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                  <td style={td}>{eventLabel(r.event)}</td>
                  <td style={{ ...td, direction: "ltr", textAlign: "right" }}>
                    {r.recipient}{r.recipient_type === "admin" ? " (מנהל)" : ""}
                  </td>
                  <td style={td}>{r.member_name || "—"}</td>
                  <td style={{ ...td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {r.status === "sent"
                      ? <span style={{ color: "#107a5e", display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={15} /> נשלח</span>
                      : <span style={{ color: "#d64545", display: "inline-flex", alignItems: "center", gap: 4 }} title={r.error || ""}><XCircle size={15} /> נכשל</span>}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => setPreview(r)} title="צפייה במייל" style={iconBtn}><Eye size={16} /></button>
                    {r.status === "failed" && (
                      <button onClick={() => resend(r)} disabled={resending === r.id} title="שלח שוב" style={iconBtn}>
                        <RotateCw size={16} />
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
          <Button variant="ghost" onClick={() => load(rows.length)}>טען עוד</Button>
        </div>
      )}

      {/* תצוגה מקדימה */}
      {preview && (
        <div onClick={e => { if (e.target === e.currentTarget) setPreview(null); }} style={overlay}>
          <div style={{ ...modalBox, width: "min(640px, 94vw)", padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.2rem", borderBottom: "1px solid var(--line)" }}>
              <strong style={{ fontSize: ".95rem" }}>{preview.subject}</strong>
              <button onClick={() => setPreview(null)} style={{ ...iconBtn, fontSize: "1.1rem" }}>✕</button>
            </div>
            <iframe srcDoc={preview.html} title="תצוגת מייל" style={{ width: "100%", height: "70vh", border: "none", background: "#f4f6fa" }} />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ================= לשונית שליחה יזומה ================= */

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
    if (!subject.trim() || !message.trim()) { alert("יש למלא נושא והודעה"); return; }
    if (mode === "single" && !memberId) { alert("יש לבחור חבר"); return; }
    if (mode === "all" && !confirm(`לשלוח את המייל לכל ${members.length} החברים שיש להם כתובת מייל?`)) return;

    setSending(true);
    setResult(null);
    try {
      const headers = await authHeaders();
      if (!headers) { alert("יש להתחבר מחדש"); return; }
      const res = await fetch("/api/send-email", {
        method: "POST", headers,
        body: JSON.stringify({
          memberIds: mode === "all" ? "all" : [memberId],
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) { alert("שגיאה: " + (data.error || "לא ידוע")); return; }
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
        {/* בחירת נמען */}
        <div style={{ display: "flex", gap: 16 }}>
          <label style={radioLabel}>
            <input type="radio" checked={mode === "single"} onChange={() => setMode("single")} /> חבר בודד
          </label>
          <label style={radioLabel}>
            <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} /> כל החברים עם מייל ({members.length})
          </label>
        </div>

        {mode === "single" && (
          <select value={memberId} onChange={e => setMemberId(e.target.value)} style={field}>
            <option value="">בחר חבר…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.email}</option>)}
          </select>
        )}

        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="נושא" style={field} />
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="תוכן ההודעה… (שורה חדשה מתחילה פסקה חדשה)"
          rows={7} style={{ ...field, resize: "vertical", lineHeight: 1.6 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button onClick={send} disabled={sending}>
            <Send size={15} />
            {sending ? "שולח…" : "שליחה"}
          </Button>
          {result && (
            <span style={{ fontSize: ".9rem", color: result.failed ? "#d64545" : "#107a5e", fontWeight: 600 }}>
              נשלחו {result.sent}{result.failed ? ` · נכשלו ${result.failed} (ראה ביומן)` : ""}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ================= לשונית הגדרות ================= */

const SETTING_LABELS: [keyof Settings, string, string][] = [
  ["send_to_admin", "שליחת התראות למנהל", "מייל למנהל על כל פעולה במערכת"],
  ["send_to_member", "שליחת התראות לחברים", "מייל לחבר על פעולה בחשבונו (אם יש לו כתובת מייל)"],
  ["ev_transactions", "הפקדות ומשיכות", "הוספה, עריכה ומחיקה של פעולות"],
  ["ev_members", "חברים", "הוספה, עריכה ומחיקה של חברים"],
  ["ev_checks", "שיקים", "רישום, פירעון והחזרה של שיקים"],
  ["ev_requests", "בקשות", "אישור, עדכון ודחייה של בקשות"],
  ["ev_import", "ייבוא מאקסל", "סיום ייבוא נתונים"],
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
    if (error) { alert("שגיאה בשמירה: " + error.message); setSettings(settings); return; }
    setSavedAt(Date.now());
  }

  if (!settings) return <Loading />;

  return (
    <Card>
      <div style={{ maxWidth: 560, display: "flex", flexDirection: "column" }}>
        {SETTING_LABELS.map(([key, label, desc], i) => (
          <div key={key} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            padding: "0.85rem 0", borderTop: i === 0 ? "none" : "1px solid var(--line)",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: ".95rem" }}>{label}</div>
              <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>{desc}</div>
            </div>
            <button onClick={() => toggle(key)} disabled={saving} title={settings[key] ? "כבה" : "הפעל"} style={{
              width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
              background: settings[key] ? "var(--brand)" : "#c3ccd8", transition: "background .15s", flexShrink: 0,
            }}>
              <span style={{
                position: "absolute", top: 3, insetInlineStart: settings[key] ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s",
              }} />
            </button>
          </div>
        ))}
        {savedAt && <div style={{ fontSize: ".8rem", color: "#107a5e", marginTop: 10, fontWeight: 600 }}>✓ ההגדרות נשמרו</div>}
      </div>
    </Card>
  );
}

/* ================= סגנונות משותפים ================= */

const field: CSSProperties = {
  padding: "0.6rem 0.85rem", borderRadius: 10, border: "1px solid var(--line)",
  fontSize: ".92rem", width: "100%", background: "var(--card)", color: "inherit",
};

const radioLabel: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, fontSize: ".92rem", cursor: "pointer",
};

const iconBtn: CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 5,
  color: "var(--muted)", borderRadius: 7,
};

const th: CSSProperties = { padding: "8px 6px", fontWeight: 700 };
const td: CSSProperties = { padding: "9px 6px" };

const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(10,20,16,.45)", zIndex: 60,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};

const modalBox: CSSProperties = {
  background: "var(--card)", borderRadius: 16, padding: "1.4rem",
  boxShadow: "0 18px 50px rgba(7,30,22,.35)", maxHeight: "90vh", overflowY: "auto",
};
