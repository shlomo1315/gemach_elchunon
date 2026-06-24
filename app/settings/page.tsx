"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthGuard";
import { PageTitle, Card } from "@/components/ui";
import { ils, gdate } from "@/lib/format";

const BRAND = "#107a5e";
const RED = "#e05252";

const inp: React.CSSProperties = {
  width: "100%", padding: "0.65rem 0.9rem",
  border: "1.5px solid #dce1e8", borderRadius: 10,
  fontSize: ".95rem", boxSizing: "border-box", outline: "none",
};
const lbl: React.CSSProperties = { fontSize: ".82rem", fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card hover style={{ marginBottom: 16 }}>
      <h3 className="display" style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 800, color: "var(--text)", borderBottom: "1px solid var(--line)", paddingBottom: "0.75rem", display: "flex", alignItems: "center" }}>
        <span className="section-bar" style={{ marginInlineEnd: 8 }} />
        {title}
      </h3>
      {children}
    </Card>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "0.5rem 1.3rem", borderRadius: 999, border: "none", cursor: "pointer",
      fontWeight: 700, fontSize: ".9rem",
      background: active ? "var(--grad-brand)" : "#eef2f1",
      color: active ? "#fff" : "#7a8699",
      boxShadow: active ? "var(--shadow-brand)" : "none",
    }}>{label}</button>
  );
}

type DeletedTxn = {
  id: string;
  original_id: string;
  member_id: string | null;
  member_name: string | null;
  amount: number | null;
  type: string | null;
  method: string | null;
  greg_date: string | null;
  heb_date: string | null;
  notes: string | null;
  category: string | null;
  original_created_at: string | null;
  deleted_at: string;
  deleted_by: string | null;
};

