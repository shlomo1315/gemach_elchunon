"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ils } from "@/lib/format";
import { PageTitle, Button, Loading, Empty } from "@/components/ui";
import type { MemberBalance } from "@/types";

const BRAND = "#1e6f5c";
const RED = "#e05252";

const inp: React.CSSProperties = {
  padding: "0.55rem 0.8rem",
  border: "1.5px solid #d8dde5",
  borderRadius: 10,
  fontSize: ".9rem",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" };
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 480, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" };
const saveBtnStyle: React.CSSProperties = { padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" };
const ghostBtnStyle: React.CSSProperties = { padding: "0.55rem 1.2rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer" };

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ name }: { name: string }) {
  const colors = ["#1e6f5c","#2980b9","#8e44ad","#e67e22","#16a085","#c0392b","#d35400","#27ae60"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: colors[idx], color: "#fff", fontWeight: 700, fontSize: ".8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function IconBtn({ children, title, color, onClick, disabled }: {
  children: React.ReactNode; title: string; color: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean;
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{ background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer", color, padding: "0.25rem", borderRadius: 6, display: "flex", alignItems: "center", opacity: disabled ? 0.4 : 0.75, transition: "opacity .1s" }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "1")}
      onMouseLeave={e => !disabled && (e.currentTarget.style.opacity = "0.75")}
    >{children}</button>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "balance" | "txn_count">("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  // מודאלים
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<MemberBalance | null>(null);
  const [editing, setEditing] = useState<MemberBalance | null>(null);

  // טפסים
  const [addForm, setAddForm] = useState({ name: "", code: "", phone: "", address: "", email: "" });
  const [editForm, setEditForm] = useState({ name: "", code: "", phone: "", address: "", email: "" });
  const [addErr, setAddErr] = useState<Record<string, string>>({});
  const [editErr, setEditErr] = useState<Record<string, string>>({});
  // יצירת התחברות לחבר
  const [loginPass, setLoginPass] = useState("");
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");

  async function load() {
    const { data } = await supabase.from("member_balances").select("*").order("name");
    setMembers((data as MemberBalance[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const closeAdd = useCallback(() => {
    setAdding(false); setAddErr({});
    setAddForm({ name: "", code: "", phone: "", address: "", email: "" });
  }, []);

  function setAddPhone(val: string) {
    const digits = val.replace(/\D/g, "");
    if (digits.length > 10) return;
    const code = digits.length === 10 ? digits.slice(-4) : "";
    setAddForm(f => ({ ...f, phone: val, code }));
  }

  function setEditPhone(val: string) {
    const digits = val.replace(/\D/g, "");
    if (digits.length > 10) return;
    const code = digits.length === 10 ? digits.slice(-4) : editForm.code;
    setEditForm(f => ({ ...f, phone: val, code }));
  }

  function openEdit(m: MemberBalance) {
    setEditForm({ name: m.name || "", code: m.code || "", phone: m.phone || "", address: m.address || "", email: m.email || "" });
    setEditErr({});
    setLoginPass(""); setLoginMsg("");
    setEditing(m);
  }

  async function createLogin() {
    if (!editing) return;
    const email = editForm.email.trim().toLowerCase();
    if (!email) { setLoginMsg("יש להזין מייל לחבר תחילה"); return; }
    if (loginPass.length < 6) { setLoginMsg("סיסמה חייבת להיות לפחות 6 תווים"); return; }
    setCreatingLogin(true); setLoginMsg("");
    const { data, error } = await supabase.functions.invoke("dynamic-responder", {
      body: { email, password: loginPass, memberId: editing.id },
    });
    setCreatingLogin(false);
    if (error || (data && (data as any).error)) {
      setLoginMsg("שגיאה: " + (error?.message || (data as any)?.error || "נכשל"));
      return;
    }
    setLoginMsg("✓ חשבון ההתחברות נוצר בהצלחה");
    setLoginPass("");
    load();
  }

  const filtered = useMemo(() => {
    const s = q.trim();
    let list = s
      ? members.filter(m =>
          (m.name || "").includes(s) ||
          (m.code || "").includes(s) ||
          (m.phone || "").includes(s) ||
          (m.address || "").includes(s)
        )
      : [...members];
    list.sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (typeof av === "string") return sortDir * av.localeCompare(bv as string);
      return sortDir * ((av as number) - (bv as number));
    });
    return list;
  }, [q, members, sortBy, sortDir]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortBy(col); setSortDir(-1); }
  }

  const SortTh = ({ col, children }: { col: typeof sortBy; children: React.ReactNode }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {children}{sortBy === col ? (sortDir === 1 ? " ↑" : " ↓") : " ⇅"}
    </th>
  );

  async function addMember() {
    const errs: Record<string, string> = {};
    if (!addForm.name.trim()) errs.name = "יש להזין שם";
    if (!addForm.phone.trim()) errs.phone = "יש להזין טלפון";
    setAddErr(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    const code = addForm.phone.replace(/\D/g, "").slice(-4);
    const { error } = await supabase.from("members").insert({
      name: addForm.name.trim(),
      code: code || addForm.code.trim() || null,
      phone: addForm.phone.trim() || null,
      address: addForm.address.trim() || null,
      email: addForm.email.trim().toLowerCase() || null,
    });
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    closeAdd();
    load();
  }

  async function saveMember() {
    if (!editing) return;
    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = "יש להזין שם";
    if (!editForm.phone.trim()) errs.phone = "יש להזין טלפון";
    setEditErr(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    const { error } = await supabase.from("members").update({
      name: editForm.name.trim(),
      code: editForm.code.trim() || null,
      phone: editForm.phone.trim() || null,
      address: editForm.address.trim() || null,
      email: editForm.email.trim().toLowerCase() || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setEditing(null);
    load();
  }

  async function deleteMember(m: MemberBalance) {
    const msg = m.txn_count > 0
      ? `לחבר "${m.name}" יש ${m.txn_count} פעולות. האם למחוק בכל זאת?`
      : `למחוק את "${m.name}"?`;
    if (!confirm(msg)) return;
    setDeleting(m.id);
    await supabase.from("members").delete().eq("id", m.id);
    setDeleting(null);
    load();
  }

  const withBalance = members.filter(m => m.balance > 0).length;

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle action={<Button onClick={() => { setAddErr({}); setAdding(true); }}>+ חבר חדש</Button>}>
        חברים ({members.length})
      </PageTitle>

      {/* KPI */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { label: "סה״כ חברים", value: members.length, color: BRAND },
          { label: "עם יתרה חיובית", value: withBalance, color: "#2980b9" },
          { label: "ללא פעולות", value: members.filter(m => m.txn_count === 0).length, color: "#7a8699" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "0.7rem 1.1rem", border: `1.5px solid ${color}22`, flex: "1 1 120px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize: ".75rem", color: "#9aa5b5" }}>{label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* חיפוש */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "0.75rem 1rem", boxShadow: "0 1px 3px rgba(0,0,0,.06)", marginBottom: 12 }}>
        <input placeholder="🔍 חיפוש לפי שם / קוד / טלפון / כתובת…" value={q} onChange={e => setQ(e.target.value)}
          style={{ ...inp, border: "1.5px solid #e2e8f0", background: "#f8fafc" }} />
      </div>

      {/* טבלה */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <Empty text="לא נמצאו חברים" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f4f3" }}>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>שם ומשפחה</th>
                  <th style={{ padding: "0.7rem 0.75rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>קוד</th>
                  <th style={{ padding: "0.7rem 0.75rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>טלפון</th>
                  <th style={{ padding: "0.7rem 0.75rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>כתובת</th>
                  <SortTh col="txn_count"><span style={{ fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>פעולות</span></SortTh>
                  <SortTh col="balance"><span style={{ fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>יתרה</span></SortTh>
                  <th style={{ padding: "0.7rem 0.75rem", width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => router.push(`/members/${m.id}`)}
                    style={{ cursor: "pointer", transition: "background .1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f4faf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "0.65rem 1rem", borderBottom: "1px solid #f0f2f5", textAlign: "right" as const }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={m.name || "?"} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#1a1a2e" }}>{m.name || "—"}</div>
                          {m.address && <div style={{ fontSize: ".75rem", color: "#9aa5b5", marginTop: 1 }}>{m.address}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", textAlign: "right" as const, fontSize: ".85rem", color: "#4a5568" }}>{m.code || "—"}</td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", textAlign: "right" as const, fontSize: ".85rem" }} dir="ltr">{m.phone || "—"}</td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", textAlign: "right" as const, fontSize: ".82rem", color: "#7a8699" }}>{m.address || "—"}</td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", textAlign: "center" }}>
                      {m.txn_count > 0
                        ? <span style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 999, padding: "0.15rem 0.6rem", fontSize: ".8rem", fontWeight: 600 }}>{m.txn_count}</span>
                        : <span style={{ color: "#cbd5e0", fontSize: ".8rem" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", textAlign: "right" as const }}>
                      <span style={{ background: m.balance > 0 ? "#e3f6ec" : m.balance < 0 ? "#fde8e8" : "#f0f4f3", color: m.balance > 0 ? BRAND : m.balance < 0 ? "#c0392b" : "#7a8699", borderRadius: 8, padding: "0.25rem 0.7rem", fontSize: ".85rem", fontWeight: 700, display: "inline-block" }}>
                        {ils(m.balance)}
                      </span>
                    </td>
                    {/* אייקוני פעולה */}
                    <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid #f0f2f5" }}
                      onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "center" }}>
                        <IconBtn title="צפייה" color="#3b82f6" onClick={e => { e.stopPropagation(); setViewing(m); }}>
                          <Eye size={15} />
                        </IconBtn>
                        <IconBtn title="עריכה" color="#f59e0b" onClick={e => { e.stopPropagation(); openEdit(m); }}>
                          <Pencil size={15} />
                        </IconBtn>
                        <IconBtn title="מחיקה" color={RED} disabled={deleting === m.id} onClick={e => { e.stopPropagation(); deleteMember(m); }}>
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
        <div style={{ padding: "0.6rem 1rem", borderTop: "1px solid #f0f2f5", fontSize: ".78rem", color: "#9aa5b5", textAlign: "center" }}>
          מציג {filtered.length} מתוך {members.length} חברים • לחץ על שורה לכרטסת החבר
        </div>
      </div>

      {/* ===== מודאל צפייה ===== */}
      {viewing && (
        <div onClick={e => { if (e.target === e.currentTarget) setViewing(null); }} style={overlay}>
          <div style={modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#3b82f6" }}>פרטי חבר</h2>
              <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#f8fafc", borderRadius: 12 }}>
              <Avatar name={viewing.name || "?"} />
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e" }}>{viewing.name}</div>
                {viewing.address && <div style={{ fontSize: ".8rem", color: "#9aa5b5", marginTop: 2 }}>{viewing.address}</div>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem 1.5rem" }}>
              {([
                ["קוד", viewing.code || "—"],
                ["טלפון", viewing.phone || "—"],
                ["כתובת", viewing.address || "—"],
                ["מספר פעולות", String(viewing.txn_count)],
                ["יתרה", ils(viewing.balance)],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: ".73rem", color: "#9aa5b5", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 600, color: l === "יתרה" ? (viewing.balance > 0 ? BRAND : viewing.balance < 0 ? RED : "#7a8699") : "#1a1a2e" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={() => { setViewing(null); openEdit(viewing); }} style={saveBtnStyle}>עריכה</button>
              <button onClick={() => setViewing(null)} style={ghostBtnStyle}>סגור</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודאל עריכה ===== */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null); }} style={overlay}>
          <div style={modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#f59e0b" }}>עריכת חבר</h2>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>שם ומשפחה *</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  style={{ ...inp, borderColor: editErr.name ? RED : undefined }} autoFocus />
                {editErr.name && <div style={{ fontSize: ".75rem", color: RED, marginTop: 3 }}>{editErr.name}</div>}
              </div>
              <div>
                <label style={lbl}>קוד</label>
                <input value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} style={inp} placeholder="1234" />
              </div>
              <div>
                <label style={lbl}>טלפון *</label>
                <input value={editForm.phone} onChange={e => setEditPhone(e.target.value)}
                  style={{ ...inp, borderColor: editErr.phone ? RED : undefined }} dir="ltr" placeholder="050-0000000" />
                {editErr.phone && <div style={{ fontSize: ".75rem", color: RED, marginTop: 3 }}>{editErr.phone}</div>}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>כתובת</label>
                <input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} style={inp} placeholder="רחוב, עיר" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>מייל להתחברות (פורטל אישי)</label>
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} style={inp} dir="ltr" placeholder="member@example.com" type="email" />
              </div>
              {/* יצירת חשבון התחברות לחבר */}
              <div style={{ gridColumn: "1/-1", background: "#f4faf8", borderRadius: 10, padding: "0.85rem 1rem", border: "1px solid #d7e9e2" }}>
                <div style={{ fontSize: ".82rem", fontWeight: 700, color: BRAND, marginBottom: 6 }}>🔐 התחברות לפורטל האישי (צפייה בלבד)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={loginPass} onChange={e => setLoginPass(e.target.value)} style={{ ...inp, flex: 1, minWidth: 140 }} dir="ltr" type="text" placeholder="סיסמה לחבר (לפחות 6 תווים)" />
                  <button onClick={createLogin} disabled={creatingLogin} style={{ padding: "0.5rem 1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {creatingLogin ? "יוצר…" : "צור התחברות"}
                  </button>
                </div>
                {loginMsg && <div style={{ fontSize: ".78rem", marginTop: 6, color: loginMsg.startsWith("✓") ? BRAND : RED }}>{loginMsg}</div>}
                <div style={{ fontSize: ".72rem", color: "#9aa5b5", marginTop: 6 }}>החבר יתחבר עם המייל שלמעלה והסיסמה שתגדיר כאן.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={saveMember} disabled={saving} style={saveBtnStyle}>{saving ? "שומר…" : "✓ שמור שינויים"}</button>
              <button onClick={() => setEditing(null)} style={ghostBtnStyle}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודאל הוספת חבר ===== */}
      {adding && (
        <div onClick={e => { if (e.target === e.currentTarget) closeAdd(); }} style={overlay}>
          <div style={modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: BRAND }}>👤 חבר חדש</h2>
              <button onClick={closeAdd} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", color: "#9aa5b5", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>שם ומשפחה *</label>
                <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  style={{ ...inp, borderColor: addErr.name ? RED : undefined }} placeholder="ישראל ישראלי" autoFocus />
                {addErr.name && <div style={{ fontSize: ".75rem", color: RED, marginTop: 3 }}>{addErr.name}</div>}
              </div>
              <div>
                <label style={lbl}>קוד</label>
                <input value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))} style={inp} placeholder="1234" />
              </div>
              <div>
                <label style={lbl}>טלפון *</label>
                <input value={addForm.phone} onChange={e => setAddPhone(e.target.value)}
                  style={{ ...inp, borderColor: addErr.phone ? RED : undefined }} placeholder="050-0000000" dir="ltr" />
                {addForm.code && <div style={{ fontSize: ".75rem", color: BRAND, marginTop: 4 }}>קוד: {addForm.code}</div>}
                {addErr.phone && <div style={{ fontSize: ".75rem", color: RED, marginTop: 3 }}>{addErr.phone}</div>}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>כתובת</label>
                <input value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} style={inp} placeholder="רחוב, עיר" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>מייל להתחברות (פורטל אישי)</label>
                <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} style={inp} dir="ltr" placeholder="member@example.com" type="email" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <Button onClick={addMember} disabled={saving}>{saving ? "שומר…" : "✓ הוסף חבר"}</Button>
              <Button variant="ghost" onClick={closeAdd}>ביטול</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
