"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthGuard";
import { PageTitle, Card } from "@/components/ui";

const inp: React.CSSProperties = {
  width: "100%", padding: "0.65rem 0.9rem",
  border: "1.5px solid #d8dde5", borderRadius: 10,
  fontSize: ".95rem", boxSizing: "border-box", outline: "none",
};
const lbl: React.CSSProperties = { fontSize: ".82rem", fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 };
const btn: React.CSSProperties = {
  padding: "0.6rem 1.4rem", background: "#1e6f5c", color: "#fff",
  border: "none", borderRadius: 9, fontWeight: 700, fontSize: ".9rem", cursor: "pointer",
};
const ghostBtn: React.CSSProperties = { ...btn, background: "#eef2f1", color: "#1e6f5c" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 800, color: "#2c3e50", borderBottom: "1px solid #eef0f4", paddingBottom: "0.75rem" }}>
        {title}
      </h3>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [email, setEmail] = useState(user?.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const [oldPass, setOldPass] = useState("");
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
    setOldPass(""); setNewPass(""); setConfirmPass("");
  }

  return (
    <div>
      <PageTitle>הגדרות חשבון</PageTitle>

      <div style={{ maxWidth: 560 }}>
        <Section title="👤 פרטים אישיים">
          <div style={{ marginBottom: "1rem" }}>
            <label style={lbl}>שם תצוגה</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp} placeholder="השם שיוצג במערכת" />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={saveDisplayName} disabled={savingName} style={btn}>
              {savingName ? "שומר…" : "שמור שם"}
            </button>
            {nameMsg && <span style={{ fontSize: ".82rem", color: nameMsg.startsWith("✓") ? "#1e6f5c" : "#e05252" }}>{nameMsg}</span>}
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
            <button onClick={saveEmail} disabled={savingEmail} style={btn}>
              {savingEmail ? "שומר…" : "עדכן מייל"}
            </button>
            {emailMsg && <span style={{ fontSize: ".82rem", color: emailMsg.startsWith("✓") ? "#1e6f5c" : "#e05252" }}>{emailMsg}</span>}
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
            <button onClick={savePassword} disabled={savingPass} style={btn}>
              {savingPass ? "שומר…" : "שנה סיסמה"}
            </button>
            <button onClick={() => { setNewPass(""); setConfirmPass(""); setPassMsg(""); }} style={ghostBtn}>נקה</button>
            {passMsg && <span style={{ fontSize: ".82rem", color: passMsg.startsWith("✓") ? "#1e6f5c" : "#e05252" }}>{passMsg}</span>}
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
    </div>
  );
}
