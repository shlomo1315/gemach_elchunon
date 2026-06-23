# גמ"ח אייזנבלט — מערכת ניהול

מערכת ווב לניהול גמ"ח (הפקדות, משיכות, חברים ויתרות), בנויה ב‑**Next.js 15** + **Supabase**, מותאמת לעברית (RTL).

הנתונים יובאו מ‑Airtable: **117 חברים** ו‑**201 פעולות**.

## תכונות
- 📊 **דשבורד** — סך הכל בקופה, מספר חברים, סך הפקדות/משיכות, פעולות אחרונות ויתרות מובילות.
- 👥 **חברים** — רשימה עם חיפוש (שם/קוד/טלפון/כתובת), הוספת חבר, ויתרה מחושבת לכל חבר.
- 💳 **פעולות** — רשימה עם סינון לפי סוג/אופן/חיפוש, סיכומי הפקדות/משיכות/נטו, והוספת פעולה.
- 📄 **כרטיס חבר** — פרטים, יתרה, היסטוריית פעולות עם יתרה מצטברת, והדפסת דף יתרה.
- 📈 **דוחות** — גרפים: הפקדות מול משיכות, פילוח לפי אופן, ויתרות מובילות.

---

## התקנה — שלב אחר שלב

### 1. בסיס הנתונים (Supabase)
1. ב‑Supabase, היכנס ל‑**SQL Editor**.
2. הרץ את התוכן של `supabase/schema.sql` (יוצר את הטבלאות והמבטים).
3. הרץ את התוכן של `supabase/seed.sql` (טוען את 117 החברים ו‑201 הפעולות).

### 2. משתני סביבה
העתק את `.env.local.example` ל‑`.env.local` והכנס:
```
NEXT_PUBLIC_SUPABASE_URL=...        # Project URL מ-Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon public key מ-Supabase
```
ב‑**Vercel**: הוסף את אותם שני המשתנים תחת *Project Settings → Environment Variables*, ואז **Redeploy**.

### 3. הרצה מקומית
```bash
npm install
npm run dev
```
פתח http://localhost:3000

### 4. פריסה ל‑Vercel
דחוף את התיקייה למאגר GitHub, חבר אותו ל‑Vercel, הוסף את משתני הסביבה, ולחץ **Deploy**.

---

## אבטחה 🔒
המערכת מאובטחת באמצעות Supabase Auth + מדיניות RLS מהודקת. כדי להפעיל את ההגנות במלואן, בצע את הצעדים הבאים **פעם אחת**:

1. **הרץ את `supabase/security-hardening.sql`** ב‑SQL Editor (אחרי שאר קובצי ה‑SQL). הוא:
   - מהדק את `members` / `transactions` כך שמנהל רואה הכל, חבר רואה רק את שלו, ולמפתח `anon` אין גישה כלל.
   - מחליף את `is_admin()` לרשימת היתר מפורשת (טבלת `admins`) במקום "כל מי שאינו חבר".
   - מהדק את `deleted_transactions` ואת ה‑Storage למנהל / לבעל הקובץ בלבד.
2. **ודא שהמייל שלך מופיע ב‑`admins`**: `select * from admins;` (הסקריפט זורע אוטומטית את המנהלים הקיימים). להוספה ידנית: `insert into admins(email) values ('you@example.com');`
3. **כבה הרשמה ציבורית** ב‑Supabase: *Authentication → Providers → Email → Disable "Enable sign‑ups"*. יצירת חברים נעשית רק דרך פונקציית ה‑Edge.
4. **הגדר סף סיסמה** ב‑Supabase Auth (מומלץ 8+ תווים).
5. אם מפתח `service_role` נחשף אי‑פעם — סובב אותו (*Project Settings → API → Reset*).

> מפתח `anon` אינו סוד — הוא מוטמע בלקוח; כל ההגנה נשענת על RLS ועל רשימת ההיתר `admins`.

## מבנה
```
app/            דפי המערכת (ראשי, חברים, פעולות, דוחות)
components/      רכיבי UI משותפים
lib/             לקוח Supabase ופונקציות עזר
supabase/        schema.sql + seed.sql
types.ts         טיפוסי TypeScript
```
