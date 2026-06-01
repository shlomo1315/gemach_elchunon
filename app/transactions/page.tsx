"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ils, gdate, toHebrewDate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { Card, PageTitle, Button, Badge, Loading, Empty } from "@/components/ui";
import type { Transaction, Member } from "@/types";

type Row = Transaction & { members: { name: string } | null };

export default function TransactionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  const [deleting, setDeleting] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("");
  const [methodF, setMethodF] = useState("");

  const [form, setForm] = useState({
    memberName: "",
    amount: "",
    type: "הפקדה",
    method: "",
    greg_date: "",
    heb_date: "",
    notes: "",
  });

  function setGregDate(val: string) {
    setForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) }));
  }

  async function load() {
    const [t, m] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, members(name)")
        .order("created_at", { ascending: false }),
      supabase.from("members").select("*").order("name"),
    ]);
    setRows((t.data as Row[]) || []);
    setMembers((m.data as Member[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeF && r.type !== typeF) return false;
      if (methodF && r.method !== methodF) return false;
      if (q.trim()) {
        const s = q.trim();
        const hay = `${r.members?.name || ""} ${r.notes || ""} ${r.heb_date || ""}`;
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, q, typeF, methodF]);

  const totals = useMemo(() => {
    let dep = 0,
      wit = 0;
    filtered.forEach((r) => (r.type === "הפקדה" ? (dep += r.amount) : (wit += r.amount)));
    return { dep, wit, net: dep - wit };
  }, [filtered]);

  const closeModal = useCallback(() => {
    setAdding(false);
    setForm({ memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  }, []);

  function openEdit(r: Row) {
    setEditing(r);
    setEditForm({
      amount: String(r.amount),
      type: r.type,
      method: r.method || "",
      greg_date: r.greg_date?.split("T")[0] || "",
      heb_date: r.heb_date || "",
      notes: r.notes || "",
    });
  }

  function setEditGregDate(val: string) {
    setEditForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) }));
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("transactions").update({
      amount: Number(editForm.amount),
      type: editForm.type,
      method: editForm.method || null,
      greg_date: editForm.greg_date || null,
      heb_date: editForm.heb_date || null,
      notes: editForm.notes || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setEditing(null);
    load();
  }

  async function deleteTxn(id: string) {
    setDeleting(id);
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    setDeleting(null);
    if (error) { alert("שגיאה: " + error.message); return; }
    load();
  }

  async function addTxn() {
    const member = members.find((m) => m.name === form.memberName.trim());
    if (!member) {
      alert("יש לבחור חבר קיים מהרשימה");
      return;
    }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      alert("יש להזין סכום חיובי");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      member_id: member.id,
      amount: amt,
      type: form.type,
      method: form.method || null,
      greg_date: form.greg_date || null,
      heb_date: form.heb_date || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) {
      alert("שגיאה: " + error.message);
      return;
    }
    closeModal();
    load();
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle
        action={
          <Button onClick={() => setAdding(true)}>+ פעולה חדשה</Button>
        }
      >
        פעולות ({filtered.length})
      </PageTitle>

      {adding && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div style={{
            background: "var(--card)",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            width: "100%", maxWidth: 520,
            padding: "1.75rem",
            direction: "rtl",
            animation: "modalIn 0.18s ease",
          }}>
            {/* כותרת */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--brand)" }}>
                ➕ פעולה חדשה
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", color: "#9aa5b5", lineHeight: 1 }}>✕</button>
            </div>

            {/* שדות בגריד 2 עמודות */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {/* חבר — רוחב מלא */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>👤 חבר</label>
                <input
                  list="members-list"
                  value={form.memberName}
                  onChange={(e) => setForm({ ...form, memberName: e.target.value })}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                  placeholder="הקלד שם חבר…"
                  autoFocus
                />
                <datalist id="members-list">
                  {members.map((m) => <option key={m.id} value={m.name} />)}
                </datalist>
              </div>

              {/* סוג */}
              <div>
                <label style={lbl}>📋 סוג</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                  {TXN_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* סכום */}
              <div>
                <label style={lbl}>💰 סכום ₪</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                  placeholder="0"
                />
              </div>

              {/* אופן */}
              <div>
                <label style={lbl}>💳 אופן</label>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                  <option value="">—</option>
                  {TXN_METHODS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* תאריך */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>📅 תאריך</label>
                <input
                  type="date"
                  value={form.greg_date}
                  onChange={(e) => setGregDate(e.target.value)}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                />
                {form.heb_date && (
                  <div style={{ marginTop: 6, fontSize: ".82rem", color: "#1e6f5c", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    ✡ תאריך עברי: {form.heb_date}
                  </div>
                )}
              </div>

              {/* הערות — רוחב מלא */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>📝 הערות</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                  placeholder="הערה אופציונלית…"
                />
              </div>
            </div>

            {/* כפתורים */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", marginTop: "1.5rem" }}>
              <Button onClick={addTxn} disabled={saving}>
                {saving ? "שומר…" : "✓ שמור פעולה"}
              </Button>
              <Button variant="ghost" onClick={closeModal}>ביטול</Button>
            </div>
          </div>
        </div>
      )}

      {/* סינון */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="🔍 חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inp, flex: 1, minWidth: 180 }} />
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={inp}>
            <option value="">כל הסוגים</option>
            {TXN_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={methodF} onChange={(e) => setMethodF(e.target.value)} style={inp}>
            <option value="">כל האופנים</option>
            {TXN_METHODS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: ".9rem" }}>
          <span>הפקדות: <strong style={{ color: "#1e7d4f" }}>{ils(totals.dep)}</strong></span>
          <span>משיכות: <strong style={{ color: "#c0392b" }}>{ils(totals.wit)}</strong></span>
          <span>נטו: <strong style={{ color: "var(--brand)" }}>{ils(totals.net)}</strong></span>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <Empty text="לא נמצאו פעולות" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>חבר</th>
                  <th>סוג</th>
                  <th>סכום</th>
                  <th>אופן</th>
                  <th>תאריך</th>
                  <th>הערות</th>
                  <th style={{ width: 100 }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.members?.name || "—"}</td>
                    <td><Badge type={r.type} /></td>
                    <td style={{ fontWeight: 600, color: r.type === "משיכה" ? "#c0392b" : "#1e7d4f" }}>
                      {r.type === "משיכה" ? "-" : "+"}{ils(r.amount)}
                    </td>
                    <td>{r.method || "—"}</td>
                    <td>{r.heb_date || gdate(r.greg_date) || "—"}</td>
                    <td style={{ color: "#7a8699", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {/* צפייה */}
                        <button title="צפייה" onClick={() => setViewing(r)} style={{ ...iconBtn, color: "#3b82f6" }}>
                          👁
                        </button>
                        {/* עריכה */}
                        <button title="עריכה" onClick={() => openEdit(r)} style={{ ...iconBtn, color: "#f59e0b" }}>
                          ✏️
                        </button>
                        {/* מחיקה */}
                        <button title="מחיקה" onClick={() => {
                          if (confirm(`למחוק את הפעולה של ${r.members?.name || ""}?`)) deleteTxn(r.id);
                        }} disabled={deleting === r.id} style={{ ...iconBtn, color: "#e05252" }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* מודאל צפייה */}
      {viewing && (
        <div onClick={e => { if (e.target === e.currentTarget) setViewing(null); }}
          style={overlay}>
          <div style={modalBox}>
            <div style={modalHeader}>
              <h2 style={modalTitle}>👁 פרטי פעולה</h2>
              <button onClick={() => setViewing(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem" }}>
              {[
                ["חבר", viewing.members?.name || "—"],
                ["סוג", viewing.type],
                ["סכום", ils(viewing.amount)],
                ["אופן", viewing.method || "—"],
                ["תאריך עברי", viewing.heb_date || "—"],
                ["תאריך לועזי", gdate(viewing.greg_date) || "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: ".75rem", color: "#9aa5b5", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                </div>
              ))}
              {viewing.notes && (
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={{ fontSize: ".75rem", color: "#9aa5b5", marginBottom: 2 }}>הערות</div>
                  <div style={{ fontWeight: 500 }}>{viewing.notes}</div>
                </div>
              )}
            </div>
            <div style={{ marginTop: "1.5rem" }}>
              <button onClick={() => setViewing(null)} style={ghostBtnStyle}>סגור</button>
            </div>
          </div>
        </div>
      )}

      {/* מודאל עריכה */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
          style={overlay}>
          <div style={modalBox}>
            <div style={modalHeader}>
              <h2 style={{ ...modalTitle, color: "#f59e0b" }}>✏️ עריכת פעולה</h2>
              <button onClick={() => setEditing(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ fontSize: ".82rem", color: "#7a8699", marginBottom: "1rem" }}>
              חבר: <strong style={{ color: "#1a1a2e" }}>{editing.members?.name || "—"}</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={lbl}>סוג</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" as const }}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪</label>
                <input type="number" value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={lbl}>אופן</label>
                <select value={editForm.method} onChange={e => setEditForm(f => ({ ...f, method: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" as const }}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>תאריך</label>
                <input type="date" value={editForm.greg_date}
                  onChange={e => setEditGregDate(e.target.value)}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" as const }} />
                {editForm.heb_date && (
                  <div style={{ fontSize: ".78rem", color: "#1e6f5c", marginTop: 4 }}>✡ {editForm.heb_date}</div>
                )}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" as const }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={saveEdit} disabled={saving} style={saveBtnStyle}>
                {saving ? "שומר…" : "✓ שמור שינויים"}
              </button>
              <button onClick={() => setEditing(null)} style={ghostBtnStyle}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "0.5rem 0.7rem",
  border: "1.5px solid #d8dde5",
  borderRadius: 8,
  fontSize: ".9rem",
};
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };
const iconBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "1rem", padding: "0.2rem 0.3rem", borderRadius: 6,
  opacity: 0.75, transition: "opacity .1s",
};
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "1rem", backdropFilter: "blur(2px)",
};
const modalBox: React.CSSProperties = {
  background: "#fff", borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,.2)",
  width: "100%", maxWidth: 480,
  padding: "1.75rem", direction: "rtl",
  animation: "modalIn 0.18s ease",
};
const modalHeader: React.CSSProperties = {
  display: "flex", justifyContent: "space-between",
  alignItems: "center", marginBottom: "1.25rem",
};
const modalTitle: React.CSSProperties = { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#1e6f5c" };
const closeBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" };
const saveBtnStyle: React.CSSProperties = {
  padding: "0.55rem 1.2rem", background: "#1e6f5c", color: "#fff",
  border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer",
};
const ghostBtnStyle: React.CSSProperties = {
  padding: "0.55rem 1.2rem", background: "#eef2f1", color: "#1e6f5c",
  border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer",
};

function Sel({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={lbl}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inp}>
        {options.map((o) => (
          <option key={o} value={o}>{o || "—"}</option>
        ))}
      </select>
    </div>
  );
}
