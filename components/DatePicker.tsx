"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HDate } from "@hebcal/hdate";
import { gematria } from "@/lib/format";

const BRAND = "#107a5e";

// שמות חודשים עבריים לפי השם האנגלי ש-HDate מחזיר
const HEB_MONTH: Record<string, string> = {
  Nisan: "ניסן", Iyyar: "אייר", Sivan: "סיון", Tamuz: "תמוז", Av: "אב", Elul: "אלול",
  Tishrei: "תשרי", Cheshvan: "חשון", Kislev: "כסלו", Tevet: "טבת", "Sh'vat": "שבט",
  Adar: "אדר", "Adar I": "אדר א׳", "Adar II": "אדר ב׳",
};
const GREG_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function hebMonthName(m: number, y: number): string {
  const eng = HDate.getMonthName(m, y);
  return HEB_MONTH[eng] || eng;
}

// סדר חודשים עבריים לתצוגה — מתחיל בתשרי (7) ומסתיים באלול (6)
function hebMonthOrder(year: number): number[] {
  const total = HDate.monthsInYear(year); // 12 או 13
  // תשרי=7 ... עד סוף; אחר כך 1..6 (ניסן..אלול)
  const order: number[] = [];
  for (let m = 7; m <= total; m++) order.push(m);
  for (let m = 1; m <= 6; m++) order.push(m);
  return order;
}

function isoToLocalDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}
function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameISO(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const inpStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem", border: "1.5px solid #dce1e8", borderRadius: 8, fontSize: ".9rem",
  width: "100%", boxSizing: "border-box", background: "#fff", cursor: "pointer", textAlign: "right",
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "#1a1a2e",
};

