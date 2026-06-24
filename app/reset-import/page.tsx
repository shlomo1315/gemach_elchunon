"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { UploadCloud, AlertTriangle, CheckCircle2, FileSpreadsheet, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ils, toHebrewDate } from "@/lib/format";
import { PageTitle, Card, Button } from "@/components/ui";

const BRAND = "#107a5e";
const RED = "#e05252";
const UNASSIGNED = "כללי (לא משויך)";

type Txn = { name: string; amount: number; type: "הפקדה" | "משיכה"; greg_date: string | null; heb_date: string | null; notes: string };
type Mem = { name: string; phone: string; address: string };
type Parsed = {
  members: Mem[];
  txns: Txn[];
  totalDep: number;
  totalWit: number;
};

// תאריך: אם זה Date או מספר סריאלי → לועזי; אחרת טקסט עברי
function resolveDate(v: any): { greg: string | null; heb: string | null } {
  if (v == null || v === "") return { greg: null, heb: null };
  if (v instanceof Date && !isNaN(v.getTime())) {
    // התעלם מתאריך ברירת מחדל של אקסל 1899
    if (v.getFullYear() < 1910) return { greg: null, heb: null };
    const greg = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
    return { greg, heb: toHebrewDate(greg) };
  }
  if (typeof v === "number") {
    if (v > 20000 && v < 80000 && XLSX.SSF) {
      const d = XLSX.SSF.parse_date_code(v);
      if (d && d.y >= 1910) {
        const greg = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        return { greg, heb: toHebrewDate(greg) };
      }
    }
    return { greg: null, heb: String(v) };
  }
  // טקסט עברי (כגון "כא טבת פא")
  return { greg: null, heb: String(v).trim() };
}

function parseWorkbook(wb: XLSX.WorkBook): Parsed {
  const need = ["הפקדות", "משיכות", "ראשי"];
  for (const n of need) if (!wb.Sheets[n]) throw new Error(`חסר גיליון "${n}" בקובץ`);

  const dep = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["הפקדות"], { header: 1, defval: "", raw: true });
  const wit = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["משיכות"], { header: 1, defval: "", raw: true });
  const main = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["ראשי"], { header: 1, defval: "", raw: true });

  const txns: Txn[] = [];

  // הפקדות: גיליון "הפקדות", עמודות 6=מזהה,7=שם,8=סכום,9=תאריך,10=הערות
  for (let r = 2; r < dep.length; r++) {
    const row = dep[r];
    const a = row[8];
    if (typeof a === "number" && a > 0) {
      let name = String(row[7] ?? "").trim();
      if (!name) name = UNASSIGNED;
      const d = resolveDate(row[9]);
      txns.push({ name, amount: a, type: "הפקדה", greg_date: d.greg, heb_date: d.heb, notes: String(row[10] ?? "").trim() });
    }
  }

  // משיכות: גיליון "משיכות", עמודות 0=מזהה,1=שם,2=סכום,3=תאריך,4=הערות
  for (let r = 2; r < wit.length; r++) {
    const row = wit[r];
    const a = row[2];
    if (typeof a === "number" && a > 0) {
      let name = String(row[1] ?? "").trim();
      if (!name) name = UNASSIGNED;
      const d = resolveDate(row[3]);
      txns.push({ name, amount: a, type: "משיכה", greg_date: d.greg, heb_date: d.heb, notes: String(row[4] ?? "").trim() });
    }
  }

  // חברים מגיליון "ראשי": 0=שם+מספר, 3=שם, 4=כתובת, 5=טלפון
  const memMap = new Map<string, Mem>();
  for (let r = 4; r < main.length; r++) {
    const row = main[r];
    if (!String(row[0] ?? "").match(/.+\d+$/)) continue;
    const name = String(row[3] ?? "").trim();
    if (!name) continue;
    const phoneRaw = row[5];
    const phone = phoneRaw == null || phoneRaw === "" ? "" : String(phoneRaw).trim();
    const address = String(row[4] ?? "").trim();
    if (!memMap.has(name)) memMap.set(name, { name, phone, address });
  }
  // חברים שמופיעים בפעולות אך לא ב"ראשי" + החבר המיוחד
  for (const t of txns) if (!memMap.has(t.name)) memMap.set(t.name, { name: t.name, phone: "", address: "" });

  const totalDep = txns.filter(t => t.type === "הפקדה").reduce((s, t) => s + t.amount, 0);
  const totalWit = txns.filter(t => t.type === "משיכה").reduce((s, t) => s + t.amount, 0);

  return { members: Array.from(memMap.values()), txns, totalDep, totalWit };
}

