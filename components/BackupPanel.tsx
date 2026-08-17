"use client";

/**
 * גיבוי ושחזור — לוח הבקרה של המנהל.
 *
 * השחזור מוגן בכוונה בכמה שלבים: בחירת קובץ ← תצוגה מקדימה של מה
 * ישתנה ← הקלדת מילת אישור. זו הפעולה היחידה במערכת שמוחקת הכל,
 * ולכן היא לא נעשית בלחיצה אחת.
 */
import { useEffect, useState } from "react";

const BRAND = "#107a5e";
const RED = "#c0392b";
const CONFIRM_WORD = "שחזר";

type PreviewRow = { table: string; current: number; incoming: number };

type Settings = {
  enabled: boolean;
  backup_email: string | null;
  effective_email: string | null;
  admin_email: string | null;
  last_sent_at: string | null;
  last_status: string | null;
  last_error: string | null;
  days_since: number | null;
};

const TABLE_LABEL: Record<string, string> = {
  members: "חברים",
  transactions: "פעולות",
  checks: "שיקים",
  transaction_change_requests: "בקשות תיקון",
  member_requests: "בקשות חברים",
  deleted_transactions: "פעולות מחוקות",
  app_users: "משתמשי המערכת",
  documents: "מסמכים",
  email_settings: "הגדרות מייל",
};

export default function BackupPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // הגדרות
  const [settings, setSettings] = useState<Settings | null>(null);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    fetch("/api/backup/settings")
      .then(r => r.json())
      .then(j => {
        if (j?.data) { setSettings(j.data); setEmailInput(j.data.backup_email ?? ""); }
      })
      .catch(() => { /* ההגדרות אינן קריטיות לשאר הפאנל */ });
  }, []);

  async function saveSettings(patch: { enabled?: boolean; backup_email?: string | null }) {
    setBusy("settings"); setMsg(null);
    try {
      const res = await fetch("/api/backup/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: patch.enabled ?? settings?.enabled ?? true,
          backup_email: patch.backup_email !== undefined ? patch.backup_email : emailInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "השמירה נכשלה");
      setSettings(s => (s ? { ...s, ...json.data } : json.data));
      setMsg({ kind: "ok", text: "✓ ההגדרות נשמרו" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally { setBusy(null); }
  }

  // שחזור
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [backupDate, setBackupDate] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");

  function reset() {
    setFile(null); setParsed(null); setPreview(null);
    setBackupDate(""); setConfirmText("");
  }

  /** הורדת גיבוי ישירות למחשב */
  async function download() {
    setBusy("download"); setMsg(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error((await res.json())?.error || "ההורדה נכשלה");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gemach-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setMsg({ kind: "ok", text: "✓ הגיבוי ירד למחשב" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally { setBusy(null); }
  }

  /** שליחת גיבוי למייל המנהל עכשיו */
  async function sendToEmail() {
    setBusy("email"); setMsg(null);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "השליחה נכשלה");
      setMsg({ kind: "ok", text: `✓ הגיבוי נשלח אל ${json.data.to} (${json.data.filename})` });
      // רענון הסטטוס כדי שתאריך "גיבוי אחרון" יתעדכן מיד
      fetch("/api/backup/settings").then(r => r.json())
        .then(j => { if (j?.data) setSettings(j.data); }).catch(() => {});
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally { setBusy(null); }
  }

  /** קריאת הקובץ שנבחר ובקשת תצוגה מקדימה מהשרת */
  async function loadFile(f: File) {
    setBusy("preview"); setMsg(null); setPreview(null); setConfirmText("");
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      setFile(f); setParsed(data);

      const res = await fetch("/api/backup/restore?preview=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "הקובץ אינו תקין");

      setPreview(json.data.tables);
      setBackupDate(json.data.created_at);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
      reset();
    } finally { setBusy(null); }
  }

  /** ביצוע השחזור בפועל */
  async function doRestore() {
    if (confirmText.trim() !== CONFIRM_WORD) return;
    setBusy("restore"); setMsg(null);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: parsed, confirm: CONFIRM_WORD }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "השחזור נכשל");
      setMsg({ kind: "ok", text: `✓ השחזור הושלם — ${json.data.total} רשומות. ${json.data.safetyNote}` });
      reset();
      setTimeout(() => window.location.reload(), 2500);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally { setBusy(null); }
  }

  const btn: React.CSSProperties = {
    padding: "0.6rem 1.1rem", borderRadius: 10, border: "none",
    fontWeight: 700, fontSize: ".9rem", cursor: "pointer",
  };

  return (
    <div>
      {msg && (
        <div style={{
          background: msg.kind === "ok" ? "#e7f5ef" : "#fdeaea",
          color: msg.kind === "ok" ? "#0c5642" : RED,
          borderRadius: 10, padding: "0.7rem 0.95rem", fontSize: ".88rem",
          marginBottom: 14, lineHeight: 1.6,
        }}>{msg.text}</div>
      )}

      {/* --- הגדרות הגיבוי --- */}
      <div style={{ marginBottom: 20, background: "#f8fafb", border: "1px solid var(--line)", borderRadius: 12, padding: "1rem 1.1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: ".92rem" }}>גיבוי יומי אוטומטי</div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: ".86rem" }}>
            <input
              type="checkbox"
              checked={settings?.enabled ?? true}
              disabled={!!busy}
              onChange={e => saveSettings({ enabled: e.target.checked })}
              style={{ width: 17, height: 17, accentColor: BRAND, cursor: "pointer" }}
            />
            {settings?.enabled === false ? "כבוי" : "פעיל"}
          </label>
        </div>

        <label style={{ fontSize: ".82rem", fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>
          כתובת המייל לקבלת הגיבוי
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder={settings?.admin_email || "name@example.com"}
            dir="ltr"
            style={{
              flex: "1 1 240px", padding: "0.55rem 0.85rem", border: "1.5px solid #dce1e8",
              borderRadius: 10, fontSize: ".92rem", outline: "none", boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => saveSettings({ backup_email: emailInput })}
            disabled={!!busy}
            style={{ padding: "0.55rem 1.1rem", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontWeight: 700, fontSize: ".88rem", cursor: "pointer" }}>
            {busy === "settings" ? "שומר…" : "שמור"}
          </button>
        </div>
        <div style={{ fontSize: ".76rem", color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
          אם השדה ריק, הגיבוי יישלח למייל המנהל{settings?.admin_email ? ` (${settings.admin_email})` : ""}.
        </div>

        {/* סטטוס הגיבוי האחרון */}
        {settings && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: ".82rem", lineHeight: 1.7 }}>
            {settings.last_sent_at ? (
              <div style={{ color: "var(--muted)" }}>
                גיבוי אחרון נשלח: <b style={{ color: "var(--text)" }}>
                  {new Date(settings.last_sent_at).toLocaleString("he-IL")}
                </b>
                {settings.effective_email ? <> · אל {settings.effective_email}</> : null}
              </div>
            ) : (
              <div style={{ color: "#8a6d1f" }}>עדיין לא נשלח גיבוי מהמערכת.</div>
            )}

            {settings.last_status === "failed" && settings.last_error && (
              <div style={{ color: RED, marginTop: 4 }}>
                הניסיון האחרון נכשל: {settings.last_error}
              </div>
            )}

            {settings.days_since != null && settings.days_since >= 3 && (
              <div style={{ marginTop: 8, background: "#fff8ec", border: "1px solid #f0e0c0", color: "#8a6d1f", borderRadius: 8, padding: "0.5rem 0.7rem" }}>
                ⚠ עברו {settings.days_since} ימים מאז הגיבוי האחרון. הגיבוי נשלח בכניסה למערכת —
                אם לא נכנסים במשך כמה ימים, לא נוצר גיבוי. כדאי ללחוץ &quot;שלח גיבוי עכשיו&quot;.
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- גיבוי --- */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: ".88rem", color: "var(--muted)", lineHeight: 1.75, marginBottom: 12 }}>
          הגיבוי נבדק אוטומטית בכל כניסה למערכת ונשלח אם עברה יממה מהאחרון.
          כאן אפשר להוריד גיבוי או לשלוח אותו מיד.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={download} disabled={!!busy}
            style={{ ...btn, background: "var(--grad-brand)", color: "#fff" }}>
            {busy === "download" ? "מכין…" : "⬇ הורד גיבוי למחשב"}
          </button>
          <button onClick={sendToEmail} disabled={!!busy}
            style={{ ...btn, background: "#eef2f1", color: BRAND }}>
            {busy === "email" ? "שולח…" : "✉ שלח גיבוי למייל עכשיו"}
          </button>
        </div>
      </div>

      {/* --- שחזור --- */}
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
        <div style={{ fontWeight: 800, color: RED, marginBottom: 6, fontSize: ".95rem" }}>
          שחזור מקובץ גיבוי
        </div>
        <div style={{ fontSize: ".85rem", color: "var(--muted)", lineHeight: 1.75, marginBottom: 12 }}>
          שחזור מוחק את כל הנתונים הקיימים ומחליף אותם בתוכן הקובץ.
          לפני הביצוע יישלח אליך אוטומטית גיבוי של המצב הנוכחי, כדי שתמיד תהיה דרך חזרה.
        </div>

        <label style={{
          display: "inline-block", padding: "0.6rem 1.1rem", borderRadius: 10,
          background: "#fff", border: "1.5px dashed #dce1e8", cursor: busy ? "default" : "pointer",
          fontSize: ".88rem", color: "var(--text)", fontWeight: 600,
        }}>
          {file ? `📄 ${file.name}` : "בחר קובץ גיבוי (.json)"}
          <input type="file" accept=".json,application/json" style={{ display: "none" }}
            disabled={!!busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
        </label>

        {busy === "preview" && (
          <div style={{ fontSize: ".85rem", color: "var(--muted)", marginTop: 10 }}>בודק את הקובץ…</div>
        )}

        {/* תצוגה מקדימה — מה בדיוק ישתנה */}
        {preview && (
          <div style={{ marginTop: 16, background: "#fffbf5", border: "1px solid #f0e0c0", borderRadius: 12, padding: "1rem 1.1rem" }}>
            <div style={{ fontWeight: 800, marginBottom: 4, color: "#8a6d1f" }}>
              ⚠ בדוק לפני האישור
            </div>
            {backupDate && (
              <div style={{ fontSize: ".82rem", color: "var(--muted)", marginBottom: 10 }}>
                הקובץ נוצר בתאריך {new Date(backupDate).toLocaleString("he-IL")}
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
                <thead>
                  <tr style={{ color: "var(--muted)" }}>
                    <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", fontWeight: 600 }}>טבלה</th>
                    <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", fontWeight: 600 }}>יש כעת</th>
                    <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", fontWeight: 600 }}>יהיה אחרי</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(r => {
                    const loses = r.incoming < r.current;
                    return (
                      <tr key={r.table} style={{ borderTop: "1px solid #f2e8d8" }}>
                        <td style={{ padding: "0.35rem 0.5rem" }}>{TABLE_LABEL[r.table] ?? r.table}</td>
                        <td style={{ padding: "0.35rem 0.5rem", fontVariantNumeric: "tabular-nums" }}>{r.current}</td>
                        <td style={{
                          padding: "0.35rem 0.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                          color: loses ? RED : r.incoming > r.current ? BRAND : "var(--text)",
                        }}>
                          {r.incoming}{loses ? ` (−${r.current - r.incoming})` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: ".85rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                לאישור, הקלד את המילה <b style={{ color: RED }}>{CONFIRM_WORD}</b>:
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                style={{
                  padding: "0.55rem 0.85rem", border: "1.5px solid #dce1e8",
                  borderRadius: 10, fontSize: ".95rem", width: 200, outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                onClick={doRestore}
                disabled={confirmText.trim() !== CONFIRM_WORD || !!busy}
                style={{
                  ...btn,
                  background: confirmText.trim() === CONFIRM_WORD ? RED : "#e6e9ed",
                  color: confirmText.trim() === CONFIRM_WORD ? "#fff" : "#9aa5b5",
                  cursor: confirmText.trim() === CONFIRM_WORD && !busy ? "pointer" : "default",
                }}>
                {busy === "restore" ? "משחזר…" : "שחזר את המערכת מהקובץ"}
              </button>
              <button onClick={reset} disabled={!!busy} style={{ ...btn, background: "#eef2f1", color: "var(--muted)" }}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
