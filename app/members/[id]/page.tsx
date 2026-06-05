"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { supabase, fnErrMessage } from "@/lib/supabase";
import { ils, gdate, toHebrewDate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { hebTextToGreg } from "@/lib/hebrewParse";
import { Card, PageTitle, Button, Badge, Loading, Empty } from "@/components/ui";
import type { MemberBalance, Transaction, Check } from "@/types";

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
    const { data, error } = await supabase.functions.invoke("quick-service", {
      body: { email, password: loginPass, memberId: member.id },
    });
    setCreatingLogin(false);
    if (error || (data && (data as any).error)) {
      setLoginMsg("שגיאה: " + (await fnErrMessage(error, data)));
      return;
    }
    setLoginMsg((data as any)?.updated ? "✓ הסיסמה עודכנה בהצלחה" : "✓ חשבון ההתחברות נוצר בהצלחה");
    setLoginPass("");
    load();
  }

  async function load() {
    const [m, t, c] = await Promise.all([
      supabase.from("member_balances").select("*").eq("id", id).single(),
      supabase.from("transactions").select("*").eq("member_id", id).order("created_at", { ascending: true }),
      supabase.from("checks").select("*").eq("member_id", id).order("due_date", { ascending: true }),
    ]);
    setMember(m.data as MemberBalance);
    setTxns((t.data as Transaction[]) || []);
    setChecks((c.data as Check[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  // A5: שיקים
  const [checks, setChecks] = useState<Check[]>([]);
  const [chkForm, setChkForm] = useState({ amount: "", due_date: "", hebrew_due: "", notes: "" });
  const [addingChk, setAddingChk] = useState(false);
  const [chkBusy, setChkBusy] = useState<string | null>(null);

  // התקדמות פירעון: כמה מהחוב כבר נפרע בשיקים וכמה צפוי להיפרע
  const checkStats = useMemo(() => {
    const pend = checks.filter(c => c.status === "pending");
    const pendSum = pend.reduce((s, c) => s + c.amount, 0);
    const cashedSum = checks.filter(c => c.status === "cashed").reduce((s, c) => s + c.amount, 0);
    const debt = member && member.balance < 0 ? -member.balance : 0; // חוב נוכחי בפועל
    const projectedDebt = Math.max(0, debt - pendSum);               // יתרת חוב צפויה אחרי פדיון כל הממתינים
    const planTotal = cashedSum + pendSum;                           // סך תכנית הפירעון בשיקים
    const progressPct = planTotal > 0 ? Math.round((cashedSum / planTotal) * 100) : 0;
    return { pend, pendSum, cashedSum, debt, projectedDebt, planTotal, progressPct };
  }, [checks, member]);

  async function addCheck() {
    if (!member) return;
    if (!chkForm.amount || Number(chkForm.amount) <= 0) { alert("יש להזין סכום חיובי"); return; }
    if (!chkForm.due_date) { alert("יש לבחור תאריך פירעון"); return; }
    setAddingChk(true);
    const { error } = await supabase.from("checks").insert({
      member_id: member.id, amount: Number(chkForm.amount), due_date: chkForm.due_date,
      hebrew_due: toHebrewDate(chkForm.due_date),
      notes: chkForm.notes || null, status: "pending",
    });
    setAddingChk(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setChkForm({ amount: "", due_date: "", hebrew_due: "", notes: "" });
    load();
  }

  // פדיון שיק → יוצר הפקדה (מקטין את החוב) ומקשר אותה לשיק
  async function markCashed(c: Check) {
    if (!member) return;
    if (!confirm(`לסמן שיק על סך ${ils(c.amount)} כנפדה? תיווצר הפקדה שתקטין את החוב.`)) return;
    setChkBusy(c.id);
    const { data: txn, error: tErr } = await supabase.from("transactions").insert({
      member_id: member.id, amount: c.amount, type: "הפקדה", method: "צ'יקים",
      greg_date: c.due_date, heb_date: c.hebrew_due, notes: "פדיון שיק" + (c.notes ? " · " + c.notes : ""),
    }).select("id").single();
    if (tErr) { setChkBusy(null); alert("שגיאה ביצירת ההפקדה: " + tErr.message); return; }
    await supabase.from("checks").update({ status: "cashed", cashed_at: new Date().toISOString(), transaction_id: (txn as any)?.id || null }).eq("id", c.id);
    setChkBusy(null);
    load();
  }

  async function markBounced(c: Check) {
    setChkBusy(c.id);
    await supabase.from("checks").update({ status: "bounced" }).eq("id", c.id);
    setChkBusy(null);
    load();
  }

  async function deleteCheck(c: Check) {
    if (!confirm("למחוק את השיק?")) return;
    setChkBusy(c.id);
    await supabase.from("checks").delete().eq("id", c.id);
    setChkBusy(null);
    load();
  }

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

  // מחיקת כל הפעולות של החבר — עם אישור כפול
  const [deletingAll, setDeletingAll] = useState(false);
  async function deleteAllTxns() {
    if (!member || txns.length === 0) return;
    if (!confirm(`למחוק את כל ${txns.length} הפעולות של "${member.name}"?\n\nפעולה זו אינה ניתנת לביטול!`)) return;
    if (!confirm("אישור אחרון — כל הפעולות יימחקו לצמיתות. להמשיך?")) return;
    setDeletingAll(true);
    const { error } = await supabase.from("transactions").delete().eq("member_id", member.id);
    setDeletingAll(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    load();
  }

  // בחירה מרובה (סימון וי) ומחיקת הנבחרות
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingSel, setDeletingSel] = useState(false);
  function toggleOne(tid: string) {
    setSelected(s => { const n = new Set(s); n.has(tid) ? n.delete(tid) : n.add(tid); return n; });
  }
  function toggleAll() {
    setSelected(s => s.size === txns.length ? new Set() : new Set(txns.map(t => t.id)));
  }
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`למחוק ${selected.size} פעולות שנבחרו?\n\nפעולה זו אינה ניתנת לביטול!`)) return;
    setDeletingSel(true);
    const { error } = await supabase.from("transactions").delete().in("id", Array.from(selected));
    setDeletingSel(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setSelected(new Set());
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
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            {txns.length > 0 && (
              <button onClick={deleteAllTxns} disabled={deletingAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.45rem 1rem", background: "#fde8e8", color: "#c0392b", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer" }}>
                🗑️ {deletingAll ? "מוחק…" : "מחק את כל הפעולות"}
              </button>
            )}
            <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.45rem 1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer" }}>
              ＋ הוספת פעולה
            </button>
          </div>
        </div>
        {txns.length === 0 ? (
          <Empty text="אין פעולות לחבר זה" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            {selected.size > 0 && (
              <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.6rem 1.25rem", background: "#fef5f5", borderBottom: "1px solid #f3d7d7" }}>
                <span style={{ fontWeight: 700, color: "#c0392b" }}>נבחרו {selected.size} פעולות</span>
                <button onClick={deleteSelected} disabled={deletingSel} style={{ padding: "0.4rem 1rem", background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer" }}>
                  🗑️ {deletingSel ? "מוחק…" : "מחק את הנבחרות"}
                </button>
                <button onClick={() => setSelected(new Set())} style={{ padding: "0.4rem 1rem", background: "#eef2f1", color: "#7a8699", border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".85rem", cursor: "pointer" }}>
                  בטל בחירה
                </button>
              </div>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th className="no-print" style={{ width: 36 }}>
                    <input type="checkbox" checked={selected.size === txns.length && txns.length > 0} onChange={toggleAll} style={{ cursor: "pointer", width: 16, height: 16 }} />
                  </th>
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
                  <tr key={t.id} onClick={() => openEdit(t)} style={{ cursor: "pointer", background: selected.has(t.id) ? "#fef5f5" : "" }}
                    onMouseEnter={e => { if (!selected.has(t.id)) e.currentTarget.style.background = "#f4faf8"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected.has(t.id) ? "#fef5f5" : ""; }}>
                    <td className="no-print" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                    </td>
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

      {/* A5: שיקים */}
      <Card style={{ padding: 0, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem 0", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>שיקים</h3>
          {(() => {
            const pend = checks.filter(c => c.status === "pending");
            const sum = pend.reduce((s, c) => s + c.amount, 0);
            return pend.length > 0 ? <span style={{ fontSize: ".82rem", color: "#7a8699" }}>{pend.length} שיקים פתוחים · {ils(sum)}</span> : null;
          })()}
        </div>

        {/* התקדמות פירעון ההלוואה בשיקים */}
        {checks.length > 0 && (
          <div style={{ padding: "0.75rem 1.25rem 0" }}>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: ".85rem", color: "#445" }}>
              <div>חוב נוכחי: <b style={{ color: checkStats.debt > 0 ? "#c0392b" : BRAND }}>{ils(checkStats.debt)}</b></div>
              <div>שיקים ממתינים לפדיון: <b>{ils(checkStats.pendSum)}</b>{checkStats.pend.length > 0 ? ` (${checkStats.pend.length})` : ""}</div>
              <div>יתרת חוב צפויה אחרי פדיון הכל: <b style={{ color: checkStats.projectedDebt > 0 ? "#c0392b" : BRAND }}>{ils(checkStats.projectedDebt)}</b></div>
            </div>
            {checkStats.planTotal > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 8, background: "#eef2f1", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${checkStats.progressPct}%`, height: "100%", background: BRAND, transition: "width .3s" }} />
                </div>
                <div style={{ fontSize: ".78rem", color: "#7a8699", marginTop: 4 }}>
                  נפדו {ils(checkStats.cashedSum)} מתוך {ils(checkStats.planTotal)} · {checkStats.progressPct}% מתכנית השיקים
                </div>
              </div>
            )}
          </div>
        )}

        {/* טופס הוספת שיק */}
        <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", padding: "0.75rem 1.25rem" }}>
          <div style={{ width: 120 }}>
            <label style={lbl}>סכום ₪</label>
            <input type="number" value={chkForm.amount} onChange={e => setChkForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
          </div>
          <div style={{ width: 160 }}>
            <label style={lbl}>תאריך פירעון</label>
            <input type="date" value={chkForm.due_date} onChange={e => setChkForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={lbl}>הערות</label>
            <input value={chkForm.notes} onChange={e => setChkForm(f => ({ ...f, notes: e.target.value }))} style={inp} placeholder="מס' שיק / בנק / פרטים" />
          </div>
          <button onClick={addCheck} disabled={addingChk} style={{ padding: "0.5rem 1.1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer", whiteSpace: "nowrap" }}>
            {addingChk ? "מוסיף…" : "＋ הוסף שיק"}
          </button>
        </div>

        {checks.length === 0 ? (
          <Empty text="אין שיקים לחבר זה" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>סכום</th>
                  <th>פירעון (לועזי)</th>
                  <th>פירעון (עברי)</th>
                  <th>סטטוס</th>
                  <th>הערות</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {checks.map(c => {
                  const overdue = c.status === "pending" && c.due_date && new Date(c.due_date) <= new Date();
                  return (
                    <tr key={c.id} style={{ background: overdue ? "#fff7ed" : "" }}>
                      <td style={{ fontWeight: 700 }}>{ils(c.amount)}</td>
                      <td dir="ltr" style={{ textAlign: "right" }}>{c.due_date ? gdate(c.due_date) : "—"}{overdue ? " ⚠️" : ""}</td>
                      <td>{c.hebrew_due || "—"}</td>
                      <td>
                        <span style={{ color: "#fff", borderRadius: 999, padding: "0.12rem 0.6rem", fontSize: ".76rem", fontWeight: 700, background: c.status === "cashed" ? BRAND : c.status === "bounced" ? "#c0392b" : "#f59e0b" }}>
                          {c.status === "cashed" ? "נפדה" : c.status === "bounced" ? "חזר" : "ממתין"}
                        </span>
                      </td>
                      <td style={{ color: "#7a8699" }}>{c.notes || "—"}</td>
                      <td className="no-print">
                        {c.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => markCashed(c)} disabled={chkBusy === c.id} style={{ padding: "0.3rem 0.7rem", background: BRAND, color: "#fff", border: "none", borderRadius: 7, fontSize: ".78rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>נפדה ✓</button>
                            <button onClick={() => markBounced(c)} disabled={chkBusy === c.id} style={{ padding: "0.3rem 0.7rem", background: "#fde8e8", color: "#c0392b", border: "none", borderRadius: 7, fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>חזר</button>
                          </div>
                        )}
                        {c.status !== "pending" && (
                          <button onClick={() => deleteCheck(c)} disabled={chkBusy === c.id} style={{ padding: "0.3rem 0.7rem", background: "none", color: "#9aa5b5", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: ".78rem", cursor: "pointer" }}>מחק</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
