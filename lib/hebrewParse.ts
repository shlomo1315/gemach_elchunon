import { HDate } from "@hebcal/hdate";

// ערכי אותיות לגימטריה
const LETTER: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50,
  ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
};

function gemValue(s: string): number {
  let n = 0;
  for (const ch of s) n += LETTER[ch] || 0;
  return n;
}

// שמות חודשים עבריים → שם אנגלי ש-HDate מבין
const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
function normFinals(s: string): string {
  return s.replace(/[ךםןףץ]/g, c => FINALS[c] || c);
}

const MONTHS_RAW: Record<string, string> = {
  תשרי: "Tishrei",
  חשון: "Cheshvan", חשוון: "Cheshvan", מרחשון: "Cheshvan",
  כסלו: "Kislev", כסליו: "Kislev",
  טבת: "Tevet", שבט: "Sh'vat",
  אדר: "Adar", אדרא: "Adar I", אדרב: "Adar II", אדא: "Adar I", אדב: "Adar II",
  ניסן: "Nisan", אייר: "Iyyar", אייער: "Iyyar",
  סיון: "Sivan", סיוון: "Sivan",
  תמוז: "Tamuz", תמז: "Tamuz",
  אב: "Av", מנחםאב: "Av", אלול: "Elul",
};
// מפתחות מנורמלים (ללא אותיות סופיות) — כי בנתונים יש ניסן/חשון/סיון עם ן סופית
const MONTHS: Record<string, string> = {};
for (const [k, v] of Object.entries(MONTHS_RAW)) MONTHS[normFinals(k)] = v;

export type HebParts = { year: number; monthEng: string; day: number };

// ניתוח תאריך עברי טקסטואלי כגון "כו ניסן פו" / "ר"ח טבת פא" / "סיון עה"
export function parseHebrewDateText(raw: string | null | undefined): HebParts | null {
  if (!raw) return null;
  let s = String(raw).replace(/["'׳״]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const tokens = s.split(" ");

  // איתור החודש
  let mi = -1, monthEng: string | null = null, monthSpan = 1;
  for (let i = 0; i < tokens.length; i++) {
    const t = normFinals(tokens[i]);
    // קודם — "אדר א"/"אדר ב" כשני אסימונים (השנה מגיעה אחרי שניהם)
    if (t === "אדר" && tokens[i + 1]) {
      const nxt = normFinals(tokens[i + 1]);
      if (nxt === "א" || nxt === "ב") { mi = i; monthEng = nxt === "א" ? "Adar I" : "Adar II"; monthSpan = 2; break; }
    }
    if (MONTHS[t]) { mi = i; monthEng = MONTHS[t]; monthSpan = 1; break; }
  }
  if (mi < 0 || !monthEng) return null;

  // שנה — האסימון שאחרי החודש (בהתחשב ב"אדר א/ב" שתופס שני אסימונים)
  const yearTok = tokens[mi + monthSpan];
  if (!yearTok) return null;
  const yg = gemValue(yearTok);
  if (yg <= 0) return null;
  // אם יש אות מאות (ק/ר/ש/ת) זו שנה מלאה (תשפ"ו=786) אחרת מוסיפים 5700
  const year = /[קרשת]/.test(yearTok) ? 5000 + yg : 5700 + yg;

  // יום — האסימון שלפני החודש (או ר"ח = 1)
  let day = 1;
  if (mi > 0) {
    const dt = tokens[mi - 1];
    if (/^(רח|ראש)/.test(dt)) day = 1;
    else {
      const dg = gemValue(dt);
      if (dg >= 1 && dg <= 30) day = dg;
    }
  }

  return { year, monthEng, day };
}

// המרת תאריך עברי טקסטואלי לתאריך לועזי בפורמט YYYY-MM-DD
export function hebTextToGreg(raw: string | null | undefined): string | null {
  const p = parseHebrewDateText(raw);
  if (!p) return null;
  try {
    let hd: HDate;
    try {
      hd = new HDate(p.day, p.monthEng, p.year);
    } catch {
      // נפילה אם "אדר" בשנה מעוברת
      hd = new HDate(p.day, "Adar II", p.year);
    }
    const d = hd.greg();
    // בדיקת שפיות: תאריך לועזי חייב להיות בטווח סביר (אחרת מילה נקראה בטעות כשנה)
    const gy = d.getFullYear();
    if (gy < 2005 || gy > new Date().getFullYear() + 2) return null;
    return `${gy}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

// תצוגה לועזית קצרה בעברית (13 באפר׳ 2026)
export function hebTextToGregDisplay(raw: string | null | undefined): string {
  const iso = hebTextToGreg(raw);
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