function DeletedTransactionsTab() {
  const [rows, setRows] = useState<DeletedTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  async function load() {
    setLoading(true);
    setErrMsg("");
    const { data, error } = await supabase
      .from("deleted_transactions")
      .select("*")
      .order("deleted_at", { ascending: false });
    if (error) {
      setErrMsg("לא ניתן לטעון ארכיון — ייתכן שטבלת deleted_transactions עדיין לא נוצרה. הרץ את supabase/deleted-transactions-schema.sql בלוח הניהול של Supabase.");
      setLoading(false);
      return;
    }
    setRows((data as DeletedTxn[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function restore(row: DeletedTxn) {
    if (!confirm(`לשחזר פעולה זו לחבר "${row.member_name || "—"}"?`)) return;
    setRestoring(row.id);
    const { error } = await supabase.from("transactions").insert({
      member_id: row.member_id,
      amount: row.amount,
      type: row.type,
      method: row.method,
      greg_date: row.greg_date,
      heb_date: row.heb_date,
      notes: row.notes,
      category: row.category,
    });
    if (error) { alert("שגיאת שחזור: " + error.message); setRestoring(null); return; }
    await supabase.from("deleted_transactions").delete().eq("id", row.id);
    setRestoring(null);
    load();
  }

  async function permanentDelete(row: DeletedTxn) {
    if (!confirm("למחוק לצמיתות מהארכיון? לא ניתן לשחזר.")) return;
    await supabase.from("deleted_transactions").delete().eq("id", row.id);
    load();
  }

  const TH = (minW: string, extra?: React.CSSProperties): React.CSSProperties => ({
    padding: "0.65rem 0.9rem", textAlign: "right", fontWeight: 700, color: "#4a5568",
    background: "#f8fafc", borderBottom: "2px solid #e8edf2", whiteSpace: "nowrap",
    minWidth: minW, ...extra,
  });
  const TD: React.CSSProperties = {
    padding: "0.7rem 0.9rem", borderBottom: "1px solid #f0f2f5", verticalAlign: "middle", fontSize: ".86rem",
  };

  if (loading) return <div style={{ padding: 36, textAlign: "center", color: "#9aa5b5" }}>טוען ארכיון…</div>;

  if (errMsg) return (
    <Card>
      <div style={{ color: RED, fontSize: ".88rem", lineHeight: 1.7 }}>{errMsg}</div>
    </Card>
  );

  if (rows.length === 0) return (
    <Card>
      <div style={{ textAlign: "center", color: "#9aa5b5", padding: "2.5rem", fontSize: ".95rem" }}>
        אין פעולות מחוקות בארכיון
      </div>
    </Card>
  );

  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: ".82rem", color: "#7a8699", background: "#f0faf6", border: "1px solid #d1ede6", padding: "0.65rem 1rem", borderRadius: 10, lineHeight: 1.6 }}>
        💡 כל פעולה שנמחקת מהמערכת נשמרת כאן עם תאריך המחיקה. ניתן לשחזר כל פעולה בנפרד לכרטסת החבר.
      </div>
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow)", border: "1px solid var(--line)" }}>
        <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: ".86rem", tableLayout: "auto" }}>
          <thead>
            <tr>
              <th style={TH("130px")}>חבר</th>
              <th style={TH("72px", { textAlign: "center" })}>סוג</th>
              <th style={TH("110px", { textAlign: "left" })}>סכום</th>
              <th style={TH("110px")}>תאריך פעולה</th>
              <th style={TH("170px")}>נמחק בתאריך</th>
              <th style={TH("100px")}>הערות</th>
              <th style={TH("140px", { textAlign: "center" })}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td style={{ ...TD, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{row.member_name || "—"}</td>
                <td style={{ ...TD, textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "0.18rem 0.6rem", borderRadius: 999, fontSize: ".76rem", fontWeight: 700, whiteSpace: "nowrap", background: row.type === "משיכה" ? "#fde8e8" : "#e8f5f0", color: row.type === "משיכה" ? RED : BRAND }}>
                    {row.type || "—"}
                  </span>
                </td>
                <td style={{ ...TD, fontWeight: 700, color: row.type === "משיכה" ? RED : BRAND, whiteSpace: "nowrap", textAlign: "left" }} dir="ltr">
                  {row.type === "משיכה" ? "−" : "+"}{ils(row.amount || 0)}
                </td>
                <td style={{ ...TD, color: "#4a5568", whiteSpace: "nowrap" }} dir="ltr">
                  {row.greg_date ? gdate(row.greg_date) : row.heb_date || "—"}
                </td>
                <td style={{ ...TD, color: "#7a8699", fontSize: ".8rem", whiteSpace: "nowrap" }} dir="ltr">
                  {new Date(row.deleted_at).toLocaleString("he-IL")}
                </td>
                <td style={{ ...TD, color: "#9aa5b5", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.notes || <span style={{ color: "#d0d5dd" }}>—</span>}
                </td>
                <td style={{ ...TD, textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    <button onClick={() => restore(row)} disabled={restoring === row.id} className="btn btn-primary btn-sm">
                      {restoring === row.id ? "…" : "שחזר"}
                    </button>
                    <button onClick={() => permanentDelete(row)} disabled={restoring === row.id} className="btn btn-danger btn-sm">
                      מחק
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"account" | "trash">("account");
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [email, setEmail] = useState(user?.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");

  async function saveDisplayName() {
    setSavingName(true); setNameMsg("");
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
    setSavingName(false);
    setNameMsg(error ? `שגיאה: ${error.message}` : "✓ השם עודכן בהצלחה");
  }

  async function saveEmail() {
    if (!email.trim()) return;
    setSavingEmail(true); setEmailMsg("");
    const { error } = await supabase.auth.updateUser({ email });
    setSavingEmail(false);
    setEmailMsg(error ? `שגיאה: ${error.message}` : "✓ נשלח אימייל אישור לכתובת החדשה");
  }

  async function savePassword() {
    if (newPass !== confirmPass) { setPassMsg("הסיסמאות אינן תואמות"); return; }
    if (newPass.length < 6) { setPassMsg("סיסמה חייבת להיות לפחות 6 תווים"); return; }
    setSavingPass(true); setPassMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setSavingPass(false);
    if (error) { setPassMsg(`שגיאה: ${error.message}`); return; }
    setPassMsg("✓ הסיסמה עודכנה בהצלחה");
    setNewPass(""); setConfirmPass("");
  }

  return (
    <div>
      <PageTitle>הגדרות</PageTitle>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <TabBtn active={tab === "account"} onClick={() => setTab("account")} label="⚙️ הגדרות חשבון" />
        <TabBtn active={tab === "trash"} onClick={() => setTab("trash")} label="🗑️ פעולות מחוקות" />
      </div>

      {tab === "account" && (
        <div style={{ maxWidth: 560 }}>
          <Section title="👤 פרטים אישיים">
            <div style={{ marginBottom: "1rem" }}>
              <label style={lbl}>שם תצוגה</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp} placeholder="השם שיוצג במערכת" />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={saveDisplayName} disabled={savingName} className="btn btn-primary">
                {savingName ? "שומר…" : "שמור שם"}
              </button>
              {nameMsg && <span style={{ fontSize: ".82rem", color: nameMsg.startsWith("✓") ? BRAND : RED }}>{nameMsg}</span>}
            </div>
          </Section>

          <Section title="📧 כתובת מייל">
            <div style={{ marginBottom: "1rem" }}>
              <label style={lbl}>מייל נוכחי</label>
              <div style={{ fontSize: ".9rem", color: "#4a5568", padding: "0.5rem 0", fontWeight: 600 }}>{user?.email}</div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={lbl}>מייל חדש</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} dir="ltr" />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={saveEmail} disabled={savingEmail} className="btn btn-primary">
                {savingEmail ? "שומר…" : "עדכן מייל"}
              </button>
              {emailMsg && <span style={{ fontSize: ".82rem", color: emailMsg.startsWith("✓") ? BRAND : RED }}>{emailMsg}</span>}
            </div>
          </Section>

          <Section title="🔒 שינוי סיסמה">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginBottom: "1rem" }}>
              <div>
                <label style={lbl}>סיסמה חדשה</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} style={inp} placeholder="מינימום 6 תווים" dir="ltr" />
              </div>
              <div>
                <label style={lbl}>אישור סיסמה</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={inp} placeholder="הקלד שוב" dir="ltr" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={savePassword} disabled={savingPass} className="btn btn-primary">
                {savingPass ? "שומר…" : "שנה סיסמה"}
              </button>
              <button onClick={() => { setNewPass(""); setConfirmPass(""); setPassMsg(""); }} className="btn btn-soft">נקה</button>
              {passMsg && <span style={{ fontSize: ".82rem", color: passMsg.startsWith("✓") ? BRAND : RED }}>{passMsg}</span>}
            </div>
          </Section>

          <Section title="ℹ️ פרטי חשבון">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                ["מזהה משתמש", user?.id?.slice(0, 8) + "…"],
                ["ספק כניסה", "Email"],
                ["נוצר ב", user?.created_at ? new Date(user.created_at).toLocaleDateString("he-IL") : "—"],
                ["כניסה אחרונה", user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("he-IL") : "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: ".73rem", color: "#9aa5b5" }}>{l}</div>
                  <div style={{ fontWeight: 600, fontSize: ".88rem", fontFamily: "monospace" }}>{v}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "trash" && <DeletedTransactionsTab />}
    </div>
  );
}
