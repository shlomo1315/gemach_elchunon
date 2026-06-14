"use client";

import { useEffect, useState } from "react";
import { LogOut, Wallet, ArrowDownCircle, ArrowUpCircle, ListChecks, KeyRound, MessageSquarePlus, Pencil, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ils, gdate, toHebrewDate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { hebTextToGreg } from "@/lib/hebrewParse";
import { Badge, Loading } from "@/components/ui";
import HebrewInfoBar from "@/components/HebrewInfoBar";
import DatePicker from "@/components/DatePicker";
import type { MemberBalance, Transaction, ChangeRequest, MemberRequest } from "@/types";

const REQ_TYPE_LABEL: Record<string, string> = { message: "פנייה / הודעה", loan: "בקשת הלוואה", deposit_refund: "בקשת החזר פיקדון" };
const REQ_STATUS_LABEL: Record<string, string> = { open: "פתוח", in_progress: "בטיפול", done: "טופל", rejected: "נדחה", pending: "ממתין", approved: "אושר" };
const STATUS_COLOR: Record<string, string> = { open: "#f59e0b", in_progress: "#3b82f6", done: "#1e6f5c", rejected: "#c0392b", pending: "#f59e0b", approved: "#1e6f5c" };

const BRAND = "#1e6f5c";
const BRAND_DARK = "#16513f";
const RED = "#e05252";

const inp: React.CSSProperties = { padding: "0.55rem 0.8rem", border: "1.5px solid #d8dde5", borderRadius: 10, fontSize: ".9rem", width: "100%", boxSizing: "border-box", outline: "none" };

function gregOf(t: Transaction): string {
  if (t.greg_date) return gdate(t.greg_date);
  const iso = hebTextToGreg(t.heb_date);
  return iso ? gdate(iso) : "";
}

function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "1.25rem 1.4rem", boxShadow: "0 2px 8px rgba(0,0,0,.06)", borderTop: `4px solid ${color}`, flex: "1 1 180px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: ".8rem", color: "#9aa5b5", fontWeight: 600 }}>{label}</div>
        <div style={{ color, opacity: .7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function MemberPortal({ memberId, logout }: { memberId: string; logout: () => void }) {
  const [member, setMember] = useState<MemberBalance | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [myChanges, setMyChanges] = useState<ChangeRequest[]>([]);
  const [myRequests, setMyRequests] = useState<MemberRequest[]>([]);
  // שינוי סיסמה ע"י החבר
  const [showPass, setShowPass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");
  // הצעת תיקון לפעולה
  const [propTxn, setPropTxn] = useState<Transaction | null>(null);
  const [propForm, setPropForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", member_note: "" });
  const [savingProp, setSavingProp] = useState(false);
  // הגשת פעולה חדשה לאישור (kind='add') עם מסמך תיעוד
  const [addReqOpen, setAddReqOpen] = useState(false);
  const [addForm, setAddForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", member_note: "" });
  const [addFile, setAddFile] = useState<File | null>(null);
  const [savingAddReq, setSavingAddReq] = useState(false);
  // פופאפ הצלחה אחרי הגשת פעולה חדשה (נסגר אוטומטית באיטיות כלפי פנים)
  type SuccessInfo = { type: string; amount: string; method: string; greg_date: string; heb_date: string; notes: string; member_note: string; fileName: string | null };
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
  const [successClosing, setSuccessClosing] = useState(false);

  useEffect(() => {
    if (!successInfo) return;
    setSuccessClosing(false);
    const tClose = setTimeout(() => setSuccessClosing(true), 2400); // התחלת הסגירה האיטית
    const tDone = setTimeout(() => setSuccessInfo(null), 3000);     // הסרה מהמסך
    return () => { clearTimeout(tClose); clearTimeout(tDone); };
  }, [successInfo]);

  function openAddReq() {
    setAddForm({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", member_note: "" });
    setAddFile(null);
    setAddReqOpen(true);
  }
  function addGreg(val: string) { setAddForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) })); }

  async function submitAddReq() {
    if (!addForm.amount || Number(addForm.amount) <= 0) { alert("יש להזין סכום חיובי"); return; }
    if (!addForm.greg_date && !addForm.heb_date) { alert("יש להזין תאריך"); return; }
    setSavingAddReq(true);
    let documentUrl: string | null = null;
    if (addFile) {
      const safe = addFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${memberId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("member-docs").upload(path, addFile, { upsert: false });
      if (upErr) { setSavingAddReq(false); alert("שגיאה בהעלאת המסמך: " + upErr.message); return; }
      documentUrl = path;
    }
    const { error } = await supabase.from("transaction_change_requests").insert({
      member_id: memberId, transaction_id: null, kind: "add", status: "pending",
      member_note: addForm.member_note || null, document_url: documentUrl,
      proposed: {
        amount: Number(addForm.amount), type: addForm.type, method: addForm.method || null,
        greg_date: addForm.greg_date || null, heb_date: addForm.heb_date || null, notes: addForm.notes || null,
      },
    });
    setSavingAddReq(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setSuccessInfo({
      type: addForm.type, amount: addForm.amount, method: addForm.method,
      greg_date: addForm.greg_date, heb_date: addForm.heb_date,
      notes: addForm.notes, member_note: addForm.member_note,
      fileName: addFile?.name || null,
    });
    setAddReqOpen(false);
    loadRequests();
  }
  // פנייה / בקשה
  const [reqForm, setReqForm] = useState({ type: "message", subject: "", body: "", amount: "" });
  const [savingReq, setSavingReq] = useState(false);
  const [reqMsg, setReqMsg] = useState("");

  async function loadRequests() {
    const [c, r] = await Promise.all([
      supabase.from("transaction_change_requests").select("*").eq("member_id", memberId).order("created_at", { ascending: false }),
      supabase.from("member_requests").select("*").eq("member_id", memberId).order("created_at", { ascending: false }),
    ]);
    setMyChanges((c.data as ChangeRequest[]) || []);
    setMyRequests((r.data as MemberRequest[]) || []);
  }

  function openPropose(t: Transaction) {
    setPropForm({
      amount: String(t.amount), type: t.type, method: t.method || "",
      greg_date: t.greg_date?.split("T")[0] || "", heb_date: t.heb_date || "", notes: t.notes || "", member_note: "",
    });
    setPropTxn(t);
  }
  function propGreg(val: string) { setPropForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) })); }

  async function submitPropose() {
    if (!propTxn) return;
    setSavingProp(true);
    const { error } = await supabase.from("transaction_change_requests").insert({
      member_id: memberId, transaction_id: propTxn.id, kind: "edit", status: "pending",
      member_note: propForm.member_note || null,
      proposed: {
        amount: Number(propForm.amount), type: propForm.type, method: propForm.method || null,
        greg_date: propForm.greg_date || null, heb_date: propForm.heb_date || null, notes: propForm.notes || null,
      },
    });
    setSavingProp(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setPropTxn(null);
    loadRequests();
  }

  async function submitRequest() {
    if (reqForm.type === "message" && !reqForm.body.trim()) { setReqMsg("יש להזין תוכן"); return; }
    setSavingReq(true); setReqMsg("");
    const { error } = await supabase.from("member_requests").insert({
      member_id: memberId, type: reqForm.type, status: "open",
      subject: reqForm.subject || null, body: reqForm.body || null,
      amount: reqForm.amount ? Number(reqForm.amount) : null,
    });
    setSavingReq(false);
    if (error) { setReqMsg("שגיאה: " + error.message); return; }
    setReqMsg("✓ הבקשה נשלחה");
    setReqForm({ type: "message", subject: "", body: "", amount: "" });
    loadRequests();
  }

  async function updatePassword() {
    if (newPass.length < 6) { setPassMsg("סיסמה חייבת להיות לפחות 6 תווים"); return; }
    if (newPass !== confirmPass) { setPassMsg("הסיסמאות אינן תואמות"); return; }
    setSavingPass(true); setPassMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setSavingPass(false);
    if (error) { setPassMsg("שגיאה: " + error.message); return; }
    setPassMsg("✓ הסיסמה עודכנה בהצלחה");
    setNewPass(""); setConfirmPass("");
  }

  useEffect(() => {
    (async () => {
      const [m, t] = await Promise.all([
        supabase.from("member_balances").select("*").eq("id", memberId).single(),
        supabase.from("transactions").select("*").eq("member_id", memberId).order("created_at", { ascending: false }),
      ]);
      setMember(m.data as MemberBalance);
      setTxns((t.data as Transaction[]) || []);
      setLoading(false);
      loadRequests();
    })();
  }, [memberId]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loading /></div>;

  const dep = txns.filter(t => t.type === "הפקדה").reduce((s, t) => s + t.amount, 0);
  const wit = txns.filter(t => t.type === "משיכה").reduce((s, t) => s + t.amount, 0);
  const balance = member?.balance ?? dep - wit;

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: "var(--bg)" }}>
      {/* כותרת עליונה */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, ${BRAND})`, color: "#fff", padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>גמ״ח חסדי אהרן</div>
          <div style={{ fontSize: ".85rem", opacity: .85, marginTop: 2 }}>שלום, {member?.name} · אזור אישי (צפייה בלבד)</div>
        </div>
        <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "0.5rem 1rem", fontWeight: 600, cursor: "pointer", fontSize: ".9rem" }}>
          <LogOut size={16} /> יציאה
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
        {/* שורת מידע יומי — זהה לממשק הניהול */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "1.1rem 1.25rem", marginBottom: 18 }}>
          <HebrewInfoBar />
        </div>

        {/* יתרה גדולה */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.07)", marginBottom: 18 }}>
          <div style={{ fontSize: ".9rem", color: "#9aa5b5", fontWeight: 600 }}>היתרה שלך בגמ״ח</div>
          <div style={{ fontSize: "2.8rem", fontWeight: 800, color: balance >= 0 ? BRAND : RED, lineHeight: 1.2 }}>{ils(balance)}</div>
          <div style={{ fontSize: ".85rem", color: "#b0bac7" }}>{txns.length} פעולות סה״כ</div>
        </div>

        {/* מצב מפורט */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <Stat label="סך ההפקדות שלך" value={ils(dep)} color="#16a085" icon={<ArrowDownCircle size={20} />} />
          <Stat label="סך המשיכות שלך" value={ils(wit)} color={RED} icon={<ArrowUpCircle size={20} />} />
          <Stat label="יתרה נוכחית" value={ils(balance)} color={BRAND} icon={<Wallet size={20} />} />
          <Stat label="מספר פעולות" value={String(txns.length)} color="#3b82f6" icon={<ListChecks size={20} />} />
        </div>

        {/* שינוי סיסמה */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden", marginBottom: 18 }}>
          <button onClick={() => { setShowPass(s => !s); setPassMsg(""); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.25rem", background: "none", border: "none", cursor: "pointer", fontWeight: 800, color: "#1a1a2e", fontSize: ".95rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><KeyRound size={18} color={BRAND} /> שינוי סיסמה</span>
            <span style={{ color: "#9aa5b5", fontSize: "1.1rem" }}>{showPass ? "−" : "+"}</span>
          </button>
          {showPass && (
            <div style={{ padding: "0 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="סיסמה חדשה (לפחות 6 תווים)" dir="ltr" style={inp} />
              <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="אימות סיסמה חדשה" dir="ltr" style={inp} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={updatePassword} disabled={savingPass} style={{ padding: "0.55rem 1.3rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>
                  {savingPass ? "שומר…" : "עדכן סיסמה"}
                </button>
                {passMsg && <span style={{ fontSize: ".82rem", fontWeight: 600, color: passMsg.startsWith("✓") ? BRAND : RED }}>{passMsg}</span>}
              </div>
            </div>
          )}
        </div>

        {/* פעולות אחרונות */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
          <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid #f0f2f5", fontWeight: 800, color: "#1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span>הפעולות שלך</span>
            <button onClick={openAddReq} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.45rem 1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".85rem", cursor: "pointer" }}>
              ＋ הגש פעולה חדשה לאישור
            </button>
          </div>
          {txns.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#9aa5b5" }}>אין פעולות עדיין</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>סוג</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>סכום</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>תאריך עברי</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>תאריך לועזי</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>הערות</th>
                    <th style={{ padding: "0.6rem 1rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "0.55rem 1rem" }}><Badge type={t.type} /></td>
                      <td style={{ padding: "0.55rem 1rem", fontWeight: 700, color: t.type === "משיכה" ? RED : BRAND }}>
                        {t.type === "משיכה" ? "−" : "+"}{ils(t.amount)}
                      </td>
                      <td style={{ padding: "0.55rem 1rem", color: "#4a5568" }}>{t.heb_date || "—"}</td>
                      <td style={{ padding: "0.55rem 1rem", color: "#7a8699" }} dir="ltr">{gregOf(t) || "—"}</td>
                      <td style={{ padding: "0.55rem 1rem", color: "#7a8699" }}>{t.notes || "—"}</td>
                      <td style={{ padding: "0.55rem 1rem" }}>
                        <button onClick={() => openPropose(t)} title="הצע תיקון" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #d8dde5", borderRadius: 8, padding: "0.25rem 0.6rem", color: BRAND, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                          <Pencil size={13} /> הצע תיקון
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* פניות ובקשות */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", marginTop: 18, padding: "1.25rem" }}>
          <div style={{ fontWeight: 800, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <MessageSquarePlus size={18} color={BRAND} /> פנייה / בקשה לגבאי
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <div style={{ minWidth: 170 }}>
              <label style={lblS}>סוג</label>
              <select value={reqForm.type} onChange={e => setReqForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                <option value="message">פנייה / הודעה</option>
                <option value="loan">בקשת הלוואה</option>
                <option value="deposit_refund">בקשת החזר פיקדון</option>
              </select>
            </div>
            {reqForm.type !== "message" && (
              <div style={{ width: 130 }}>
                <label style={lblS}>סכום ₪</label>
                <input type="number" value={reqForm.amount} onChange={e => setReqForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={lblS}>נושא</label>
              <input value={reqForm.subject} onChange={e => setReqForm(f => ({ ...f, subject: e.target.value }))} style={inp} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={lblS}>תוכן</label>
            <textarea value={reqForm.body} onChange={e => setReqForm(f => ({ ...f, body: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <button onClick={submitRequest} disabled={savingReq} style={{ padding: "0.55rem 1.4rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>{savingReq ? "שולח…" : "שלח בקשה"}</button>
            {reqMsg && <span style={{ fontSize: ".82rem", fontWeight: 600, color: reqMsg.startsWith("✓") ? BRAND : RED }}>{reqMsg}</span>}
          </div>

          {(myRequests.length > 0 || myChanges.length > 0) && (
            <div style={{ marginTop: 18, borderTop: "1px solid #f0f2f5", paddingTop: 12 }}>
              <div style={{ fontWeight: 700, color: "#4a5568", marginBottom: 8, fontSize: ".9rem" }}>הבקשות שלי</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myRequests.map(r => (
                  <div key={r.id} style={{ ...rowCard, display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span>{REQ_TYPE_LABEL[r.type]}{r.subject ? ` · ${r.subject}` : ""}{r.amount ? ` · ${ils(r.amount)}` : ""}</span>
                      <span style={{ ...miniPill, background: STATUS_COLOR[r.status] }}>{REQ_STATUS_LABEL[r.status]}</span>
                    </div>
                    {r.admin_note && (
                      <div style={{ marginTop: 8, background: "#eef6f3", borderInlineStart: `3px solid ${BRAND}`, borderRadius: 8, padding: "0.5rem 0.7rem" }}>
                        <div style={{ fontSize: ".74rem", fontWeight: 700, color: BRAND, marginBottom: 2 }}>תשובת הגבאי</div>
                        <div style={{ fontSize: ".84rem", color: "#1a1a2e", whiteSpace: "pre-wrap" }}>{r.admin_note}</div>
                      </div>
                    )}
                  </div>
                ))}
                {myChanges.map(c => (
                  <div key={c.id} style={rowCard}>
                    <span>{c.kind === "add" ? "בקשת פעולה חדשה" : c.kind === "delete" ? "בקשת מחיקת פעולה" : "הצעת תיקון לפעולה"}{c.proposed?.amount ? ` · ${ils(Number(c.proposed.amount))}` : ""}{c.document_url ? " · 📎" : ""}</span>
                    <span style={{ ...miniPill, background: STATUS_COLOR[c.status] }}>{REQ_STATUS_LABEL[c.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", color: "#b0bac7", fontSize: ".78rem", marginTop: 16 }}>
          אזור אישי לצפייה בלבד · לשאלות פנה לגבאי הגמ״ח
        </div>
      </div>

      {/* מודאל הצעת תיקון לפעולה */}
      {propTxn && (
        <div onClick={e => { if (e.target === e.currentTarget) setPropTxn(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 480, padding: "1.6rem", direction: "rtl" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: BRAND }}>הצעת תיקון לפעולה</h2>
              <button onClick={() => setPropTxn(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ fontSize: ".82rem", color: "#7a8699", marginBottom: 12 }}>הצעתך תישלח לגבאי לאישור. הפעולה לא תשתנה עד שהגבאי יאשר.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
              <div>
                <label style={lblS}>סוג</label>
                <select value={propForm.type} onChange={e => setPropForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lblS}>סכום ₪</label>
                <input type="number" value={propForm.amount} onChange={e => setPropForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lblS}>אופן</label>
                <select value={propForm.method} onChange={e => setPropForm(f => ({ ...f, method: e.target.value }))} style={inp}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lblS}>תאריך לועזי</label>
                <DatePicker value={propForm.greg_date} onChange={propGreg} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lblS}>תאריך עברי (מחושב)</label>
                <div style={{ ...inp, background: "#f4faf8", color: propForm.heb_date ? "#1a1a2e" : "#9aa5b5", display: "flex", alignItems: "center", minHeight: 38 }}>{propForm.heb_date || "—"}</div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lblS}>הערות</label>
                <input value={propForm.notes} onChange={e => setPropForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lblS}>הערה לגבאי (אופציונלי)</label>
                <input value={propForm.member_note} onChange={e => setPropForm(f => ({ ...f, member_note: e.target.value }))} style={inp} placeholder="הסבר קצר על התיקון" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={submitPropose} disabled={savingProp} style={{ padding: "0.55rem 1.3rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>{savingProp ? "שולח…" : "שלח הצעה"}</button>
              <button onClick={() => setPropTxn(null)} style={{ padding: "0.55rem 1.3rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* מודאל הגשת פעולה חדשה לאישור */}
      {addReqOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setAddReqOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 480, padding: "1.6rem", direction: "rtl", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: BRAND }}>הגשת פעולה חדשה לאישור</h2>
              <button onClick={() => setAddReqOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ fontSize: ".82rem", color: "#7a8699", marginBottom: 12 }}>פרט את הפעולה שביצעת וצרף מסמך תיעוד. הבקשה תיכנס לתיק שלך ותמתין לאישור הגבאי.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
              <div>
                <label style={lblS}>סוג</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lblS}>סכום ₪</label>
                <input type="number" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} style={inp} autoFocus />
              </div>
              <div>
                <label style={lblS}>אופן</label>
                <select value={addForm.method} onChange={e => setAddForm(f => ({ ...f, method: e.target.value }))} style={inp}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lblS}>תאריך לועזי</label>
                <DatePicker value={addForm.greg_date} onChange={addGreg} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lblS}>תאריך עברי (מחושב)</label>
                <div style={{ ...inp, background: "#f4faf8", color: addForm.heb_date ? "#1a1a2e" : "#9aa5b5", display: "flex", alignItems: "center", minHeight: 38 }}>{addForm.heb_date || "—"}</div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lblS}>הערות</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lblS}>מסמך תיעוד (קבלה / אסמכתא)</label>
                <input type="file" accept="image/*,application/pdf" onChange={e => setAddFile(e.target.files?.[0] || null)} style={{ ...inp, padding: "0.4rem" }} />
                {addFile && <div style={{ fontSize: ".76rem", color: BRAND, marginTop: 4 }}>נבחר: {addFile.name}</div>}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lblS}>הערה לגבאי (אופציונלי)</label>
                <input value={addForm.member_note} onChange={e => setAddForm(f => ({ ...f, member_note: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={submitAddReq} disabled={savingAddReq} style={{ padding: "0.55rem 1.3rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>{savingAddReq ? "שולח…" : "שלח לאישור"}</button>
              <button onClick={() => setAddReqOpen(false)} style={{ padding: "0.55rem 1.3rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* פופאפ הצלחה — מופיע אחרי הגשת פעולה חדשה ונסגר באיטיות כלפי פנים */}
      {successInfo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)", opacity: successClosing ? 0 : 1, transition: "opacity .55s ease" }}>
          <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 24px 70px rgba(0,0,0,.25)", width: "100%", maxWidth: 420, padding: "1.8rem", direction: "rtl", textAlign: "center", transform: successClosing ? "scale(.55)" : "scale(1)", opacity: successClosing ? 0 : 1, transition: "transform .6s cubic-bezier(.4,0,.2,1), opacity .6s ease" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f5f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <CheckCircle2 size={38} color={BRAND} />
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: "1.2rem", fontWeight: 800, color: BRAND }}>הבקשה הוגשה בהצלחה</h2>
            <div style={{ fontSize: ".85rem", color: "#7a8699", marginBottom: 16 }}>הבקשה מועברת לטיפול ההנהלה ותיכנס לתיק שלך.</div>
            <div style={{ textAlign: "right", background: "#f8fafc", borderRadius: 12, padding: "0.9rem 1rem", display: "flex", flexDirection: "column", gap: 7 }}>
              <SuccessRow label="סוג" value={successInfo.type} />
              <SuccessRow label="סכום" value={ils(Number(successInfo.amount) || 0)} />
              {successInfo.method && <SuccessRow label="אופן" value={successInfo.method} />}
              {(successInfo.heb_date || successInfo.greg_date) && (
                <SuccessRow label="תאריך" value={`${successInfo.heb_date || ""}${successInfo.greg_date ? `${successInfo.heb_date ? " · " : ""}${gdate(successInfo.greg_date)}` : ""}`} />
              )}
              {successInfo.notes && <SuccessRow label="הערות" value={successInfo.notes} />}
              {successInfo.member_note && <SuccessRow label="הערה לגבאי" value={successInfo.member_note} />}
              {successInfo.fileName && <SuccessRow label="מסמך" value={`📎 ${successInfo.fileName}`} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: ".86rem" }}>
      <span style={{ color: "#9aa5b5", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#1a1a2e", fontWeight: 700, textAlign: "left" }}>{value}</span>
    </div>
  );
}

const lblS: React.CSSProperties = { fontSize: ".76rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };
const rowCard: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#f8fafc", borderRadius: 10, padding: "0.5rem 0.85rem", fontSize: ".85rem", color: "#4a5568" };
const miniPill: React.CSSProperties = { color: "#fff", borderRadius: 999, padding: "0.1rem 0.6rem", fontSize: ".72rem", fontWeight: 700, whiteSpace: "nowrap" };
