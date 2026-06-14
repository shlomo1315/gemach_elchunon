"use client";

import { useEffect, useState } from "react";
import { hebrewDateLetters } from "@/lib/format";
import { Clock, Flame } from "lucide-react";

const BRAND = "#1e6f5c";

/**
 * שורת מידע יומי משותפת (ניהול + ממשק חברים):
 * יום בשבוע · פרשה · תאריך עברי · תאריך לועזי · שעה · דף יומי · ירושלמי · שערי מטבע · חגים
 * ומתחתיה: הזמן ההלכתי הבא + זמני הדלקת נרות לשבת הקרובה.
 *
 * variant="onLight" — לרקע בהיר (דשבורד הניהול והאזור האישי)
 */
export default function HebrewInfoBar({ greeting }: { greeting?: string }) {
  const [now, setNow] = useState(new Date());
  const [parasha, setParasha] = useState("");
  const [holidays, setHolidays] = useState<string[]>([]);
  const [zmanim, setZmanim] = useState<{ label: string; time: Date }[]>([]);
  const [dafBavli, setDafBavli] = useState("");
  const [dafYerushalmi, setDafYerushalmi] = useState("");
  const [rates, setRates] = useState<{ usd: number; eur: number; updated: Date } | null>(null);
  const [candles, setCandles] = useState<{ label: string; time: string; mins: number; havdalah: string }[]>([]);

  // זמני הדלקת נרות לשבת הקרובה — ירושלים, ביתר עילית, מודיעין עילית
  useEffect(() => {
    const cities = [
      { label: "ירושלים", lat: 31.7683, lon: 35.2137, b: 40 },
      { label: "ביתר עילית", lat: 31.6997, lon: 35.1163, b: 40 },
      { label: "מודיעין עילית", lat: 31.9326, lon: 35.0413, b: 40 },
    ];
    Promise.all(cities.map(c =>
      fetch(`https://www.hebcal.com/shabbat?cfg=json&latitude=${c.lat}&longitude=${c.lon}&tzid=Asia/Jerusalem&b=${c.b}&M=on&lg=he`, { cache: "no-store" })
        .then(r => r.json())
        .then(data => {
          const items: any[] = data.items || [];
          const fmt = (cat: string) => {
            const it = items.find(i => i.category === cat);
            const dt = it ? new Date(it.date) : null;
            return dt && !isNaN(dt.getTime())
              ? dt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" })
              : "";
          };
          return { label: c.label, time: fmt("candles"), mins: c.b, havdalah: fmt("havdalah") };
        })
        .catch(() => ({ label: c.label, time: "", mins: c.b, havdalah: "" }))
    )).then(res => setCandles(res.filter(c => c.time)));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // שערי מטבע (דולר/יורו מול שקל) — מתרענן כל 10 דקות
  useEffect(() => {
    const loadRates = () => {
      const urls = [
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
        "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
      ];
      const tryUrl = (i: number) => {
        if (i >= urls.length) return;
        fetch(urls[i], { cache: "no-store" })
          .then(r => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
          .then(d => {
            const t = d?.usd;
            if (t?.ils && t?.eur) {
              setRates({ usd: t.ils, eur: t.ils / t.eur, updated: new Date() });
            } else {
              tryUrl(i + 1);
            }
          })
          .catch(() => tryUrl(i + 1));
      };
      tryUrl(0);
    };
    loadRates();
    const id = setInterval(loadRates, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // פרשת השבוע לפי לוח ארץ ישראל (geonameid=281184 = ירושלים, i=on)
    fetch("https://www.hebcal.com/shabbat?cfg=json&geonameid=281184&i=on&lg=he&M=on", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        const items: any[] = data.items || [];
        const p = items.find(i => i.category === "parashat");
        if (p) {
          const clean = String(p.hebrew || p.title || "")
            .replace(/־/g, " ")
            .replace(/[֑-ֽֿ-ׇ]/g, "")
            .replace(/^פרשת\s*/, "")
            .replace(/\s+/g, " ")
            .trim();
          setParasha(clean);
        }
      }).catch(() => {});

    const d = new Date();
    fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&i=on&year=${d.getFullYear()}&month=${d.getMonth() + 1}&ss=off&mf=off&c=off&geo=none&leyning=off&lg=he`)
      .then(r => r.json())
      .then(data => {
        const todayStr = d.toISOString().split("T")[0];
        const hols = (data.items || [])
          .filter((i: any) => i.date === todayStr)
          .map((i: any) => i.hebrew || i.title);
        setHolidays(hols);
      }).catch(() => {});

    // הדף היומי (בבלי) + ירושלמי יומי — מתרענן לפי תאריך היום
    const today2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cleanHeb = (s: string) => String(s || "").replace(/־/g, " ").replace(/[֑-ֽֿ-ׇ]/g, "").replace(/\s+/g, " ").trim();
    fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&lg=he&F=on&yyomi=on&start=${today2}&end=${today2}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        const items: any[] = data.items || [];
        const daf = items.find(i => i.category === "dafyomi");
        const yeru = items.find(i => i.category === "yerushalmi");
        if (daf) setDafBavli(cleanHeb(daf.hebrew || daf.title || ""));
        if (yeru) setDafYerushalmi(cleanHeb(yeru.hebrew || yeru.title || ""));
      }).catch(() => {});

    // זמני היום (מודיעין עילית) — היום ומחר, כדי למצוא את הזמן ההלכתי הבא
    const ZMAN: [string, string][] = [
      ["alotHaShachar", "עלות השחר"],
      ["misheyakir", "זמן טלית ותפילין"],
      ["sunrise", "הנץ החמה"],
      ["sofZmanShma", "סוף זמן קריאת שמע"],
      ["sofZmanTfilla", "סוף זמן תפילה"],
      ["chatzot", "חצות היום"],
      ["minchaGedola", "מנחה גדולה"],
      ["minchaKetana", "מנחה קטנה"],
      ["plagHaMincha", "פלג המנחה"],
      ["sunset", "שקיעה"],
      ["tzeit7083deg", "צאת הכוכבים"],
    ];
    const LAT = 31.9326, LON = 35.0413;
    const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);
    Promise.all([d, tomorrow].map(day =>
      fetch(`https://www.hebcal.com/zmanim?cfg=json&latitude=${LAT}&longitude=${LON}&tzid=Asia/Jerusalem&date=${fmt(day)}`)
        .then(r => r.json()).catch(() => null)
    )).then(results => {
      const list: { label: string; time: Date }[] = [];
      for (const res of results) {
        const times = res?.times || {};
        for (const [key, label] of ZMAN) {
          if (times[key]) {
            const t = new Date(times[key]);
            if (!isNaN(t.getTime())) list.push({ label, time: t });
          }
        }
      }
      list.sort((a, b) => a.time.getTime() - b.time.getTime());
      setZmanim(list);
    }).catch(() => {});
  }, []);

  const TZ = "Asia/Jerusalem";
  const dayOfWeek = now.toLocaleDateString("he-IL", { weekday: "long", timeZone: TZ });
  const hebDate = hebrewDateLetters(now);
  const gregDate = now.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const timeStr = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TZ });

  // הזמן ההלכתי הבא
  const nextZman = zmanim.find(z => z.time.getTime() > now.getTime());
  let zmanCountdown = "";
  if (nextZman) {
    const diffMin = Math.round((nextZman.time.getTime() - now.getTime()) / 60000);
    const h = Math.floor(diffMin / 60), m = diffMin % 60;
    if (diffMin < 1) zmanCountdown = "עוד פחות מדקה";
    else if (h === 0) zmanCountdown = `בעוד ${m} דקות`;
    else if (m === 0) zmanCountdown = `בעוד ${h} שעות`;
    else zmanCountdown = `בעוד ${h} שעות ו-${m} דקות`;
  }
  const zmanTime = nextZman ? nextZman.time.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

  return (
    <div style={{ direction: "rtl" }}>
      {greeting && (
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a2e" }}>{greeting}</h1>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem 0.7rem", marginTop: greeting ? 8 : 0, fontSize: ".95rem" }}>
        <span style={{ fontWeight: 800, color: "#2c3e50" }}>{dayOfWeek}</span>
        {parasha && (
          <>
            <span style={{ color: "#cbd5e0" }}>•</span>
            <span style={{ fontWeight: 700, color: BRAND }}>פרשת {parasha.replace(/^פרשת\s*/, "")}</span>
          </>
        )}
        <span style={{ color: "#cbd5e0" }}>•</span>
        <span style={{ fontWeight: 600, color: BRAND }}>{hebDate}</span>
        <span style={{ color: "#cbd5e0" }}>•</span>
        <span style={{ color: "#9aa5b5" }}>{gregDate}</span>
        <span style={{ color: "#cbd5e0" }}>•</span>
        <span style={{ color: "#4a5568", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, monospace", letterSpacing: ".5px" }} dir="ltr">{timeStr}</span>
        {dafBavli && (
          <>
            <span style={{ color: "#cbd5e0" }}>•</span>
            <span><span style={{ color: "#9aa5b5" }}>דף יומי: </span><span style={{ fontWeight: 700, color: "#7c3aed" }}>{dafBavli}</span></span>
          </>
        )}
        {dafYerushalmi && (
          <>
            <span style={{ color: "#cbd5e0" }}>•</span>
            <span><span style={{ color: "#9aa5b5" }}>ירושלמי: </span><span style={{ fontWeight: 700, color: "#0891b2" }}>{dafYerushalmi}</span></span>
          </>
        )}
        {rates && (
          <>
            <span style={{ color: "#cbd5e0" }}>•</span>
            <span><span style={{ color: "#9aa5b5" }}>דולר: </span><span style={{ fontWeight: 700, color: "#16a34a" }}>₪{rates.usd.toFixed(2)}</span></span>
            <span style={{ color: "#cbd5e0" }}>•</span>
            <span><span style={{ color: "#9aa5b5" }}>יורו: </span><span style={{ fontWeight: 700, color: "#2563eb" }}>₪{rates.eur.toFixed(2)}</span></span>
            <span style={{ color: "#b0bac7", fontSize: ".78rem" }} dir="ltr">
              (עודכן {rates.updated.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" })})
            </span>
          </>
        )}
        {holidays.map(h => (
          <span key={h}>
            <span style={{ color: "#cbd5e0", marginInlineEnd: "0.7rem" }}>•</span>
            <span style={{ fontWeight: 700, color: "#b7791f" }}>{h}</span>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 10, marginTop: 12 }}>
        {/* הזמן ההלכתי הבא */}
        {nextZman && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "linear-gradient(135deg,#f0f9f5,#eef6ff)",
            border: "1px solid #d7e9e2", borderRadius: 12,
            padding: "0.55rem 1rem", fontSize: ".9rem",
          }}>
            <Clock size={18} color={BRAND} />
            <span style={{ color: "#4a5568" }}>
              שים לב: <strong style={{ color: "#1a1a2e" }}>{nextZman.label}</strong> בשעה{" "}
              <strong style={{ color: BRAND, fontVariantNumeric: "tabular-nums" }} dir="ltr">{zmanTime}</strong>
            </span>
            <span style={{ background: BRAND, color: "#fff", borderRadius: 999, padding: "0.15rem 0.7rem", fontSize: ".8rem", fontWeight: 700 }}>
              {zmanCountdown}
            </span>
          </div>
        )}

        {/* הדלקת נרות שבת הקרובה */}
        {candles.length > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            background: "linear-gradient(135deg,#fff8ec,#fff3ee)",
            border: "1px solid #f2e0c9", borderRadius: 12,
            padding: "0.55rem 1rem", fontSize: ".9rem",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#b45309", fontWeight: 800 }}>
              <Flame size={18} color="#e8820c" /> שבת
            </span>
            {candles.map(c => (
              <span key={c.label} style={{ display: "inline-flex", flexDirection: "column", gap: 2, paddingInline: 4, borderInlineStart: "1px solid #f0e2cc" }}>
                <span style={{ color: "#7a8699", fontWeight: 700, fontSize: ".82rem" }}>{c.label}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".82rem" }}>
                  <span style={{ color: "#9aa5b5" }}>נרות</span>
                  <strong style={{ color: "#b45309", fontVariantNumeric: "tabular-nums" }} dir="ltr">{c.time}</strong>
                  <span style={{ color: "#c0a988", fontSize: ".72rem" }}>({c.mins} ד׳)</span>
                  {c.havdalah && (
                    <>
                      <span style={{ color: "#d8c4a3" }}>·</span>
                      <span style={{ color: "#9aa5b5" }}>צאת</span>
                      <strong style={{ color: "#7c3aed", fontVariantNumeric: "tabular-nums" }} dir="ltr">{c.havdalah}</strong>
                    </>
                  )}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
