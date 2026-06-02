"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ils, gdate, toHebrewDate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { hebTextToGreg } from "@/lib/hebrewParse";
import { Card, PageTitle, Button, Badge, Loading, Empty } from "@/components/ui";
import type { MemberBalance, Transaction } from "@/types";

const BRAND = "#1e6f5c";

// תאריך לועזי: מהשדה השמור, ואם אין — חישוב אוטומטי מהתאריך העברי הטקסטואלי
function gregOf(t: Transaction): string {
  if (t.greg_date) return gdate(t.greg_date);
  const iso = hebTextToGreg(t.heb_date);
  return iso ? gdate(iso) : "—";
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberBalance | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  // עריכת פרטי החבר ישירות בכרטסת
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState({ name: "", code: "", phone: "", address: "", email: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  // יצירת התחברות לחבר
  const [loginPass, setLoginPass] = useState("");
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");

  function startEditInfo() {
    if (!member) return;
    setInfo({ name: member.name || "", code: member.code || "", phone: member.phone || "", address: member.address || "", email: member.email || "" });
    setLoginPass(""); setLoginMsg("");
    setEditInfo(true);
  }

  async function saveInfo() {
    if (!member) return;
    setSavingInfo(true);
    const { error } = await supabase.from("members").update({
      name: info.name.trim(), code: info.code.trim() || null,
      phone: info.phone.trim() || null, address: info.address.trim() || null,
      email: info.email.trim().toLowerCase() || null,
    }).eq("id", member.id);
    setSavingInfo(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setEditInfo(false);
    load();
  }

  async function createLogin() {
    if (!member) return;
    const email = info.email.trim().toLowerCase();
    if (!email) { setLoginMsg("יש להזין מייל לחבר תחילה"); return; }
    if (loginPass.length < 6) { setLoginMsg("סיסמה חייבת להיות לפחות 6 תווים"); return; }
    setCreatingLogin(true); setLoginMsg("");
    const { data, error } = await supabase.functions.invoke("dynamic-responder", {
      body: { email, password: loginPass, memberId: member.id },
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

  async function load() {
    const [m, t] = await Promise.all([
      supabase.from("member_balances").select("*").eq("id", id).single(),
      supabase.from("transactions").select("*").eq("member_id", id).order("created_at", { ascending: true }),
    ]);
    setMember(m.data as MemberBalance);
    setTxns((t.data as Transaction[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  function openEdit(t: Transaction) {
    setForm({
      amount: String(t.amount), type: t.type, method: t.method || "",
      greg_date: t.greg_date?.split("T")[0] || "", heb_date: t.heb_date || "", notes: t.notes || "",
    });
    setEditing(t);
  }

  // הוספת פעולה חדשה לחבר הנוכחי
  const [addTxn, setAddTxn] = useState(false);
  const [addForm, setAddForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  const [savingAdd, setSavingAdd] = useState(false);

  function openAdd() {
    setAddForm({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
    setAddTxn(true);
  }
  function setAddGreg(val: string) { setAddForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) })); }
  async function saveAdd() {
    if (!member) return;
    if (!addForm.amount || Number(addForm.amount) <= 0) { alert("יש להזין סכום חיובי"); return; }
    if (!addForm.method) { alert("יש לבחור אופן"); return; }
    if (!addForm.greg_date) { alert("יש לבחור תאריך"); return; }
    setSavingAdd(true);
    const { error } = await supabase.from("transactions").insert({
      member_id: member.id, amount: Number(addForm.amount), type: addForm.type,
      method: addForm.method || null, greg_date: addForm.greg_date || null,
      heb_date: addForm.heb_date || null, notes: addForm.notes || null,
    });
    setSavingAdd(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setAddTxn(false);
    load();
  }

  // בחירת תאריך לועזי → חישוב עברי אוטומטי
  function setGreg(val: string) {
    setForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) }));
  }
  // הקלדת תאריך עברי → חישוב לועזי אוטומטי (אם ניתן)
  function setHeb(val: string) {
    const iso = hebTextToGreg(val);
    setForm(f => ({ ...f, heb_date: val, greg_date: iso || f.greg_date }));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("transactions").update({
      amount: Number(form.amount), type: form.type, method: form.method || null,
      greg_date: form.greg_date || null, heb_date: form.heb_date || null, notes: form.notes || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setEditing(null);
    load();
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("למחוק את הפעולה?")) return;
    setSaving(true);
    await supabase.from("transactions").delete().eq("id", editing.id);
    setSaving(false);
    setEditing(null);
    load();
  }

  if (loading) return <Loading />;
  if (!member) return <Empty text="חבר לא נמצא" />;

  return (
    <div>
      <PageTitle
        action={
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            <Link href="/members"><Button variant="ghost">← חזרה</Button></Link>
            <Button onClick={() => window.print()}>🖨️ הדפסת דף יתרה</Button>
          </div>
        }
      >
        {member.name || "—"}
      </PageTitle>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Card style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>פרטי החבר</h3>
            {!editInfo && (
              <button className="no-print" onClick={startEditInfo} style={{ display: "flex", alignItems: "center", gap: 5, padding: "0.35rem 0.8rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".82rem", cursor: "pointer" }}>
                <Pencil size={14} /> ערוך פרטים
              </button>
            )}
          </div>

          {!editInfo ? (
            <>
              <Row label="שם" value={member.name || "—"} />
              <Row label="קוד אישי" value={member.code || "—"} />
              <Row label="טלפון" value={member.phone || "—"} />
              <Row label="כתובת" value={member.address || "—"} />
              <Row label="מייל להתחברות" value={member.email || "—"} />
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>שם</label>
                <input value={info.name} onChange={e => setInfo(f => ({ ...f, name: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>קוד אישי</label>
                <input value={info.code} onChange={e => setInfo(f => ({ ...f, code: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>טלפון</label>
                <input value={info.phone} onChange={e => setInfo(f => ({ ...f, phone: e.target.value }))} style={inp} dir="ltr" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>כתובת</label>
                <input value={info.address} onChange={e => setInfo(f => ({ ...f, address: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>מייל להתחברות (פורטל אישי)</label>
                <input value={info.email} onChange={e => setInfo(f => ({ ...f, email: e.target.value }))} style={inp} dir="ltr" type="email" placeholder="member@example.com" />
              </div>

              {/* יצירת חשבון התחברות */}
              <div style={{ gridColumn: "1/-1", background: "#f4faf8", borderRadius: 10, padding: "0.85rem 1rem", border: "1px solid #d7e9e2" }}>
                <div style={{ fontSize: ".82rem", fontWeight: 700, color: BRAND, marginBottom: 6 }}>🔐 התחברות לפורטל האישי (צפייה בלבד)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={loginPass} onChange={e => setLoginPass(e.target.value)} style={{ ...inp, flex: 1, minWidth: 140 }} dir="ltr" type="text" placeholder="סיסמה לחבר (לפחות 6 תווים)" />
                  <button onClick={createLogin} disabled={creatingLogin} style={{ padding: "0.5rem 1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {creatingLogin ? "יוצר…" : "צור התחברות"}
                  </button>
                </div>
                {loginMsg && <div style={{ fontSize: ".78rem", marginTop: 6, color: loginMsg.startsWith("✓") ? BRAND : "#c0392b" }}>{loginMsg}</div>}
                <div style={{ fontSize: ".72rem", color: "#9aa5b5", marginTop: 6 }}>החבר יתחבר עם המייל שלמעלה והסיסמה שתגדיר כאן.</div>
              </div>

              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
                <button onClick={saveInfo} disabled={savingInfo} style={{ padding: "0.5rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".88rem", cursor: "pointer" }}>{savingInfo ? "שומר…" : "✓ שמור פרטים"}</button>
                <button onClick={() => setEditInfo(false)} style={{ padding: "0.5rem 1.2rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".88rem", cursor: "pointer" }}>ביטול</button>
              </div>
            </div>
          )}
        </Card>
        <Card style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: ".85rem", color: "#7a8699" }}>יתרה נוכחית</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: member.balance >= 0 ? "var(--brand)" : "#c0392b" }}>
            {ils(member.balance)}
          </div>
          <div style={{ fontSize: ".85rem", color: "#7a8699" }}>{member.txn_count} פעולות</div>
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem 0" }}>
          <h3 style={{ margin: 0 }}>היסטוריית פעולות</h3>
          <button className="no-print" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.45rem 1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer" }}>
            ＋ הוספת פעולה
          </button>
        </div>
        {txns.length === 0 ? (
          <Empty text="אין פעולות לחבר זה" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>סוג</th>
                  <th>סכום</th>
                  <th>אופן</th>
                  <th>תאריך עברי</th>
                  <th>תאריך לועזי</th>
                  <th>הערות</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t, i) => (
                  <tr key={t.id} onClick={() => openEdit(t)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f4faf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td>{i + 1}</td>
                    <td><Badge type={t.type} /></td>
                    <td style={{ fontWeight: 600, color: t.type === "משיכה" ? "#c0392b" : "#1e7d4f" }}>
                      {t.type === "משיכה" ? "-" : "+"}{ils(t.amount)}
                    </td>
                    <td>{t.method || "—"}</td>
                    <td>{t.heb_date || "—"}</td>
                    <td dir="ltr" style={{ textAlign: "right" }}>{gregOf(t)}</td>
                    <td style={{ color: "#7a8699" }}>{t.notes}</td>
                    <td className="no-print">
                      <Pencil size={15} color="#f59e0b" style={{ opacity: .7 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* מודאל עריכה */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 500, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#f59e0b" }}>עריכת פעולה</h2>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={lbl}>סוג</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>אופן</label>
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} style={inp}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>תאריך לועזי</label>
                <input type="date" value={form.greg_date} onChange={e => setGreg(e.target.value)} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>תאריך עברי (טקסט)</label>
                <input value={form.heb_date} onChange={e => setHeb(e.target.value)} style={inp} placeholder="כו ניסן פו" dir="rtl" />
                {form.heb_date && hebTextToGreg(form.heb_date) && (
                  <div style={{ fontSize: ".78rem", color: BRAND, marginTop: 4 }}>לועזי מחושב: {gdate(hebTextToGreg(form.heb_date)!)}</div>
                )}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={save} disabled={saving} style={{ padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>{saving ? "שומר…" : "✓ שמור שינויים"}</button>
              <button onClick={() => setEditing(null)} style={{ padding: "0.55rem 1.2rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer" }}>ביטול</button>
              <button onClick={remove} disabled={saving} style={{ padding: "0.55rem 1.2rem", background: "#fde8e8", color: "#c0392b", border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer", marginInlineStart: "auto" }}>מחק</button>
            </div>
          </div>
        </div>
      )}

      {/* מודאל הוספת פעולה — החבר ידוע אוטומטית */}
      {addTxn && (
        <div onClick={e => { if (e.target === e.currentTarget) setAddTxn(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 500, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: BRAND }}>הוספת פעולה</h2>
              <button onClick={() => setAddTxn(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ background: "#f4faf8", borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem", fontSize: ".9rem", border: "1px solid #d7e9e2" }}>
              <span style={{ color: "#7a8699" }}>חבר: </span><strong style={{ color: BRAND }}>{member.name}</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={lbl}>סוג</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪</label>
                <input type="number" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>אופן</label>
                <select value={addForm.method} onChange={e => setAddForm(f => ({ ...f, method: e.target.value }))} style={inp}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>תאריך לועזי</label>
                <input type="date" value={addForm.greg_date} onChange={e => setAddGreg(e.target.value)} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>תאריך עברי (מחושב אוטומטית)</label>
                <div style={{ ...inp, background: "#f4faf8", color: addForm.heb_date ? "#1a1a2e" : "#9aa5b5", display: "flex", alignItems: "center", minHeight: 38 }}>
                  {addForm.heb_date || "יתמלא אוטומטית לפי התאריך הלועזי"}
                </div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={saveAdd} disabled={savingAdd} style={{ padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>{savingAdd ? "שומר…" : "✓ הוסף פעולה"}</button>
              <button onClick={() => setAddTxn(false)} style={{ padding: "0.55rem 1.2rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { padding: "0.5rem 0.75rem", border: "1.5px solid #d8dde5", borderRadius: 8, fontSize: ".9rem", width: "100%", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #eef0f4" }}>
      <span style={{ color: "#7a8699" }}>{label}</span>
      <span dir="auto" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
