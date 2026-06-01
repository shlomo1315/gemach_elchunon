// פורמט מטבע בשקלים
export function ils(n: number | null | undefined): string {
  const v = Number(n || 0);
  return v.toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  });
}

// פורמט מספר רגיל
export function num(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

// פורמט תאריך לועזי
export function gdate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("he-IL");
  } catch {
    return d;
  }
}

// המרת מספר לאותיות גימטריה (16 → ט״ז, 786 → תשפ״ו)
export function gematria(num: number): string {
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
  let n = num % 1000; // לשנה — מוותרים על האלפים (5786 → 786)
  let s = hundreds[Math.floor(n / 100)];
  n %= 100;
  if (n === 15) s += "טו";
  else if (n === 16) s += "טז";
  else { s += tens[Math.floor(n / 10)]; s += ones[n % 10]; }
  if (s.length === 1) return s + "׳";
  return s.slice(0, -1) + "״" + s.slice(-1);
}

// תאריך עברי מלא באותיות גימטריה (ט״ז בסיון תשפ״ו) מאובייקט Date — לפי שעון ירושלים
export function hebrewDateLetters(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Jerusalem" }).formatToParts(d);
    const day = Number(parts.find(p => p.type === "day")?.value || 0);
    const year = Number(parts.find(p => p.type === "year")?.value || 0);
    const month = new Intl.DateTimeFormat("he-u-ca-hebrew", { month: "long", timeZone: "Asia/Jerusalem" }).format(d);
    if (!day || !year) return "";
    return `${gematria(day)} ב${month} ${gematria(year)}`;
  } catch { return ""; }
}

// המרת תאריך לועזי לעברי באותיות גימטריה
export function toHebrewDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return hebrewDateLetters(new Date(dateStr + "T12:00:00"));
  } catch {
    return "";
  }
}

export const TXN_TYPES = ["הפקדה", "משיכה"] as const;
export const TXN_METHODS = [
  "העברה בנקאית",
  "צ'יקים",
  "מזומן",
  "העברה לצד ג",
] as const;
