# 📧 הפעלת מערכת המיילים — גמ"ח זכרון אהרן

המערכת שולחת מייל HTML מעוצב **בכל פעולה** (הפקדה, משיכה, חבר חדש, עריכה,
מחיקה, שיקים, אישור בקשות, ייבוא) דרך חשבון ה-Gmail הייעודי של הגמ"ח:

- **למנהל** — על כל פעולה (ניתן לכיבוי בדף "מיילים" → הגדרות).
- **לחבר** — אם הפעולה קשורה אליו **ויש לו כתובת מייל שמורה** בכרטיס.

בנוסף, בדף **"מיילים"** במערכת: יומן כל המיילים שנשלחו (כולל כשלים
ושליחה חוזרת), שליחה יזומה של הודעה לחבר בודד או לכולם, והגדרות שליחה.

> בלי ההגדרה למטה המערכת עובדת רגיל — מיילים לא נשלחים, והכשלים
> מופיעים ביומן עם השגיאה `not_configured`.

---

## הפעלה עם OAuth2 (בלי אימות דו-שלבי) — חד-פעמי

ההגדרה נעשית פעם אחת ב-Google Cloud Console, מהחשבון Gmail הייעודי של הגמ"ח.
בסוף התהליך יהיו בידיך שלושה ערכים: **Client ID**, **Client Secret**, **Refresh Token**.

### שלב א' — יצירת פרויקט והפעלת Gmail API
1. נכנסים ל-https://console.cloud.google.com **מהחשבון Gmail של הגמ"ח**.
2. למעלה: בורר הפרויקטים → **New Project** → שם: `gemach-mail` → **Create**,
   ומוודאים שהפרויקט החדש נבחר.
3. בתפריט: **APIs & Services → Library** → מחפשים **Gmail API** → **Enable**.

### שלב ב' — מסך הסכמה (OAuth consent screen)
1. **APIs & Services → OAuth consent screen** → אם מוצע "Get started" ממלאים:
   - App name: `gemach-mail`, User support email: כתובת ה-Gmail של הגמ"ח.
   - Audience: **External**.
   - Contact information: אותה כתובת. → **Create**.
2. חשוב: תחת **Audience** לוחצים **Publish app** (מעבר מ-Testing ל-**In production**).
   בלי זה — ה-Refresh Token פג כל 7 ימים והמיילים יפסיקו להישלח.

### שלב ג' — יצירת Client ID ו-Client Secret
1. **APIs & Services → Credentials** → **Create credentials → OAuth client ID**.
2. Application type: **Web application**, שם: `gemach-mail`.
3. תחת **Authorized redirect URIs** מוסיפים בדיוק:
   `https://developers.google.com/oauthplayground`
4. **Create** → מעתיקים את **Client ID** ואת **Client Secret** (נשמור אותם לשלב ה').

### שלב ד' — הפקת Refresh Token (ב-OAuth Playground)
1. נכנסים ל-https://developers.google.com/oauthplayground
2. לוחצים על **גלגל השיניים** (למעלה מימין) → מסמנים
   **Use your own OAuth credentials** → מדביקים את ה-Client ID וה-Client Secret.
3. בצד שמאל, ב-**Step 1**: בשדה החופשי למטה ("Input your own scopes") מקלידים:
   `https://mail.google.com/` → **Authorize APIs**.
4. גוגל תבקש להתחבר — בוחרים את חשבון ה-Gmail של הגמ"ח.
   אם מופיעה אזהרה "Google hasn't verified this app" → **Advanced** →
   **Go to gemach-mail (unsafe)** → **Allow** (זו האפליקציה שלך — זה בטוח).
5. ב-**Step 2**: לוחצים **Exchange authorization code for tokens** →
   מעתיקים את ה-**Refresh token**.

### שלב ה' — משתני סביבה ב-Vercel
ב-**Vercel → הפרויקט → Settings → Environment Variables**, מוסיפים:

| שם | ערך |
|----|-----|
| `GMAIL_USER` | כתובת ה-Gmail המלאה (למשל `gemach@gmail.com`) |
| `GMAIL_CLIENT_ID` | ה-Client ID משלב ג' (מסתיים ב-`.apps.googleusercontent.com`) |
| `GMAIL_CLIENT_SECRET` | ה-Client Secret משלב ג' |
| `GMAIL_REFRESH_TOKEN` | ה-Refresh Token משלב ד' |
| `ADMIN_EMAIL` | (אופציונלי) לאן יגיעו התראות המנהל. ברירת מחדל: `GMAIL_USER` |

> חשוב: לוודא ש-`RESEND_API_KEY` **לא** מוגדר — אם הוא קיים, המערכת תשלח
> דרך Resend במקום דרך ה-Gmail.

### שלב ו' — טבלאות ופריסה
1. ב-**Supabase → SQL Editor** מריצים פעם אחת את `supabase/email-schema.sql`
   (יוצר את `email_log` ו-`email_settings`).
2. ב-Vercel → **Deployments** → על הפריסה האחרונה → **Redeploy**
   (כדי שמשתני הסביבה ייטענו).

---

## חלופות נתמכות (אם אי פעם תרצה)

- **סיסמת אפליקציה** (דורשת אימות דו-שלבי): במקום שלושת משתני ה-OAuth
  מגדירים רק `GMAIL_USER` + `GMAIL_APP_PASSWORD`
  (יוצרים ב-https://myaccount.google.com/apppasswords).
- **Resend מדומיין** (`gemach.shlomo4you.com`): מאמתים את הדומיין ב-Resend
  ומגדירים `RESEND_API_KEY` (+ אופציונלית `EMAIL_FROM`). אם המפתח מוגדר —
  הוא קודם ל-Gmail.

---

## איך זה עובד טכנית
- כל פעולה קוראת ל-`notify()` (צד לקוח) שמפעיל את `/api/notify` (צד שרת).
- השרת בודק את ההגדרות (דף "מיילים" → הגדרות), שולח דרך SMTP של Gmail
  בחיבור XOAUTH2 (`lib/mailer.ts`), ורושם כל שליחה — הצלחה או כשל —
  בטבלת `email_log`.
- השליחה היא "שגר ושכח" — אם מייל נכשל, **הפעולה במערכת כבר נשמרה**.
  הכשל מופיע ביומן ואפשר לשלוח שוב בלחיצה.
- שליחה יזומה: דף "מיילים" → "שליחה יזומה" → `/api/send-email`.
- מגבלת Gmail: עד ~500 נמענים ביום — מספיק בהחלט לגמ"ח.

## כדי שגם החברים יקבלו מייל
צריך שלכרטיס החבר תהיה כתובת מייל. אפשר להוסיף מייל בכרטיס החבר.
חברים בלי מייל — רק המנהל יקבל התראה לגביהם.
