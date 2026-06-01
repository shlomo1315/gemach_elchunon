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

export const TXN_TYPES = ["הפקדה", "משיכה"] as const;
export const TXN_METHODS = [
  "העברה בנקאית",
  "צ'יקים",
  "מזומן",
  "העברה לצד ג",
] as const;
