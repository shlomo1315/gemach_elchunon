"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ils, gdate } from "@/lib/format";
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
  const [tab, setTab] = useState<"changes" | "requests">("changes");
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

  async function setReqStatus(r: MemberRequest, status: string) {
    setBusy(r.id);
    const note = status === "rejected" ? (prompt("סיבת הדחייה (אופציונלי):") ?? "") : r.admin_note;
    await supabase.from("member_requests").update({
      status, admin_note: note || null,
      resolved_at: status === "done" || status === "rejected" ? new Date().toISOString() : null,
    }).eq("id", r.id);
    setBusy(null);
    load();
  }

  if (loading) return <Loading />;

  const pendingChanges = changes.filter(c => c.status === "pending").length;
  const openReqs = requests.filter(r => r.status === "open").length;

  return (
    <div>
      <PageTitle>בקשות חברים</PageTitle>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <TabBtn active={tab === "changes"} onClick={() => setTab("changes")} label={`תיקוני פעולות${pendingChanges ? ` (${pendingChanges})` : ""}`} />
        <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} label={`פניות ובקשות${openReqs ? ` (${openReqs})` : ""}`} />
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

      {tab === "requests" && (
        requests.length === 0 ? <Empty text="אין פניות" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.map(r => (
              <div key={r.id} style={cardStyle(r.status)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 800, color: "#1a1a2e" }}>
                    {r.members?.name || "—"} · {REQ_TYPE_LABEL[r.type]}{r.amount ? ` · ${ils(r.amount)}` : ""}
                  </div>
                  <span style={{ ...pill, background: STATUS_COLOR[r.status] }}>{REQ_STATUS_LABEL[r.status]}</span>
                </div>
                {r.subject && <div style={{ fontWeight: 700, marginTop: 6 }}>{r.subject}</div>}
                {r.body && <div style={{ fontSize: ".88rem", color: "#4a5568", marginTop: 4, whiteSpace: "pre-wrap" }}>{r.body}</div>}
                {r.admin_note && <div style={{ fontSize: ".82rem", color: RED, marginTop: 4 }}>הערת מנהל: {r.admin_note}</div>}
                <div style={{ fontSize: ".72rem", color: "#b0bac7", marginTop: 6 }}>{new Date(r.created_at).toLocaleString("he-IL")}</div>
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