export default function DatePicker({ value, onChange, placeholder = "בחר תאריך", error }: {
  value: string;                       // תאריך לועזי בפורמט YYYY-MM-DD
  onChange: (iso: string) => void;     // מחזיר תמיד תאריך לועזי
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"heb" | "greg">("heb");
  const [picker, setPicker] = useState<null | "month" | "year">(null);
  const ref = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, right: 0 });

  const selected = useMemo(() => isoToLocalDate(value), [value]);
  const today = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);

  // תצוגת החודש הנוכחי בלוח
  const [view, setView] = useState(() => {
    const base = selected || today;
    const h = new HDate(base);
    return { gy: base.getFullYear(), gm: base.getMonth(), hy: h.getFullYear(), hm: h.getMonth() };
  });

  // בכל פתיחה — מיישרים את התצוגה לתאריך הנבחר (או היום) ומחשבים מיקום fixed
  useEffect(() => {
    if (!open) { setPicker(null); return; }
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const popupW = 308;
      const rightFromViewport = window.innerWidth - rect.right;
      const finalRight = Math.max(8, Math.min(rightFromViewport, window.innerWidth - popupW - 8));
      setPopupPos({ top: rect.bottom + 6, right: finalRight });
    }
    const base = selected || today;
    const h = new HDate(base);
    setView({ gy: base.getFullYear(), gm: base.getMonth(), hy: h.getFullYear(), hm: h.getMonth() });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(d: Date) {
    onChange(dateToISO(d));
    setOpen(false);
  }

  function prevMonth() {
    setPicker(null);
    if (mode === "greg") {
      setView(v => { const m = v.gm - 1; return { ...v, gy: m < 0 ? v.gy - 1 : v.gy, gm: (m + 12) % 12 }; });
    } else {
      setView(v => {
        const order = hebMonthOrder(v.hy);
        const idx = order.indexOf(v.hm);
        if (idx > 0) return { ...v, hm: order[idx - 1] };
        const py = v.hy - 1; const po = hebMonthOrder(py);
        return { ...v, hy: py, hm: po[po.length - 1] };
      });
    }
  }
  function nextMonth() {
    setPicker(null);
    if (mode === "greg") {
      setView(v => { const m = v.gm + 1; return { ...v, gy: m > 11 ? v.gy + 1 : v.gy, gm: m % 12 }; });
    } else {
      setView(v => {
        const order = hebMonthOrder(v.hy);
        const idx = order.indexOf(v.hm);
        if (idx < order.length - 1) return { ...v, hm: order[idx + 1] };
        const ny = v.hy + 1; const no = hebMonthOrder(ny);
        return { ...v, hy: ny, hm: no[0] };
      });
    }
  }

  // בניית רשת הימים
  const cells = useMemo(() => {
    const arr: { date: Date; inMonth: boolean }[] = [];
    if (mode === "greg") {
      const first = new Date(view.gy, view.gm, 1, 12);
      const startDow = first.getDay();
      const start = new Date(view.gy, view.gm, 1 - startDow, 12);
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        arr.push({ date: d, inMonth: d.getMonth() === view.gm });
      }
    } else {
      const daysIn = HDate.daysInMonth(view.hm, view.hy);
      const firstGreg = new HDate(1, view.hm, view.hy).greg(); firstGreg.setHours(12, 0, 0, 0);
      const startDow = firstGreg.getDay();
      const start = new Date(firstGreg); start.setDate(firstGreg.getDate() - startDow);
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i); d.setHours(12, 0, 0, 0);
        const h = new HDate(d);
        arr.push({ date: d, inMonth: h.getMonth() === view.hm && h.getFullYear() === view.hy });
      }
    }
    return arr;
  }, [mode, view]);

  // כותרת הניווט
  const headMonth = mode === "greg" ? GREG_MONTHS[view.gm] : hebMonthName(view.hm, view.hy);
  const headYear = mode === "greg" ? String(view.gy) : gematria(view.hy);

  // רשימות לבחירה מהירה של חודש/שנה
  const monthOptions = mode === "greg"
    ? GREG_MONTHS.map((label, i) => ({ label, val: i }))
    : hebMonthOrder(view.hy).map(m => ({ label: hebMonthName(m, view.hy), val: m }));
  const yearOptions = useMemo(() => {
    if (mode === "greg") {
      const base = view.gy; const list: { label: string; val: number }[] = [];
      for (let y = base - 8; y <= base + 4; y++) list.push({ label: String(y), val: y });
      return list;
    } else {
      const base = view.hy; const list: { label: string; val: number }[] = [];
      for (let y = base - 8; y <= base + 4; y++) list.push({ label: gematria(y), val: y });
      return list;
    }
  }, [mode, view.gy, view.hy]);

  // תווית בכפתור הסגור — מציגה עברי + לועזי
  const label = useMemo(() => {
    if (!selected) return "";
    const h = new HDate(selected);
    const heb = `${gematria(h.getDate())} ${hebMonthName(h.getMonth(), h.getFullYear())} ${gematria(h.getFullYear())}`;
    const greg = selected.toLocaleDateString("he-IL");
    return `${heb} · ${greg}`;
  }, [selected]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div role="button" tabIndex={0} onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
        style={{ ...inpStyle, borderColor: error ? "#e05252" : "#d8dde5" }}>
        <span style={{ color: selected ? "#1a1a2e" : "#9aa5b5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label || placeholder}</span>
        <span style={{ color: "#9aa5b5", fontSize: ".9rem", flexShrink: 0 }}>📅</span>
      </div>

      {open && (
        <div style={{
          position: "fixed", top: popupPos.top, right: popupPos.right, zIndex: 9999,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,.18)", padding: 12, width: 300, direction: "rtl",
        }}>
          {/* מתג סוג לוח */}
          <div style={{ display: "flex", background: "#f0f4f3", borderRadius: 999, padding: 3, marginBottom: 10 }}>
            {([["heb", "עברי"], ["greg", "לועזי"]] as const).map(([m, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setPicker(null); }}
                style={{
                  flex: 1, border: "none", cursor: "pointer", padding: "0.4rem", borderRadius: 999,
                  fontSize: ".84rem", fontWeight: 700,
                  background: mode === m ? BRAND : "transparent", color: mode === m ? "#fff" : "#7a8699",
                }}>{lbl}</button>
            ))}
          </div>

          {/* ניווט: חץ · חודש · שנה · חץ */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 4 }}>
            <button onClick={nextMonth} style={navArrow} title="הבא">›</button>
            <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "center" }}>
              <button onClick={() => setPicker(p => p === "month" ? null : "month")} style={navLabel}>{headMonth}</button>
              <button onClick={() => setPicker(p => p === "year" ? null : "year")} style={navLabel}>{headYear}</button>
            </div>
            <button onClick={prevMonth} style={navArrow} title="הקודם">‹</button>
          </div>

          {/* בחירה מהירה של חודש / שנה */}
          {picker === "month" && (
            <div style={quickGrid}>
              {monthOptions.map(o => (
                <button key={o.val} onClick={() => { setView(v => mode === "greg" ? { ...v, gm: o.val } : { ...v, hm: o.val }); setPicker(null); }}
                  style={{ ...quickItem, background: (mode === "greg" ? view.gm : view.hm) === o.val ? BRAND : "#f6f8f8", color: (mode === "greg" ? view.gm : view.hm) === o.val ? "#fff" : "#1a1a2e" }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {picker === "year" && (
            <div style={{ ...quickGrid, maxHeight: 180, overflowY: "auto" }}>
              {yearOptions.map(o => (
                <button key={o.val} onClick={() => { setView(v => mode === "greg" ? { ...v, gy: o.val } : { ...v, hy: o.val }); setPicker(null); }}
                  style={{ ...quickItem, background: (mode === "greg" ? view.gy : view.hy) === o.val ? BRAND : "#f6f8f8", color: (mode === "greg" ? view.gy : view.hy) === o.val ? "#fff" : "#1a1a2e" }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* רשת ימים */}
          {!picker && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
                {WEEKDAYS.map(w => <div key={w} style={{ textAlign: "center", fontSize: ".72rem", fontWeight: 700, color: "#9aa5b5", padding: "2px 0" }}>{w}</div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                {cells.map((c, i) => {
                  const isSel = selected && sameISO(c.date, selected);
                  const isToday = sameISO(c.date, today);
                  const dayNum = mode === "greg" ? c.date.getDate() : gematria(new HDate(c.date).getDate());
                  return (
                    <button key={i} onClick={() => pick(c.date)}
                      style={{
                        aspectRatio: "1", border: isToday && !isSel ? `1.5px solid ${BRAND}` : "1.5px solid transparent",
                        borderRadius: 8, cursor: "pointer", fontSize: ".82rem", fontWeight: isSel ? 800 : 600,
                        background: isSel ? BRAND : "transparent",
                        color: isSel ? "#fff" : c.inMonth ? "#1a1a2e" : "#c9d2dc",
                        transition: "background .1s",
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#eef6f3"; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* כפתורים תחתונים */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "space-between" }}>
            <button onClick={() => pick(new Date())} className="btn btn-soft btn-sm" style={{ flex: 1 }}>היום</button>
            {value && <button onClick={() => { onChange(""); setOpen(false); }} className="btn btn-soft btn-sm" style={{ flex: 1 }}>נקה</button>}
          </div>
        </div>
      )}
    </div>
  );
}

const navArrow: React.CSSProperties = { width: 30, height: 30, border: "none", background: "#f0f4f3", borderRadius: 8, cursor: "pointer", fontSize: "1.2rem", color: BRAND, fontWeight: 800, lineHeight: 1, flexShrink: 0 };
const navLabel: React.CSSProperties = { border: "none", background: "#f6f8f8", borderRadius: 8, cursor: "pointer", fontSize: ".88rem", fontWeight: 800, color: "#1a1a2e", padding: "0.35rem 0.8rem" };
const quickGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 };
const quickItem: React.CSSProperties = { border: "none", borderRadius: 8, cursor: "pointer", padding: "0.5rem 0.3rem", fontSize: ".8rem", fontWeight: 700 };
