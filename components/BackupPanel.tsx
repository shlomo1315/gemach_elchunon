"use client";

/**
 * גיבוי ושחזור — לוח הבקרה של המנהל.
 *
 * השחזור מוגן בכוונה בכמה שלבים: בחירת קובץ ← תצוגה מקדימה של מה
 * ישתנה ← הקלדת מילת אישור. זו הפעולה היחידה במערכת שמוחקת הכל,
 * ולכן היא לא נעשית בלחיצה אחת.
 */
import { useState } from "react";

const BRAND = "#107a5e";
const RED = "#c0392b";
const CONFIRM_WORD = "שחזר";

type PreviewRow = { table: string; current: number; incoming: number };

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
      setMsg({ kind: "ok", text: `✓ הגיבוי נשלח למייל (${json.data.filename})` });
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

      {/* --- גיבוי --- */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: ".88rem", color: "var(--muted)", lineHeight: 1.75, marginBottom: 12 }}>
          המערכת שולחת גיבוי מלא למייל המנהל אחת ליום באופן אוטומטי.
          כאן אפשר להוריד גיבוי או לשלוח אותו למייל באופן מיידי.
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
