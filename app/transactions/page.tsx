"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ils, gdate, toHebrewDate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { Card, PageTitle, Button, Badge, Loading, Empty, SuccessPopup } from "@/components/ui";
import DatePicker from "@/components/DatePicker";
import type { Transaction, Member, MemberBalance } from "@/types";
import { archiveTransactions } from "@/lib/archive";

type Row = Transaction & { members: { name: string } | null };

function MemberCombobox({ members, value, onChange }: {
  members: Member[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() =>
    members.filter(m => m.name.includes(q.trim())).slice(0, 30),
    [members, q]
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(name: string) {
    setQ(name);
    onChange(name);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{ ...inp, width: "100%", boxSizing: "border-box" }}
        placeholder="הקלד שם חבר…"
        autoComplete="off"
        autoFocus
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0,
          background: "#fff", border: "1.5px solid #d8dde5", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 100,
          maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map(m => (
            <div key={m.id}
              onMouseDown={() => select(m.name)}
              style={{
                padding: "0.55rem 0.85rem", cursor: "pointer", fontSize: ".9rem",
                borderBottom: "1px solid #f0f2f5",
                transition: "background .1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f4faf8")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              {m.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ title: string; lines: [string, string][] } | null>(null);

  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("");
  const [methodF, setMethodF] = useState("");

  const [form, setForm] = useState({
    memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", subtype: "",
  });

  // החבר הנבחר (לפי שם) — לצורך זיהוי יתרת חיסכון בעת משיכה
  const selectedMember = useMemo(
    () => members.find(m => m.name === form.memberName.trim()) || null,
    [members, form.memberName]
  );
  const selMemberSavings = selectedMember?.savings_balance ?? 0;

  async function load() {
    const [t, m] = await Promise.all([
      supabase.from("transactions").select("*, members(name)").order("created_at", { ascending: false }),
      supabase.from("member_balances").select("*").order("name"),
    ]);
    setRows((t.data as Row[]) || []);
    setMembers((m.data as MemberBalance[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // סגירת חלונית ההצלחה אוטומטית אחרי ~2 שניות
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2300);
    return () => clearTimeout(id);
  }, [toast]);

  const closeModal = useCallback(() => {
    setAdding(false);
    setFormErr({});
    setForm({ memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", subtype: "" });
  }, []);

  function setGregDate(val: string) {
    setForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) }));
  }
  function setEditGregDate(val: string) {
    setEditForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) }));
  }

  function openEdit(r: Row) {
    setEditing(r);
    setEditForm({
      amount: String(r.amount), type: r.type,
      method: r.method || "", greg_date: r.greg_date?.split("T")[0] || "",
      heb_date: r.heb_date || "", notes: r.notes || "",
    });
  }

  async function addTxn() {
    const errs: Record<string, string> = {};
    const member = members.find(m => m.name === form.memberName.trim());
    if (!member) errs.member = "יש לבחור חבר קיים";
    const amt = Number(form.amount);
    if (!amt || amt <= 0) errs.amount = "יש להזין סכום חיובי";
    if (!form.method) errs.method = "שדה חובה";
    if (!form.greg_date) errs.date = "יש לבחור תאריך";
    setFormErr(errs);
    if (Object.keys(errs).length > 0) return;

    // סיווג: משיכה = הלוואה/החזר פיקדון (לפי בחירה), הפקדה = פיקדון
    const savings = (member as MemberBalance)?.savings_balance ?? 0;
    const effectiveSubtype = form.subtype || (savings > 0 ? "refund" : "loan");
    const category = form.type === "משיכה" ? effectiveSubtype : "deposit";

    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      member_id: member!.id, amount: amt, type: form.type,
      method: form.method || null, greg_date: form.greg_date || null,
      heb_date: form.heb_date || null, notes: form.notes || null, category,
    });
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    const summary: { title: string; lines: [string, string][] } = {
      title: "הפעולה נשמרה בהצלחה",
      lines: [
        ["חבר", member!.name],
        ["סוג", form.type === "משיכה" ? `משיכה · ${effectiveSubtype === "refund" ? "החזר פיקדון" : "הלוואה"}` : form.type],
        ["סכום", ils(amt)],
        ["אופן", form.method],
        ["תאריך", form.heb_date || gdate(form.greg_date)],
        ...(form.notes ? [["הערות", form.notes] as [string, string]] : []),
      ],
    };
    closeModal();
    setToast(summary);
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("transactions").update({
      amount: Number(editForm.amount), type: editForm.type,
      method: editForm.method || null, greg_date: editForm.greg_date || null,
      heb_date: editForm.heb_date || null, notes: editForm.notes || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setEditing(null);
    load();
  }

  async function deleteTxn(id: string) {
    setDeleting(id);
    const row = rows.find(r => r.id === id);
    if (row) await archiveTransactions([row]);
    await supabase.from("transactions").delete().eq("id", id);
    setDeleting(null);
    load();
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (typeF && r.type !== typeF) return false;
    if (methodF && r.method !== methodF) return false;
    if (q.trim()) {
      const hay = `${r.members?.name || ""} ${r.notes || ""} ${r.heb_date || ""}`;
      if (!hay.includes(q.trim())) return false;
    }
    return true;
  }), [rows, q, typeF, methodF]);

  const totals = useMemo(() => {
    let dep = 0, wit = 0;
    filtered.forEach(r => r.type === "הפקדה" ? (dep += r.amount) : (wit += r.amount));
    return { dep, wit, net: dep - wit };
  }, [filtered]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle action={<Button onClick={() => setAdding(true)}>+ פעולה חדשה</Button>}>
        פעולות ({filtered.length})
      </PageTitle>

      {/* מודאל הוספה */}
      {adding && (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }} style={overlay}>
          <div style={modalBox}>
            <div style={modalHeader}>
              <h2 style={modalTitle}>+ פעולה חדשה</h2>
              <button onClick={closeModal} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>חבר <Req /></label>
                <MemberCombobox members={members} value={form.memberName} onChange={v => setForm(f => ({ ...f, memberName: v }))} />
                {formErr.member && <Err>{formErr.member}</Err>}
              </div>
              <div>
                <label style={lbl}>סוג <Req /></label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪ <Req /></label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box", borderColor: formErr.amount ? "#e05252" : undefined }} placeholder="0" />
                {formErr.amount && <Err>{formErr.amount}</Err>}
              </div>
              <div>
                <label style={lbl}>אופן <Req /></label>
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box", borderColor: formErr.method ? "#e05252" : undefined }}>
                  <option value="">— בחר —</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
                {formErr.method && <Err>{formErr.method}</Err>}
              </div>
              {form.type === "משיכה" && (
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>סיווג המשיכה <Req /></label>
                  {selectedMember && selMemberSavings > 0 && (
                    <div style={{ fontSize: ".78rem", background: "#f0faf6", border: "1px solid #c6e9d8", borderRadius: 7, padding: "0.35rem 0.6rem", marginBottom: 6, color: "#1e6f5c" }}>
                      יתרת חיסכון לחבר: <strong>{ils(selMemberSavings)}</strong> — ברירת מחדל: משיכת פיקדון
                    </div>
                  )}
                  <select
                    value={form.subtype || (selMemberSavings > 0 ? "refund" : "loan")}
                    onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))}
                    style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                    <option value="refund">משיכת פיקדון (החזר חיסכון)</option>
                    <option value="loan">הלוואה חדשה</option>
                  </select>
                </div>
              )}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>תאריך <Req /></label>
                <DatePicker value={form.greg_date} onChange={setGregDate} error={!!formErr.date} />
                {form.heb_date && (
                  <div style={{ marginTop: 5, fontSize: ".82rem", color: "#1e6f5c", fontWeight: 600 }}>
                    תאריך עברי: {form.heb_date}
                  </div>
                )}
                {formErr.date && <Err>{formErr.date}</Err>}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }} placeholder="אופציונלי…" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <Button onClick={addTxn} disabled={saving}>{saving ? "שומר…" : "✓ שמור פעולה"}</Button>
              <Button variant="ghost" onClick={closeModal}>ביטול</Button>
            </div>
          </div>
        </div>
      )}

      {/* סינון */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="🔍 חיפוש…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, flex: 1, minWidth: 180 }} />
          <select value={typeF} onChange={e => setTypeF(e.target.value)} style={inp}>
            <option value="">כל הסוגים</option>
            {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={methodF} onChange={e => setMethodF(e.target.value)} style={inp}>
            <option value="">כל האופנים</option>
            {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: ".9rem" }}>
          <span>הפקדות: <strong style={{ color: "#1e7d4f" }}>{ils(totals.dep)}</strong></span>
          <span>משיכות: <strong style={{ color: "#c0392b" }}>{ils(totals.wit)}</strong></span>
          <span>נטו: <strong style={{ color: "var(--brand)" }}>{ils(totals.net)}</strong></span>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        {filtered.length === 0 ? <Empty text="לא נמצאו פעולות" /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>חבר</th><th>סוג</th><th>סכום</th><th>אופן</th><th>תאריך</th><th>הערות</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>{r.members?.name || "—"}</td>
                    <td><Badge type={r.type} /></td>
                    <td style={{ fontWeight: 600, color: r.type === "משיכה" ? "#c0392b" : "#1e7d4f" }}>
                      {r.type === "משיכה" ? "-" : "+"}{ils(r.amount)}
                    </td>
                    <td>{r.method || "—"}</td>
                    <td>{r.heb_date || gdate(r.greg_date) || "—"}</td>
                    <td style={{ color: "#7a8699", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes}</td>
                    <td>
                      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                        <IconBtn title="צפייה" color="#3b82f6" onClick={() => setViewing(r)}><Eye size={15} /></IconBtn>
                        <IconBtn title="עריכה" color="#f59e0b" onClick={() => openEdit(r)}><Pencil size={15} /></IconBtn>
                        <IconBtn title="מחיקה" color="#e05252" disabled={deleting === r.id}
                          onClick={() => { if (confirm(`למחוק פעולה של ${r.members?.name || ""}?`)) deleteTxn(r.id); }}>
                          <Trash2 size={15} />
                        </IconBtn>
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
        <div onClick={e => { if (e.target === e.currentTarget) setViewing(null); }} style={overlay}>
          <div style={modalBox}>
            <div style={modalHeader}>
              <h2 style={{ ...modalTitle, color: "#3b82f6" }}>פרטי פעולה</h2>
              <button onClick={() => setViewing(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem 1.5rem" }}>
              {([["חבר", viewing.members?.name || "—"], ["סוג", viewing.type], ["סכום", ils(viewing.amount)],
                ["אופן", viewing.method || "—"], ["תאריך עברי", viewing.heb_date || "—"], ["תאריך לועזי", gdate(viewing.greg_date) || "—"]] as [string,string][]).map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: ".73rem", color: "#9aa5b5", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                </div>
              ))}
              {viewing.notes && (
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={{ fontSize: ".73rem", color: "#9aa5b5", marginBottom: 2 }}>הערות</div>
                  <div>{viewing.notes}</div>
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
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null); }} style={overlay}>
          <div style={modalBox}>
            <div style={modalHeader}>
              <h2 style={{ ...modalTitle, color: "#f59e0b" }}>עריכת פעולה</h2>
              <button onClick={() => setEditing(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ fontSize: ".82rem", color: "#7a8699", marginBottom: "1rem" }}>
              חבר: <strong style={{ color: "#1a1a2e" }}>{editing.members?.name || "—"}</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={lbl}>סוג</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪</label>
                <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={lbl}>אופן</label>
                <select value={editForm.method} onChange={e => setEditForm(f => ({ ...f, method: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>תאריך</label>
                <DatePicker value={editForm.greg_date} onChange={setEditGregDate} />
                {editForm.heb_date && <div style={{ fontSize: ".78rem", color: "#1e6f5c", marginTop: 4 }}>{editForm.heb_date}</div>}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={saveEdit} disabled={saving} style={saveBtnStyle}>{saving ? "שומר…" : "✓ שמור שינויים"}</button>
              <button onClick={() => setEditing(null)} style={ghostBtnStyle}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* חלונית הצלחה במרכז המסך */}
      {toast && <SuccessPopup title={toast.title} lines={toast.lines} onClose={() => setToast(null)} />}
    </div>
  );
}

function Req() { return <span style={{ color: "#e05252", marginRight: 2 }}>*</span>; }
function Err({ children }: { children: string }) {
  return <div style={{ fontSize: ".75rem", color: "#e05252", marginTop: 3 }}>{children}</div>;
}
function IconBtn({ children, title, color, onClick, disabled }: {
  children: React.ReactNode; title: string; color: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{
      background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer",
      color, padding: "0.25rem", borderRadius: 6, display: "flex", alignItems: "center",
      opacity: disabled ? 0.4 : 0.8, transition: "opacity .1s",
    }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "1")}
      onMouseLeave={e => !disabled && (e.currentTarget.style.opacity = "0.8")}
    >{children}</button>
  );
}

const inp: React.CSSProperties = { padding: "0.5rem 0.75rem", border: "1.5px solid #d8dde5", borderRadius: 8, fontSize: ".9rem" };
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" };
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 500, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" };
const modalTitle: React.CSSProperties = { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#1e6f5c" };
const closeBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" };
const saveBtnStyle: React.CSSProperties = { padding: "0.55rem 1.2rem", background: "#1e6f5c", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" };
const ghostBtnStyle: React.CSSProperties = { padding: "0.55rem 1.2rem", background: "#eef2f1", color: "#1e6f5c", border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer" };
