# מערכת מיילים מלאה — שליחה דרך Gmail, יומן, שליחה יזומה והגדרות

**תאריך:** 2026-07-19
**סטטוס:** מאושר על ידי המשתמש

## רקע

במערכת קיימת תשתית התראות מייל חלקית: כל פעולה קוראת ל-`notify()`
(`lib/notify.ts`) שמפעילה את `/api/notify` (`app/api/notify/route.ts`),
והשליחה מתבצעת דרך שירות Resend — שמעולם לא הוגדר בפועל.
המשתמש פתח חשבון Gmail ייעודי ורוצה שכל המיילים יישלחו ממנו,
בתוספת יומן מיילים, שליחה יזומה לחברים והגדרות שליחה.

## החלטות עיקריות

1. **שליחה דרך Gmail SMTP** (ספריית `nodemailer`) במקום Resend,
   באמצעות "סיסמת אפליקציה" של גוגל. משתני סביבה:
   `GMAIL_USER`, `GMAIL_APP_PASSWORD` (מחליפים את `RESEND_API_KEY` / `EMAIL_FROM`).
   `ADMIN_EMAIL` נשאר, וברירת המחדל שלו היא `GMAIL_USER`.
2. **יומן מיילים** — טבלת `email_log` חדשה ב-Supabase.
3. **דף "מיילים" חדש** בתפריט הצד עם שלוש לשוניות: יומן, שליחה יזומה, הגדרות.
4. **הגדרות שליחה** — טבלת `email_settings` (שורה יחידה).
5. כל הקריאות הקיימות ל-`notify()` ממשיכות לעבוד ללא שינוי בצד הקורא.

## סכימת נתונים (Supabase)

```sql
-- supabase/email-schema.sql

create table if not exists email_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  event          text,                     -- סוג הפעולה ("הפקדה", "ידני" וכו')
  recipient_type text not null check (recipient_type in ('admin','member')),
  recipient      text not null,            -- כתובת המייל
  member_id      uuid references members (id) on delete set null,
  member_name    text,
  subject        text not null,
  html           text not null,            -- התוכן המלא — מאפשר "שלח שוב" מדויק
  status         text not null check (status in ('sent','failed')),
  error          text                      -- הודעת שגיאה אם נכשל
);

create index on email_log (created_at desc);
create index on email_log (status);

create table if not exists email_settings (
  id                 boolean primary key default true check (id), -- שורה יחידה
  send_to_admin      boolean not null default true,
  send_to_member     boolean not null default true,
  ev_transactions    boolean not null default true,  -- הפקדות/משיכות/עריכות/מחיקות
  ev_members         boolean not null default true,  -- חבר חדש/עריכה/מחיקה
  ev_checks          boolean not null default true,  -- שיקים
  ev_requests        boolean not null default true,  -- בקשות
  ev_import          boolean not null default true,  -- ייבוא
  updated_at         timestamptz not null default now()
);
insert into email_settings (id) values (true) on conflict do nothing;
```

RLS באותו דפוס קיים במערכת (מדיניות פתוחה ל-anon/authenticated),
כמו שאר הטבלאות.

## צד שרת

### `/api/notify` (עדכון)

- מחליף את `sendViaResend` בשליחה דרך `nodemailer` עם transport של Gmail
  (host `smtp.gmail.com`, port 465, secure).
- לפני שליחה: קורא את `email_settings` ומדלג לפי ההגדרות
  (קטגוריית אירוע כבויה / שליחה לחבר כבויה / שליחה למנהל כבויה).
  לצורך זה `NotifyBody` מקבל שדה חדש `category`
  (`'transactions' | 'members' | 'checks' | 'requests' | 'import'`);
  בהיעדרו — שולחים (ברירת מחדל פתוחה).
- אחרי כל ניסיון שליחה (הצלחה או כשל) — כותב שורה ל-`email_log`.
- נשאר "שגר ושכח" מצד הלקוח: כשל אינו חוסם את הפעולה בגמ"ח.

### `/api/send-email` (חדש) — שליחה יזומה

- אימות זהה ל-`/api/notify` (Bearer token של משתמש מחובר).
- קלט: `{ memberIds: string[] | 'all', subject, message }`.
  `'all'` = כל החברים שיש להם כתובת מייל.
