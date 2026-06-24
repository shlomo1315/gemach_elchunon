"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ils, toHebrewDate, TXN_METHODS } from "@/lib/format";
import { PageTitle, Card, Button, Loading } from "@/components/ui";
import type { Member } from "@/types";

const BRAND = "#107a5e";
const RED = "#e05252";

/* ---------- שדות מיפוי ---------- */
type FieldId = "ignore" | "name" | "code" | "phone" | "address" | "amount" | "deposit" | "withdrawal" | "type" | "date" | "method" | "notes";
const FIELD_LABELS: Record<FieldId, string> = {
  ignore: "— התעלם —",
  name: "שם החבר",
  code: "קוד",
  phone: "טלפון",
  address: "כתובת",
  amount: "סכום (חתום +/−)",
  deposit: "הפקדה (עמודה נפרדת)",
  withdrawal: "משיכה (עמודה נפרדת)",
  type: "סוג (הפקדה/משיכה)",
  date: "תאריך",
  method: "אופן פעולה",
  notes: "הערות",
};
const FIELD_ORDER: FieldId[] = ["ignore", "name", "code", "phone", "address", "type", "amount", "deposit", "withdrawal", "date", "method", "notes"];

// ניחוש אוטומטי לפי כותרת בעברית
function guessField(header: string): FieldId {
  const h = (header || "").trim();
  const has = (...keys: string[]) => keys.some(k => h.includes(k));
  if (has("שם", "חבר", "משפחה")) return "name";
  if (has("קוד", "מספר חבר", "מס' חבר", "ת.ז", "תז")) return "code";
  if (has("טלפון", "פלאפון", "נייד", 'טל"')) return "phone";
  if (has("כתובת", "עיר", "ישוב", "יישוב", "רחוב")) return "address";
  if (has("אופן", "אמצעי", "צורת תשלום", "שיטה")) return "method";
  if (has("סוג", "פעולה")) return "type";
  if (has("הפקדה", "הפקדות", "זכות", "כניסה", "נכנס", "תרומה")) return "deposit";
  if (has("משיכה", "משיכות", "חובה", "יציאה", "הלוואה", "הלוואות", "יצא")) return "withdrawal";
  if (has("תאריך")) return "date";
  if (has("סכום", "סה\"כ", "סך")) return "amount";
  if (has("הערה", "הערות", "תיאור", "פרטים")) return "notes";
  return "ignore";
}

// המרת מספר מטקסט (הסרת ₪, פסיקים, רווחים)
function parseNum(v: any): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[₪,\s"']/g, "").replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
}

// המרת תאריך לפורמט YYYY-MM-DD
function parseDate(v: any): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy or dd.mm.yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return "";
}

function normalizeType(v: any): "הפקדה" | "משיכה" | "" {
  const s = String(v || "");
  if (/הפקד|זכות|תרומ|כניס/.test(s)) return "הפקדה";
  if (/משיכ|חוב|הלוו|יציא/.test(s)) return "משיכה";
  return "";
}

type ParsedTxn = {
  memberName: string; code: string; phone: string; address: string;
  amount: number; type: "הפקדה" | "משיכה"; greg_date: string; method: string; notes: string;
  _row: number;
};

