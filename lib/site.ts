/**
 * כתובת המערכת, לשימוש בקישורים שנשלחים במייל.
 *
 * ברירת המחדל היא הדומיין הקבוע של הגמ"ח. אפשר לדרוס דרך משתנה הסביבה
 * NEXT_PUBLIC_SITE_URL (למשל בסביבת בדיקות), ולכן אין כאן כתובת קשיחה בלבד.
 */
export const PORTAL_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://gemach.shlomo4you.com"
).replace(/\/+$/, "");

export const FUND_NAME = 'גמ"ח זכרון אהרן';