- לכל נמען: בונה מייל בתבנית הממותגת (`buildEmail`), שולח, ורושם ביומן
  עם `event: 'ידני'`.
- שליחה סדרתית; מחזיר סיכום `{ sent, failed }`.

### `/api/resend-email` (חדש) — שליחה חוזרת

- קלט: `{ logId }`. שולף את השורה מ-`email_log`, שולח שוב את אותו
  `subject`+`html` לאותו נמען, ורושם שורת יומן חדשה (המקור לא משתנה).

### מודול משותף `lib/mailer.ts` (שרת בלבד)

- `sendMail(to, subject, html)` — עטיפת nodemailer.
- `logEmail(entry)` — כתיבה ל-`email_log`.
- שלושת ה-routes משתמשים בו.

## צד לקוח

### `lib/notify.ts` (עדכון קל)

- תוספת שדה אופציונלי `category` ל-`NotifyEvent`. אין שינוי בקוראים קיימים;
  בהמשך אפשר להוסיף קטגוריות בהדרגה בנקודות הקריאה.

### דף `/emails` — "מיילים" (חדש)

נוסף לתפריט הצד (`components/Sidebar.tsx`, אייקון `Mail`) בין "דוחות" ל"הגדרות".
שלוש לשוניות (באותו דפוס טאבים קיים בדף הפעולות):

1. **יומן** — טבלת מיילים: תאריך, אירוע, נמען, חבר, נושא, סטטוס.
   סינון לפי סטטוס (הכל/נשלח/נכשל), חיפוש חופשי, צפייה בתוכן המייל
   (תצוגה מקדימה ב-iframe/מודאל), וכפתור "שלח שוב" לשורות שנכשלו.
   דפדוף בסיסי (טעינת 50 אחרונים + "טען עוד").
2. **שליחה יזומה** — בחירת נמען: חבר בודד (רשימה של חברים עם מייל)
   או "כל החברים עם מייל"; שדות נושא והודעה; תצוגה מקדימה; כפתור שליחה
   עם אישור כשמדובר בכולם; חיווי התקדמות ותוצאה (נשלחו X, נכשלו Y).
3. **הגדרות** — מתגים: שליחה למנהל, שליחה לחברים, וחמש קטגוריות אירועים.
   שמירה ישירה ל-`email_settings`.

## הגדרה חד-פעמית (מתועד ב-EMAIL_SETUP.md, נכתב מחדש)

1. בחשבון ה-Gmail: הפעלת אימות דו-שלבי → יצירת "סיסמת אפליקציה"
   (myaccount.google.com/apppasswords).
2. ב-Vercel: הגדרת `GMAIL_USER`, `GMAIL_APP_PASSWORD`,
   ואופציונלית `ADMIN_EMAIL` (ברירת מחדל: `GMAIL_USER`).
3. הרצת `supabase/email-schema.sql` ב-SQL Editor של Supabase.
4. Redeploy.

## טיפול בשגיאות ועמידות

- כשל שליחה לעולם אינו מפיל פעולה בגמ"ח — נרשם ביומן כ-`failed` וניתן
  לשליחה חוזרת.
- אם משתני הסביבה חסרים — המערכת מדלגת בשקט (כמו היום) אך רושמת ביומן
  שורת כשל עם השגיאה `not_configured`, כדי שהבעיה תהיה גלויה בדף המיילים.
- מגבלת Gmail (~500 נמענים ביום) מספיקה להיקף הגמ"ח; שליחה יזומה לכולם
  נשלחת סדרתית כדי לא להיחסם.

## בדיקות

- בדיקת אינטגרציה ידנית מקומית: `npm run dev` עם משתני סביבה ב-.env.local,
  ביצוע פעולה (הפקדה) ואימות: מייל התקבל + שורה ביומן.
- בדיקת שליחה יזומה לחבר בודד ולכולם.
- בדיקת התנהגות ללא הגדרה (env חסר): הפעולה עוברת, נרשם כשל ביומן.
- בדיקת הגדרות: כיבוי קטגוריה מונע שליחה ורישום.
