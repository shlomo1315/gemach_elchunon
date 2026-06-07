-- ============================================================
-- תיקון: הוספת שיקים נחסמה ע"י RLS ("new row violates row-level
-- security policy for table checks") כי is_admin() החזירה false.
-- ------------------------------------------------------------
-- מגדיר מחדש את is_admin() כך שתזהה מנהל בדיוק כמו האפליקציה:
-- משתמש מחובר שהמייל שלו אינו רשום בטבלת members.
-- משמש את מדיניות ה-RLS של checks / requests / storage.
-- בטוח להרצה חוזרת. להריץ ב-Supabase SQL Editor.
-- ============================================================

create or replace function is_admin() returns boolean
language sql stable security definer as $$
  select auth.jwt()->>'email' is not null
     and not exists (
       select 1 from members where lower(email) = lower(auth.jwt()->>'email')
     );
$$;
