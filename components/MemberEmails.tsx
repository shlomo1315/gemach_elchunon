"use client";

// תצוגת התכתובת מול חבר בודד: כל המיילים שנשלחו אליו מתוך email_log,
// ושליחת מייל חדש ישירות מכרטיס החבר (דרך /api/send-email).

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Button, Empty } from "@/components/ui";
import { CheckCircle2, XCircle, Eye, Send, Mail, RotateCw } from "lucide-react";

type LogRow = {
  id: string;
  created_at: string;
  event: string | null;
  recipient: string;
  subject: string;
  html: string;
  status: "sent" | "failed";
  error: string | null;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

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

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function MemberEmails({
  memberId, memberName, memberEmail,
}: { memberId: string; memberName: string; memberEmail: string | null }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LogRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // טופס שליחה
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("email_log")
      .select("id,created_at,event,recipient,subject,html,status,error")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(100);
    setLoadError(error ? error.message : null);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!subject.trim() || !message.trim()) { alert("יש למלא נושא והודעה"); return; }
    setSending(true);
    setSentMsg("");
    try {
      const headers = await authHeaders();
      if (!headers) { alert("יש להתחבר מחדש"); return; }
      const res = await fetch("/api/send-email", {
        method: "POST", headers,
        body: JSON.stringify({ memberIds: [memberId], subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { alert("שגיאה: " + (data.error || "לא ידוע")); return; }
      if (data.sent > 0) {
        setSubject(""); setMessage(""); setOpen(false);
        setSentMsg("המייל נשלח בהצלחה");
      } else {
        setSentMsg("השליחה נכשלה — ראה פירוט בטבלה");
      }
      load();
    } finally {
      setSending(false);
    }
  }

  async function resend(row: LogRow) {
    setBusy(row.id);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/resend-email", {
        method: "POST", headers, body: JSON.stringify({ logId: row.id }),
      });
      const data = await res.json();
      setSentMsg(data.status === "sent" ? "המייל נשלח מחדש בהצלחה" : "השליחה החוזרת נכשלה");
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={{ padding: 0, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "1rem 1.2rem", borderBottom: "1px solid var(--line, #eef0f4)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mail size={18} color="#107a5e" />
          <strong style={{ fontSize: "1rem" }}>תכתובת מייל</strong>
          {rows.length > 0 && (
            <span style={{ fontSize: ".8rem", color: "#7a8699" }}>({rows.length} הודעות)</span>
          )}
        </div>
        {memberEmail
          ? <Button onClick={() => setOpen(o => !o)}><Send size={15} />{open ? "סגור" : "שלח מייל"}</Button>
          : <span style={{ fontSize: ".82rem", color: "#a08b10", background: "#fef9e7", border: "1px solid #f0d060", borderRadius: 7, padding: "0.35rem 0.7rem" }}>
              אין כתובת מייל בכרטיס החבר — הוסף כדי לשלוח
            </span>}
      </div>

      {sentMsg && (
        <div style={{ padding: "0.6rem 1.2rem", fontSize: ".87rem", fontWeight: 600, color: sentMsg.includes("נכשל") ? "#d64545" : "#107a5e" }}>
          {sentMsg.includes("נכשל") ? "✕" : "✓"} {sentMsg}
        </div>
      )}

      {/* טופס שליחה */}
      {open && memberEmail && (
        <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid var(--line, #eef0f4)", background: "#fafbfc", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: ".82rem", color: "#7a8699" }}>
            אל: <strong dir="ltr">{memberEmail}</strong> ({memberName})
          </div>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="נושא" style={field} />
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6}
            placeholder="תוכן ההודעה… (שורה חדשה מתחילה פסקה חדשה)"
            style={{ ...field, resize: "vertical", lineHeight: 1.6 }} />
          <div>
            <Button onClick={send} disabled={sending}>
              <Send size={15} />{sending ? "שולח…" : "שליחה"}
            </Button>
          </div>
        </div>
      )}

      {/* היסטוריה */}
      <div style={{ padding: rows.length ? 0 : "1rem 1.2rem" }}>
        {loadError ? (
          <div style={{ padding: "1rem 1.2rem", fontSize: ".85rem", color: "#d64545" }}>
            שגיאה בטעינת התכתובת: {loadError}
          </div>
        ) : loading ? (
          <div style={{ padding: "1rem 1.2rem", fontSize: ".85rem", color: "#7a8699" }}>טוען…</div>
        ) : rows.length === 0 ? (
          <Empty text="עדיין לא נשלחו מיילים לחבר זה" icon={<Mail size={34} />} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem" }}>
              <thead>
                <tr style={{ textAlign: "right", color: "#7a8699", fontSize: ".78rem" }}>
                  <th style={th}>תאריך</th>
                  <th style={th}>סוג</th>
                  <th style={th}>נושא</th>
                  <th style={th}>סטטוס</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef0f4" }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{eventLabel(r.event)}</td>
                    <td style={{ ...td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {r.status === "sent"
                        ? <span style={{ color: "#107a5e", display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={15} /> נשלח</span>
                        : <span style={{ color: "#d64545", display: "inline-flex", alignItems: "center", gap: 4 }} title={r.error || ""}><XCircle size={15} /> נכשל</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => setPreview(r)} title="צפייה במייל" style={iconBtn}><Eye size={16} /></button>
                      {r.status === "failed" && (
                        <button onClick={() => resend(r)} disabled={busy === r.id} title="שלח שוב" style={iconBtn}>
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
      </div>

      {/* תצוגה מקדימה */}
      {preview && (
        <div onClick={e => { if (e.target === e.currentTarget) setPreview(null); }} style={overlay}>
          <div style={{ background: "#fff", borderRadius: 16, width: "min(640px, 94vw)", maxHeight: "90vh", overflow: "hidden", boxShadow: "0 18px 50px rgba(7,30,22,.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.2rem", borderBottom: "1px solid #eef0f4" }}>
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

const field: CSSProperties = {
  padding: "0.6rem 0.85rem", borderRadius: 10, border: "1px solid #dce1e8",
  fontSize: ".92rem", width: "100%", background: "#fff", color: "inherit", boxSizing: "border-box",
};

const iconBtn: CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 5,
  color: "#7a8699", borderRadius: 7,
};

const th: CSSProperties = { padding: "8px 12px", fontWeight: 700 };
const td: CSSProperties = { padding: "9px 12px" };

const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(10,20,16,.45)", zIndex: 1200,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
