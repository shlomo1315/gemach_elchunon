"use client";

import { supabase } from "./supabase";

export type NotifyEvent = {
  event?: string;
  heading: string;                                  // כותרת המייל, למשל "פעולה חדשה נרשמה"
  intro?: string;
  accent?: "green" | "red" | "gold" | "blue";       // צבע המבטא
  amount?: string;                                   // סכום מודגש (כבר מפורמט, למשל "₪1,200")
  rows?: [string, string][];                         // שורות פירוט [תווית, ערך]
  memberId?: string | null;                          // לזיהוי החבר ושליפת המייל שלו
  memberName?: string | null;
  toMember?: boolean;                                // ברירת מחדל true (אם יש memberId ויש לו מייל)
};

/**
 * שולח התראת מייל (למנהל + לחבר) על פעולה במערכת.
 * אינו חוסם את הממשק ואינו זורק שגיאות — אם המייל נכשל, הפעולה במערכת כבר נשמרה.
 */
export function notify(ev: NotifyEvent): void {
  // ריצה אסינכרונית "שגר ושכח" — לא ממתינים ולא מפילים את הזרימה
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(ev),
        keepalive: true,
      });
    } catch {
      /* התראות מייל לא חוסמות את המערכת — בולעים שגיאות בשקט */
    }
  })();
}