export default function ResetImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState<{ members: number; txns: number } | null>(null);

  function handleFile(file: File) {
    setError(""); setParsed(null); setDone(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const p = parseWorkbook(wb);
        setParsed(p);
        setFileName(file.name);
      } catch (err: any) {
        setError(err?.message || String(err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function runReset() {
    if (!parsed) return;
    setBusy(true); setError(""); setProgress("מוחק נתונים קיימים…");
    try {
      // 1) מחיקת כל הפעולות ואז כל החברים
      const dT = await supabase.from("transactions").delete().not("id", "is", null);
      if (dT.error) throw new Error("מחיקת פעולות: " + dT.error.message);
      const dM = await supabase.from("members").delete().not("id", "is", null);
      if (dM.error) throw new Error("מחיקת חברים: " + dM.error.message);

      // 2) הכנסת חברים
      setProgress(`מכניס ${parsed.members.length} חברים…`);
      const memPayload = parsed.members.map(m => ({
        name: m.name,
        code: (m.phone.replace(/\D/g, "").slice(-4)) || null,
        phone: m.phone || null,
        address: m.address || null,
      }));
      const nameToId = new Map<string, string>();
      const CH = 500;
      for (let i = 0; i < memPayload.length; i += CH) {
        const { data, error } = await supabase.from("members").insert(memPayload.slice(i, i + CH)).select("id, name");
        if (error) throw new Error("הכנסת חברים: " + error.message);
        (data as { id: string; name: string }[]).forEach(m => nameToId.set(m.name, m.id));
      }

      // 3) הכנסת פעולות
      setProgress(`מכניס ${parsed.txns.length} פעולות…`);
      const txnPayload = parsed.txns.map(t => ({
        member_id: nameToId.get(t.name)!,
        amount: t.amount,
        type: t.type,
        method: null,
        greg_date: t.greg_date,
        heb_date: t.heb_date,
        notes: t.notes || null,
      })).filter(t => t.member_id);

      for (let i = 0; i < txnPayload.length; i += CH) {
        setProgress(`מכניס פעולות… ${Math.min(i + CH, txnPayload.length)}/${txnPayload.length}`);
        const { error } = await supabase.from("transactions").insert(txnPayload.slice(i, i + CH));
        if (error) throw new Error("הכנסת פעולות: " + error.message);
      }

      setDone({ members: parsed.members.length, txns: txnPayload.length });
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false); setProgress("");
    }
  }

  const balance = parsed ? parsed.totalDep - parsed.totalWit : 0;
  const ready = confirmText.trim() === "אפס";

  return (
    <div style={{ direction: "rtl", maxWidth: 760 }}>
      <PageTitle>איפוס וייבוא נתונים</PageTitle>

      {!done && (
        <div style={{ background: "#fff8e1", border: "1px solid #f59e0b40", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={20} color="#b7791f" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: ".88rem", color: "#7a5b18", lineHeight: 1.6 }}>
            <strong>שים לב:</strong> פעולה זו תמחק את <strong>כל</strong> החברים והפעולות הקיימים במערכת ותטען מחדש את הנתונים מהקובץ. ודא שיש לך גיבוי.
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: "#fde8e8", color: "#c0392b", padding: "0.75rem 1rem", borderRadius: 10, marginBottom: 16, display: "flex", gap: 8, alignItems: "center", fontSize: ".88rem" }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {done ? (
        <Card style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <CheckCircle2 size={56} color={BRAND} />
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "1rem 0 0.5rem" }}>הייבוא הושלם בהצלחה!</h2>
          <div style={{ display: "flex", gap: 28, justifyContent: "center", margin: "1.5rem 0" }}>
            <div><div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#16a085" }}>{done.members}</div><div style={{ fontSize: ".8rem", color: "#9aa5b5" }}>חברים</div></div>
            <div><div style={{ fontSize: "1.8rem", fontWeight: 800, color: BRAND }}>{done.txns}</div><div style={{ fontSize: ".8rem", color: "#9aa5b5" }}>פעולות</div></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Button onClick={() => router.push("/")}>לדף הראשי <ArrowRight size={15} /></Button>
            <Button variant="ghost" onClick={() => router.push("/members")}>לרשימת החברים</Button>
          </div>
        </Card>
      ) : !parsed ? (
        <Card>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            style={{ border: "2px dashed #cdd6df", borderRadius: 16, padding: "3rem 2rem", textAlign: "center", cursor: "pointer", background: "#fafbfc" }}
          >
            <UploadCloud size={48} color={BRAND} style={{ opacity: .8 }} />
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: 12 }}>העלה את קובץ הגמ״ח (.xlsm / .xlsx)</div>
            <div style={{ fontSize: ".85rem", color: "#9aa5b5", marginTop: 6 }}>גרור לכאן או לחץ לבחירה</div>
            <input ref={fileRef} type="file" accept=".xlsm,.xlsx,.xls" style={{ display: "none" }}
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: BRAND, fontWeight: 700, marginBottom: 16 }}>
              <FileSpreadsheet size={20} /> {fileName}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Box label="חברים" value={String(parsed.members.length)} color="#3b82f6" />
              <Box label="פעולות" value={String(parsed.txns.length)} color={BRAND} />
              <Box label="סך הפקדות" value={ils(parsed.totalDep)} color="#16a085" />
              <Box label="סך משיכות" value={ils(parsed.totalWit)} color={RED} />
              <Box label="יתרה בקופה" value={ils(balance)} color={balance >= 0 ? BRAND : RED} wide />
            </div>
          </Card>

          {!busy ? (
            <Card>
              <div style={{ fontSize: ".9rem", color: "#4a5568", marginBottom: 12 }}>
                לאישור המחיקה והייבוא, הקלד <strong style={{ color: RED }}>אפס</strong> בתיבה:
              </div>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder="הקלד: אפס"
                style={{ padding: "0.6rem 0.9rem", border: `1.5px solid ${ready ? BRAND : "#d8dde5"}`, borderRadius: 10, fontSize: "1rem", width: 200, textAlign: "center", fontWeight: 700, marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={runReset} disabled={!ready}
                  style={{ padding: "0.6rem 1.4rem", background: ready ? RED : "#e2e8f0", color: ready ? "#fff" : "#9aa5b5", border: "none", borderRadius: 9, fontWeight: 700, fontSize: ".92rem", cursor: ready ? "pointer" : "not-allowed" }}>
                  אפס וייבא הכל
                </button>
                <Button variant="ghost" onClick={() => { setParsed(null); setConfirmText(""); }}>ביטול</Button>
              </div>
            </Card>
          ) : (
            <Card style={{ textAlign: "center", padding: "2.5rem" }}>
              <Loader2 size={40} color={BRAND} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              <div style={{ marginTop: 14, fontSize: ".95rem", fontWeight: 600, color: "#2c3e50" }}>{progress}</div>
              <div style={{ marginTop: 6, fontSize: ".82rem", color: "#9aa5b5" }}>אנא אל תסגור את הדף</div>
            </Card>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Box({ label, value, color, wide }: { label: string; value: string; color: string; wide?: boolean }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: "0.85rem 1.1rem", borderRight: `4px solid ${color}`, gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: ".75rem", color: "#9aa5b5", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: "1.45rem", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
