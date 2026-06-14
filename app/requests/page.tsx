"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ils, gdate, toHebrewDate } from "@/lib/format";
import { PageTitle, Loading, Empty, Badge } from "@/components/ui";
import type { ChangeRequest, MemberRequest } from "@/types";

const BRAND = "#1e6f5c";
const RED = "#c0392b";

const REQ_TYPE_LABEL: Record<string, string> = { message: "פנייה / הודעה", loan: "בקשת הלוואה", deposit_refund: "בקשת החזר פיקדון" };
const REQ_STATUS_LABEL: Record<string, string> = { open: "פתוח", in_progress: "בטיפול", done: "טופל", rejected: "נדחה" };
const STATUS_COLOR: Record<string, string> = { open: "#f59e0b", in_progress: "#3b82f6", done: BRAND, rejected: RED, pending: "#f59e0b", approved: BRAND };

function fieldLabel(k: string) {
  return ({ amount: "סכום", type: "סוג", method: "אופן", greg_date: "תאריך לועזי", heb_date: "תאריך עברי", notes: "הערות" } as Record<string, string>)[k] || k;
}

export default function RequestsPage() {
  const [tab, setTab] = useState<"changes" | "loans" | "requests">("changes");
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [c, r] = await Promise.all([
      supabase.from("transaction_change_requests").select("*, members(name)").order("created_at", { ascending: false }),
      supabase.from("member_requests").select("*, members(name)").order("created_at", { ascending: false }),
    ]);
    setChanges((c.data as ChangeRequest[]) || []);
    setRequests((r.data as MemberRequest[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function applyChange(cr: ChangeRequest) {
    if (!confirm("לאשר ולהחיל את השינוי המבוקש?")) return;
    setBusy(cr.id);
    let err = null;
    const p = cr.proposed || {};
    if (cr.kind === "edit" && cr.transaction_id) {
      ({ error: err } = await supabase.from("transactions").update({
        amount: p.amount, type: p.type, method: p.method ?? null,
        greg_date: p.greg_date ?? null, heb_date: p.heb_date ?? null, notes: p.notes ?? null,
      }).eq("id", cr.transaction_id));
    } else if (cr.kind === "add") {
      ({ error: err } = await supabase.from("transactions").insert({
        member_id: cr.member_id, amount: p.amount, type: p.type || "הפקדה", method: p.method ?? null,
        greg_date: p.greg_date ?? null, heb_date: p.heb_date ?? null, notes: p.notes ?? null,
      }));
    } else if (cr.kind === "delete" && cr.transaction_id) {
      ({ error: err } = await supabase.from("transactions").delete().eq("id", cr.transaction_id));
    }
    if (err) { setBusy(null); alert("שגיאה בהחלת השינוי: " + err.message); return; }
    await supabase.from("transaction_change_requests").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", cr.id);
    setBusy(null);
    load();
  }

  async function rejectChange(cr: ChangeRequest) {
    const note = prompt("סיבת הדחייה (אופציונלי):") ?? "";
    setBusy(cr.id);
    await supabase.from("transaction_change_requests").update({ status: "rejected", admin_note: note || null, resolved_at: new Date().toISOString() }).eq("id", cr.id);
    setBusy(null);
    load();
  }

  async function approveLoan(r: MemberRequest) {
    const amountStr = prompt(`סכום אישור ההלוואה (ברירת מחדל: ${r.amount || 0} ₪):`, String(r.amount || 0));
    if (amountStr === null) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) { alert("סכום לא תקין"); return; }
    setBusy(r.id);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("transactions").insert({
      member_id: r.member_id,
      amount,
      type: "משיכה",
      category: "loan",
      greg_date: today,
      heb_date: toHebrewDate(today),
      notes: `הלוואה מאושרת${r.body ? ` — ${r.body}` : ""}`,
    });
    if (error) { setBusy(null); alert("שגיאה ביצירת הפעולה: " + error.message); return; }
    await supabase.from("member_requests").update({
      status: "done",
      admin_note: `ההלוואה אושרה בסכום ${ils(amount)}.`,
      resolved_at: new Date().toISOString(),
    }).eq("id", r.id);
    setBusy(null);
    load();
  }

  async function rejectLoan(r: MemberRequest) {
    const note = prompt("סיבת הדחייה (תשובה תוצג לחבר):", "") ?? "";
    setBusy(r.id);
    await supabase.from("member_requests").update({
      status: "rejected",
      admin_note: note || null,
      resolved_at: new Date().toISOString(),
    }).eq("id", r.id);
    setBusy(null);
    load();
  }

  async function setReqStatus(r: MemberRequest, status: string) {
    setBusy(r.id);
    const note = status === "rejected"
      ? (prompt("סיבת הדחייה / תשובה לחבר (אופציונלי):", r.admin_note || "") ?? r.admin_note ?? "")
      : r.admin_note;
    await supabase.from("member_requests").update({
      status, admin_note: note || null,
      resolved_at: status === "done" || status === "rejected" ? new Date().toISOString() : null,
    }).eq("id", r.id);
    setBusy(null);
    load();
  }

  // שמירת תשובה לחבר (ללא שינוי סטטוס) — החבר רואה אותה בפורטל האישי
  async function saveReply(r: MemberRequest, text: string) {
    setBusy(r.id);
    await supabase.from("member_requests").update({ admin_note: text.trim() || null }).eq("id", r.id);
    setBusy(null);
    load();
  }

  if (loading) return <Loading />;

  const pendingChanges = changes.filter(c => c.status === "pending").length;
  const openLoans = requests.filter(r => r.type === "loan" && r.status === "open").length;
  const openOtherReqs = requests.filter(r => r.type !== "loan" && r.status === "open").length;
  const loanRequests = requests.filter(r => r.type === "loan");
  const otherRequests = requests.filter(r => r.type !== "loan");

  return (
    <div>
      <PageTitle>בקשות חברים</PageTitle>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <TabBtn active={tab === "changes"} onClick={() => setTab("changes")} label={`תיקוני פעולות${pendingChanges ? ` (${pendingChanges})` : ""}`} />
        <TabBtn active={tab === "loans"} onClick={() => setTab("loans")} label={`💳 בקשות הלוואה${openLoans ? ` (${openLoans})` : ""}`} />
        <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} label={`פניות ובקשות${openOtherReqs ? ` (${openOtherReqs})` : ""}`} />
      </div>

      {tab === "changes" && (
        changes.length === 0 ? <Empty text="אין בקשות תיקון" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {changes.map(cr => (
              <div key={cr.id} style={cardStyle(cr.status)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 800, color: "#1a1a2e" }}>
                    {cr.members?.name || "—"} · {cr.kind === "edit" ? "תיקון פעולה" : cr.kind === "add" ? "הוספת פעולה" : "מחיקת פעולה"}
                  </div>
                  <span style={{ ...pill, background: STATUS_COLOR[cr.status] }}>{cr.status === "pending" ? "ממתין" : cr.status === "approved" ? "אושר" : "נדחה"}</span>
                </div>
                {cr.proposed && cr.kind !== "delete" && (
                  <div style={{ fontSize: ".85rem", color: "#4a5568", marginTop: 6, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
                    {Object.entries(cr.proposed).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => (
                      <span key={k}><b style={{ color: "#7a8699" }}>{fieldLabel(k)}:</b> {k === "amount" ? ils(Number(v)) : k === "greg_date" ? gdate(String(v)) : String(v)}</span>
                    ))}
                  </div>
                )}
                {cr.document_url && <DocPreview path={cr.document_url} />}
                {cr.member_note && <div style={{ fontSize: ".82rem", color: "#7a8699", marginTop: 6 }}>הערת החבר: {cr.member_note}</div>}
                {cr.admin_note && <div style={{ fontSize: ".82rem", color: RED, marginTop: 4 }}>הערת מנהל: {cr.admin_note}</div>}
                <div style={{ fontSize: ".72rem", color: "#b0bac7", marginTop: 6 }}>{new Date(cr.created_at).toLocaleString("he-IL")}</div>
                {cr.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => applyChange(cr)} disabled={busy === cr.id} style={btn(BRAND)}>✓ אשר והחל</button>
                    <button onClick={() => rejectChange(cr)} disabled={busy === cr.id} style={btn("#fde8e8", RED)}>דחה</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === "loans" && (
        loanRequests.length === 0 ? <Empty text="אין בקשות הלוואה" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loanRequests.map(r => (
              <div key={r.id} style={cardStyle(r.status)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 800, color: "#1a1a2e", fontSize: "1rem" }}>
                    💳 {r.members?.name || "—"}{r.amount ? ` · ${ils(r.amount)}` : ""}
                  </div>
                  <span style={{ ...pill, background: STATUS_COLOR[r.status] }}>{REQ_STATUS_LABEL[r.status]}</span>
                </div>
                {r.body && <div style={{ fontSize: ".88rem", color: "#4a5568", marginTop: 6, whiteSpace: "pre-wrap" }}>מטרה: {r.body}</div>}
                {r.document_url && <DocPreview path={r.document_url} />}
                {r.admin_note && (
                  <div style={{ marginTop: 8, background: r.status === "done" ? "#eef6f3" : "#fde8e8", borderInlineStart: `3px solid ${r.status === "done" ? BRAND : RED}`, borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: ".85rem", color: "#1a1a2e" }}>
                    {r.admin_note}
                  </div>
                )}
                <div style={{ fontSize: ".72rem", color: "#b0bac7", marginTop: 6 }}>{new Date(r.created_at).toLocaleString("he-IL")}</div>
                {r.status === "open" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => approveLoan(r)} disabled={busy === r.id} style={btn(BRAND)}>✓ אשר ויצור משיכה</button>
                    <button onClick={() => rejectLoan(r)} disabled={busy === r.id} style={btn("#fde8e8", RED)}>דחה</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === "requests" && (
        otherRequests.length === 0 ? <Empty text="אין פניות" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {otherRequests.map(r => (
              <div key={r.id} style={cardStyle(r.status)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 800, color: "#1a1a2e" }}>
                    {r.members?.name || "—"} · {REQ_TYPE_LABEL[r.type]}{r.amount ? ` · ${ils(r.amount)}` : ""}
                  </div>
                  <span style={{ ...pill, background: STATUS_COLOR[r.status] }}>{REQ_STATUS_LABEL[r.status]}</span>
                </div>
                {r.subject && <div style={{ fontWeight: 700, marginTop: 6 }}>{r.subject}</div>}
                {r.body && <div style={{ fontSize: ".88rem", color: "#4a5568", marginTop: 4, whiteSpace: "pre-wrap" }}>{r.body}</div>}
                <div style={{ fontSize: ".72rem", color: "#b0bac7", marginTop: 6 }}>{new Date(r.created_at).toLocaleString("he-IL")}</div>
                <ReplyBox initial={r.admin_note || ""} busy={busy === r.id} onSave={(t) => saveReply(r, t)} />
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {r.status !== "in_progress" && r.status !== "done" && <button onClick={() => setReqStatus(r, "in_progress")} disabled={busy === r.id} style={btn("#e8f0fe", "#3b82f6")}>סמן בטיפול</button>}
                  {r.status !== "done" && <button onClick={() => setReqStatus(r, "done")} disabled={busy === r.id} style={btn(BRAND)}>✓ טופל</button>}
                  {r.status !== "rejected" && <button onClick={() => setReqStatus(r, "rejected")} disabled={busy === r.id} style={btn("#fde8e8", RED)}>דחה</button>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// תצוגה מקדימה מוטמעת של מסמך התיעוד (תמונה / PDF) + הגדלה במודאל
function DocPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const isPdf = /\.pdf(\?|$)/i.test(path);

  useEffect(() => {
    let active = true;
    supabase.storage.from("member-docs").createSignedUrl(path, 3600).then(({ data }) => {
      if (active && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: ".78rem", color: "#7a8699", fontWeight: 700, marginBottom: 4 }}>📎 מסמך התיעוד</div>
      {!url ? (
        <div style={{ fontSize: ".8rem", color: "#9aa5b5" }}>טוען תצוגה מקדימה…</div>
      ) : (
        <button onClick={() => setBig(true)} title="הגדל" style={{ padding: 0, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#f8fafc", cursor: "zoom-in", lineHeight: 0 }}>
          {isPdf
            ? <iframe src={url} title="מסמך התיעוד" style={{ width: 240, height: 170, border: "none", pointerEvents: "none" }} />
            : <img src={url} alt="מסמך התיעוד" style={{ maxWidth: 240, maxHeight: 170, display: "block", objectFit: "cover" }} />}
        </button>
      )}

      {big && url && (
        <div onClick={e => { if (e.target === e.currentTarget) setBig(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 10, maxWidth: "94vw", maxHeight: "94vh", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
              <a href={url} target="_blank" rel="noreferrer" style={{ color: BRAND, fontWeight: 700, fontSize: ".85rem", textDecoration: "none" }}>פתח בכרטיסייה חדשה ↗</a>
              <button onClick={() => setBig(false)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#9aa5b5", lineHeight: 1 }}>✕</button>
            </div>
            {isPdf
              ? <iframe src={url} title="מסמך התיעוד" style={{ width: "84vw", height: "82vh", border: "none" }} />
              : <img src={url} alt="מסמך התיעוד" style={{ maxWidth: "90vw", maxHeight: "82vh", objectFit: "contain", display: "block" }} />}
          </div>
        </div>
      )}
    </div>
  );
}

// תיבת תשובה לחבר (הגבאי כותב — החבר רואה בפורטל)
function ReplyBox({ initial, busy, onSave }: { initial: string; busy: boolean; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  useEffect(() => { setText(initial); }, [initial]);
  const changed = text.trim() !== initial.trim();
  return (
    <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 10, padding: "0.6rem 0.75rem" }}>
      <label style={{ fontSize: ".78rem", color: "#7a8699", fontWeight: 700, display: "block", marginBottom: 4 }}>תשובה לחבר {initial && <span style={{ color: BRAND }}>· נשלחה תשובה</span>}</label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="כתוב כאן תשובה שהחבר יראה בפורטל האישי…"
        style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.7rem", border: "1.5px solid #d8dde5", borderRadius: 8, fontSize: ".85rem", resize: "vertical", fontFamily: "inherit", direction: "rtl" }} />
      <button onClick={() => onSave(text)} disabled={busy || !changed} style={{ ...btn(changed ? BRAND : "#cbd5e0"), marginTop: 6, cursor: changed && !busy ? "pointer" : "default" }}>
        {initial ? "עדכן תשובה" : "שלח תשובה"}
      </button>
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ padding: "0.5rem 1.2rem", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 700, fontSize: ".9rem", background: active ? BRAND : "#eef2f1", color: active ? "#fff" : "#7a8699" }}>{label}</button>
  );
}

const pill: React.CSSProperties = { color: "#fff", borderRadius: 999, padding: "0.15rem 0.7rem", fontSize: ".78rem", fontWeight: 700 };
function cardStyle(status: string): React.CSSProperties {
  return { background: "#fff", borderRadius: 14, padding: "1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,.06)", borderInlineStart: `4px solid ${STATUS_COLOR[status] || "#ccc"}` };
}
function btn(bg: string, color = "#fff"): React.CSSProperties {
  return { padding: "0.45rem 1rem", background: bg, color, border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer" };
}