type MemberAction = "create" | "attach" | "skip";

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [rows, setRows] = useState<any[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<FieldId[]>([]);
  const [sheetAsName, setSheetAsName] = useState(false);
  const [defaultType, setDefaultType] = useState<"הפקדה" | "משיכה">("הפקדה");
  const [defaultMethod, setDefaultMethod] = useState("");

  const [existingMembers, setExistingMembers] = useState<Member[]>([]);
  const [actions, setActions] = useState<Record<string, MemberAction>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ membersCreated: number; txnsAdded: number; skipped: number } | null>(null);

  /* ---------- שלב 1: קריאת קובץ ---------- */
  function handleFile(file: File) {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const book = XLSX.read(data, { type: "array", cellDates: true });
        setWb(book);
        setSheetNames(book.SheetNames);
        setFileName(file.name);
        loadSheet(book, book.SheetNames[0]);
        setStep(2);
      } catch (err: any) {
        setError("שגיאה בקריאת הקובץ: " + (err?.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function loadSheet(book: XLSX.WorkBook, name: string) {
    const ws = book.Sheets[name];
    const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "", blankrows: false });
    setSheet(name);
    setRows(arr);
    // זיהוי שורת כותרת: השורה עם הכי הרבה תאים טקסטואליים מתוך 8 הראשונות
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(8, arr.length); i++) {
      const score = arr[i].filter(c => typeof c === "string" && c.trim().length > 0).length;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    setHeaderRow(best);
    const headers = (arr[best] || []).map(String);
    setMapping(headers.map(guessField));
  }

  const headers: string[] = useMemo(() => (rows[headerRow] || []).map(String), [rows, headerRow]);
  const dataRows = useMemo(() => rows.slice(headerRow + 1), [rows, headerRow]);

  /* ---------- שלב 2→3: פירוק לפעולות ---------- */
  function buildParsed(): ParsedTxn[] {
    const out: ParsedTxn[] = [];
    const col = (f: FieldId) => mapping.indexOf(f);
    const ci = {
      name: col("name"), code: col("code"), phone: col("phone"), address: col("address"),
      amount: col("amount"), deposit: col("deposit"), withdrawal: col("withdrawal"),
      type: col("type"), date: col("date"), method: col("method"), notes: col("notes"),
    };

    function processSheet(arr: any[][], hRow: number, sheetName: string) {
      for (let r = hRow + 1; r < arr.length; r++) {
        const row = arr[r];
        if (!row || row.every(c => c === "" || c == null)) continue;

        const memberName = sheetAsName ? sheetName : String(ci.name >= 0 ? row[ci.name] ?? "" : "").trim();
        if (!memberName) continue;

        let amount = NaN;
        let type: "הפקדה" | "משיכה" = defaultType;

        if (ci.deposit >= 0 || ci.withdrawal >= 0) {
          const dep = ci.deposit >= 0 ? parseNum(row[ci.deposit]) : NaN;
          const wit = ci.withdrawal >= 0 ? parseNum(row[ci.withdrawal]) : NaN;
          if (!isNaN(dep) && dep !== 0) { amount = Math.abs(dep); type = "הפקדה"; }
          else if (!isNaN(wit) && wit !== 0) { amount = Math.abs(wit); type = "משיכה"; }
          else continue;
        } else if (ci.amount >= 0) {
          const raw = parseNum(row[ci.amount]);
          if (isNaN(raw) || raw === 0) continue;
          if (ci.type >= 0) {
            const t = normalizeType(row[ci.type]);
            type = t || defaultType;
          } else {
            type = raw < 0 ? "משיכה" : "הפקדה";
          }
          amount = Math.abs(raw);
        } else {
          continue;
        }

        const greg_date = ci.date >= 0 ? parseDate(row[ci.date]) : "";
        const method = ci.method >= 0 ? String(row[ci.method] ?? "").trim() : defaultMethod;
        const notes = ci.notes >= 0 ? String(row[ci.notes] ?? "").trim() : "";
        const code = ci.code >= 0 ? String(row[ci.code] ?? "").trim() : "";
        const phone = ci.phone >= 0 ? String(row[ci.phone] ?? "").trim() : "";
        const address = ci.address >= 0 ? String(row[ci.address] ?? "").trim() : "";

        out.push({ memberName, code, phone, address, amount, type, greg_date, method, notes, _row: r + 1 });
      }
    }

    if (sheetAsName && wb) {
      for (const sn of sheetNames) {
        const ws = wb.Sheets[sn];
        const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "", blankrows: false });
        // נסה לזהות שורת כותרת בכל גיליון
        let best = 0, bestScore = -1;
        for (let i = 0; i < Math.min(8, arr.length); i++) {
          const score = arr[i].filter(c => typeof c === "string" && c.trim().length > 0).length;
          if (score > bestScore) { bestScore = score; best = i; }
        }
        processSheet(arr, best, sn);
      }
    } else {
      processSheet(rows, headerRow, sheet);
    }
    return out;
  }

  const [parsed, setParsed] = useState<ParsedTxn[]>([]);

  // קיבוץ לפי חבר
  const memberGroups = useMemo(() => {
    const map = new Map<string, { name: string; code: string; phone: string; address: string; txns: ParsedTxn[] }>();
    for (const t of parsed) {
      const key = t.memberName.trim();
      if (!map.has(key)) map.set(key, { name: key, code: t.code, phone: t.phone, address: t.address, txns: [] });
      const g = map.get(key)!;
      g.txns.push(t);
      if (!g.code && t.code) g.code = t.code;
      if (!g.phone && t.phone) g.phone = t.phone;
      if (!g.address && t.address) g.address = t.address;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [parsed]);

  function findExisting(name: string, code: string): Member | undefined {
    const n = name.trim();
    return existingMembers.find(m =>
      (m.name || "").trim() === n || (code && m.code && m.code.trim() === code.trim())
    );
  }

  async function goToPreview() {
    setError("");
    const p = buildParsed();
    if (p.length === 0) {
      setError("לא זוהו פעולות. ודא שמיפית עמודת שם וסכום (או הפקדה/משיכה).");
      return;
    }
    const { data } = await supabase.from("members").select("*");
    const ex = (data as Member[]) || [];
    setExistingMembers(ex);
    setParsed(p);
    // ברירת מחדל: חבר קיים → צרף, חדש → צור
    const initActions: Record<string, MemberAction> = {};
    const groups = new Map<string, { name: string; code: string }>();
    p.forEach(t => { if (!groups.has(t.memberName.trim())) groups.set(t.memberName.trim(), { name: t.memberName.trim(), code: t.code }); });
    groups.forEach(g => {
      const exist = ex.find(m => (m.name || "").trim() === g.name || (g.code && m.code && m.code.trim() === g.code.trim()));
      initActions[g.name] = exist ? "attach" : "create";
    });
    setActions(initActions);
    setStep(3);
  }

  /* ---------- שלב 4: ייבוא ---------- */
  async function runImport() {
    setBusy(true);
    setError("");
    try {
      let membersCreated = 0, txnsAdded = 0, skipped = 0;
      const nameToId = new Map<string, string>();
      existingMembers.forEach(m => nameToId.set((m.name || "").trim(), m.id));

      // 1) יצירת חברים חדשים
      const toCreate = memberGroups.filter(g => actions[g.name] === "create");
      if (toCreate.length > 0) {
        const payload = toCreate.map(g => ({
          name: g.name,
          code: (g.phone.replace(/\D/g, "").slice(-4)) || g.code || null,
          phone: g.phone || null,
          address: g.address || null,
        }));
        const { data, error } = await supabase.from("members").insert(payload).select("id, name");
        if (error) throw error;
        (data as { id: string; name: string }[]).forEach(m => nameToId.set((m.name || "").trim(), m.id));
        membersCreated = toCreate.length;
      }

      // 2) הכנת פעולות (לחברים שלא דילגנו עליהם)
      const txnPayload: any[] = [];
      for (const g of memberGroups) {
        const act = actions[g.name];
        if (act === "skip") { skipped += g.txns.length; continue; }
        const mid = nameToId.get(g.name);
        if (!mid) { skipped += g.txns.length; continue; }
        for (const t of g.txns) {
          txnPayload.push({
            member_id: mid, amount: t.amount, type: t.type,
            method: t.method || null,
            greg_date: t.greg_date || null,
            heb_date: t.greg_date ? toHebrewDate(t.greg_date) : null,
            notes: t.notes || null,
          });
        }
      }

      // 3) הכנסה במנות
      const CHUNK = 500;
      for (let i = 0; i < txnPayload.length; i += CHUNK) {
        const { error } = await supabase.from("transactions").insert(txnPayload.slice(i, i + CHUNK));
        if (error) throw error;
      }
      txnsAdded = txnPayload.length;

      setResult({ membersCreated, txnsAdded, skipped });
      setStep(4);
    } catch (err: any) {
      setError("שגיאה בייבוא: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep(1); setWb(null); setRows([]); setParsed([]); setResult(null);
    setFileName(""); setError(""); setActions({});
  }

  /* ============ תצוגה ============ */
  const newCount = memberGroups.filter(g => !findExisting(g.name, g.code)).length;
  const existCount = memberGroups.length - newCount;

  return (
    <div style={{ direction: "rtl" }}>
      <PageTitle>ייבוא מאקסל</PageTitle>

      {/* פסי שלבים */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[[1, "העלאת קובץ"], [2, "מיפוי עמודות"], [3, "תצוגה מקדימה"], [4, "סיום"]].map(([n, l]) => (
          <div key={n as number} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "0.4rem 0.9rem", borderRadius: 999,
            background: step === n ? BRAND : step > (n as number) ? "#e3f6ec" : "#f0f2f5",
            color: step === n ? "#fff" : step > (n as number) ? BRAND : "#9aa5b5",
            fontSize: ".82rem", fontWeight: 700,
          }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: step === n ? "rgba(255,255,255,.25)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem" }}>{n as number}</span>
            {l}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "var(--red-bg)", color: "#c0392b", padding: "0.75rem 1rem", borderRadius: "var(--r)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: ".88rem", border: "1px solid #f3c9c9" }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* ===== שלב 1 ===== */}
      {step === 1 && (
        <Card>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            style={{ border: `2px dashed var(--line)`, borderRadius: "var(--r-lg)", padding: "3rem 2rem", textAlign: "center", cursor: "pointer", background: "var(--brand-soft)" }}
          >
            <UploadCloud size={48} color={BRAND} style={{ opacity: .8 }} />
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", marginTop: 12 }}>גרור לכאן קובץ אקסל או לחץ לבחירה</div>
            <div style={{ fontSize: ".85rem", color: "#9aa5b5", marginTop: 6 }}>נתמכים: .xlsx · .xls · .csv</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
          <div style={{ marginTop: 16, fontSize: ".83rem", color: "#7a8699", lineHeight: 1.7 }}>
            המערכת תזהה אוטומטית את העמודות (שם, סכום, תאריך וכו׳) ותתן לך לאשר לפני הייבוא.
            כל החישובים והיתרות יחושבו על ידי המערכת — אין צורך בנוסחאות.
          </div>
        </Card>
      )}

      {/* ===== שלב 2: מיפוי ===== */}
      {step === 2 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: BRAND, fontWeight: 700 }}>
            <span className="section-bar" style={{ marginInlineEnd: 8 }} />
            <FileSpreadsheet size={20} /> {fileName}
          </div>

          {sheetNames.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>גיליון</label>
              <select value={sheet} onChange={e => loadSheet(wb!, e.target.value)} style={inp}>
                {sheetNames.map(s => <option key={s}>{s}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: ".85rem", color: "#4a5568" }}>
                <input type="checkbox" checked={sheetAsName} onChange={e => setSheetAsName(e.target.checked)} />
                שם החבר נמצא בשם הגיליון (גיליון נפרד לכל חבר)
              </label>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>שורת כותרת</label>
            <select value={headerRow} onChange={e => {
              const hr = Number(e.target.value); setHeaderRow(hr);
              setMapping((rows[hr] || []).map(c => guessField(String(c))));
            }} style={inp}>
              {rows.slice(0, 10).map((_, i) => <option key={i} value={i}>שורה {i + 1}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", fontSize: ".85rem", fontWeight: 700, color: "var(--text)", margin: "16px 0 8px" }}>
            <span className="section-bar" style={{ marginInlineEnd: 8 }} />מיפוי עמודות
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".84rem" }}>
              <thead>
                <tr style={{ background: "#f0f4f3" }}>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700 }}>עמודה בקובץ</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700 }}>דוגמה</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700 }}>שייך לשדה</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i}>
                    <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5", fontWeight: 600 }}>{h || `עמודה ${i + 1}`}</td>
                    <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5", color: "#9aa5b5" }}>
                      {String(dataRows.find(r => r[i] !== "" && r[i] != null)?.[i] ?? "—").slice(0, 24)}
                    </td>
                    <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5" }}>
                      <select value={mapping[i] || "ignore"}
                        onChange={e => setMapping(m => { const c = [...m]; c[i] = e.target.value as FieldId; return c; })}
                        style={{ ...inp, padding: "0.35rem 0.5rem", borderColor: mapping[i] && mapping[i] !== "ignore" ? BRAND : "#d8dde5" }}>
                        {FIELD_ORDER.map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ברירות מחדל */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16, padding: "1rem", background: "var(--brand-soft)", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
            <div>
              <label style={lbl}>סוג ברירת מחדל (אם אין עמודת סוג)</label>
              <select value={defaultType} onChange={e => setDefaultType(e.target.value as any)} style={inp}>
                <option value="הפקדה">הפקדה</option>
                <option value="משיכה">משיכה</option>
              </select>
            </div>
            <div>
              <label style={lbl}>אופן ברירת מחדל (אם אין עמודה)</label>
              <select value={defaultMethod} onChange={e => setDefaultMethod(e.target.value)} style={inp}>
                <option value="">— ללא —</option>
                {TXN_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Button onClick={goToPreview}>המשך לתצוגה מקדימה ←</Button>
            <Button variant="ghost" onClick={reset}>חזרה</Button>
          </div>
        </Card>
      )}

      {/* ===== שלב 3: תצוגה מקדימה ===== */}
      {step === 3 && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Stat label="פעולות שזוהו" value={String(parsed.length)} color={BRAND} />
            <Stat label="חברים בקובץ" value={String(memberGroups.length)} color="#3b82f6" />
            <Stat label="חברים חדשים" value={String(newCount)} color="#16a085" />
            <Stat label="חברים קיימים" value={String(existCount)} color="#f59e0b" />
          </div>

          <Card style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--line)", fontWeight: 700, color: "var(--text)" }}>
              <span className="section-bar" style={{ marginInlineEnd: 8 }} />חברים — בחר מה לעשות עם כל אחד
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                    <th style={{ padding: "0.5rem 1rem", textAlign: "right" }}>שם</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>פעולות</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>סטטוס</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  {memberGroups.map(g => {
                    const exist = findExisting(g.name, g.code);
                    return (
                      <tr key={g.name}>
                        <td style={{ padding: "0.45rem 1rem", borderBottom: "1px solid #f0f2f5", fontWeight: 600 }}>{g.name}</td>
                        <td style={{ padding: "0.45rem 0.75rem", borderBottom: "1px solid #f0f2f5" }}>{g.txns.length}</td>
                        <td style={{ padding: "0.45rem 0.75rem", borderBottom: "1px solid #f0f2f5" }}>
                          {exist
                            ? <span style={{ color: "#f59e0b", fontWeight: 600 }}>קיים במערכת</span>
                            : <span style={{ color: "#16a085", fontWeight: 600 }}>חדש</span>}
                        </td>
                        <td style={{ padding: "0.45rem 0.75rem", borderBottom: "1px solid #f0f2f5" }}>
                          <select value={actions[g.name] || (exist ? "attach" : "create")}
                            onChange={e => setActions(a => ({ ...a, [g.name]: e.target.value as MemberAction }))}
                            style={{ ...inp, padding: "0.3rem 0.5rem", width: "auto" }}>
                            {!exist && <option value="create">צור חבר חדש</option>}
                            {exist && <option value="attach">הוסף לחבר הקיים</option>}
                            <option value="skip">דלג</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--line)", fontWeight: 700, color: "var(--text)" }}>
              <span className="section-bar" style={{ marginInlineEnd: 8 }} />דוגמת פעולות (50 ראשונות)
            </div>
            <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: ".83rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                    {["חבר", "סוג", "סכום", "תאריך", "אופן", "הערות"].map(h => (
                      <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((t, i) => (
                    <tr key={i}>
                      <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5" }}>{t.memberName}</td>
                      <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5", color: t.type === "משיכה" ? RED : BRAND, fontWeight: 600 }}>{t.type}</td>
                      <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5", fontWeight: 600 }}>{ils(t.amount)}</td>
                      <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5", color: t.greg_date ? "#4a5568" : "#cbd5e0" }}>{t.greg_date || "—"}</td>
                      <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5" }}>{t.method || "—"}</td>
                      <td style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #f0f2f5", color: "#7a8699" }}>{t.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={runImport} disabled={busy}>{busy ? "מייבא…" : `✓ ייבא ${parsed.length} פעולות`}</Button>
            <Button variant="ghost" onClick={() => setStep(2)}>חזרה למיפוי</Button>
          </div>
          {busy && <div style={{ marginTop: 12 }}><Loading /></div>}
        </>
      )}

      {/* ===== שלב 4: סיום ===== */}
      {step === 4 && result && (
        <Card style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <CheckCircle2 size={56} color={BRAND} />
          <h2 className="display" style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)", margin: "1rem 0 0.5rem" }}>הייבוא הושלם בהצלחה!</h2>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", margin: "1.5rem 0", flexWrap: "wrap" }}>
            <div><div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#16a085" }}>{result.membersCreated}</div><div style={{ fontSize: ".8rem", color: "#9aa5b5" }}>חברים נוצרו</div></div>
            <div><div style={{ fontSize: "1.8rem", fontWeight: 800, color: BRAND }}>{result.txnsAdded}</div><div style={{ fontSize: ".8rem", color: "#9aa5b5" }}>פעולות נוספו</div></div>
            {result.skipped > 0 && <div><div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#9aa5b5" }}>{result.skipped}</div><div style={{ fontSize: ".8rem", color: "#9aa5b5" }}>פעולות דולגו</div></div>}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Button onClick={() => router.push("/members")}>לרשימת החברים <ArrowRight size={15} /></Button>
            <Button variant="ghost" onClick={reset}>ייבוא קובץ נוסף</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="hover-lift" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: "0.8rem 1.2rem", borderTop: `3px solid ${color}`, boxShadow: "var(--shadow)", flex: "1 1 130px" }}>
      <div style={{ fontSize: ".75rem", color: "#9aa5b5" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

const inp: React.CSSProperties = { padding: "0.5rem 0.75rem", border: "1.5px solid #dce1e8", borderRadius: 8, fontSize: ".88rem", width: "100%", boxSizing: "border-box", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };
