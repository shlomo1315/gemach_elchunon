# 📧 הפעלת מערכת המיילים — גמ"ח זכרון אהרן

המערכת שולחת מייל HTML מעוצב **בכל פעולה** (הפקדה, משיכה, חבר חדש, עריכה,
מחיקה, שיקים, אישור בקשות, ייבוא) מכתובת הגמ"ח **office@gemach.shlomo4you.com**:

- **למנהל** — על כל פעולה (ניתן לכיבוי בדף "מיילים" → הגדרות).
- **לחבר** — אם הפעולה קשורה אליו **ויש לו כתובת מייל שמורה** בכרטיס.

בנוסף, בדף **"מיילים"** במערכת: יומן כל המיילים שנשלחו (כולל כשלים
ושליחה חוזרת), שליחה יזומה של הודעה לחבר בודד או לכולם, והגדרות שליחה.

> בלי ההגדרה למטה המערכת עובדת רגיל — מיילים לא נשלחים, והכשלים
> מופיעים ביומן עם השגיאה `not_configured`.

**איך זה בנוי:** השליחה נעשית דרך **Resend** (שירות שליחה בלבד),
והקבלה דרך **Cloudflare Email Routing** שמעביר כל מייל שמגיע ל-`office@`
לתיבת הדואר האישית שלך. שני החלקים חינמיים ובלתי תלויים זה בזה.

---

## חלק א' — שליחה (Resend)

הדומיין `shlomo4you.com` מנוהל ב-**Cloudflare**, ולכן כל רשומות ה-DNS
נוספות שם. ההגדרה חד-פעמית.

### שלב 1 — הוספת הדומיין ב-Resend
1. נכנסים ל-https://resend.com ומתחברים (אפשר בהרשמה עם Google).
2. בתפריט הצדדי: **Domains** → **Add Domain**.
3. בשדה הדומיין מקלידים בדיוק: `gemach.shlomo4you.com`
4. בוחרים region (אפשר להשאיר ברירת מחדל) → **Add**.
5. יופיע מסך עם רשומות DNS (בערך 3 שורות: `MX`, `TXT` של SPF,
   ו-`TXT`/`CNAME` של DKIM). **משאירים את המסך פתוח** — צריך אותו בשלב הבא.

### שלב 2 — הוספת הרשומות ב-Cloudflare
1. נכנסים ל-https://dash.cloudflare.com → בוחרים את הדומיין **shlomo4you.com**.
2. בתפריט: **DNS** → **Records**.
3. לכל שורה שמופיעה במסך של Resend לוחצים **Add record** ומעתיקים:
   - **Type** — כפי שמופיע ב-Resend (`MX` / `TXT` / `CNAME`).
   - **Name** — מעתיקים מ-Resend. אם Resend מציג שם מלא כמו
     `send.gemach.shlomo4you.com`, ב-Cloudflare אפשר להזין רק
     `send.gemach` (Cloudflare משלים את `shlomo4you.com` לבד).
   - **Content / Value** — העתקה מדויקת מ-Resend.
   - **Priority** — רק אם זו רשומת `MX` (בדרך כלל `10`).
   - **Proxy status** — חייב להיות **DNS only** (ענן אפור, לא כתום).
4. **Save** לכל רשומה.

> ⚠️ הטעות הנפוצה: השארת ה-Proxy במצב כתום (Proxied). רשומות מייל
> חייבות להיות **DNS only**, אחרת האימות ייכשל.

### שלב 3 — אימות
חוזרים ל-Resend → **Domains** → לוחצים **Verify DNS Records**.
הסטטוס אמור להפוך ל-**Verified** (בדרך כלל תוך דקות; לעיתים עד כמה שעות).

### שלב 4 — מפתח API
1. ב-Resend: **API Keys** → **Create API Key**.
2. שם: `gemach`, הרשאה: **Sending access** → **Create**.
3. מעתיקים את המפתח (`re_...`) — הוא מוצג **פעם אחת בלבד**.

### שלב 5 — משתני סביבה ב-Railway
ב-**Railway → הפרויקט `gemach-elchunon` → השירות `gemach-app` → Variables**,
מוסיפים:

| שם | ערך |
|----|-----|
| `RESEND_API_KEY` | המפתח משלב 4 (מתחיל ב-`re_`) |
| `ADMIN_EMAIL` | לאן יגיעו התראות המנהל (כתובת ה-Gmail שלך) |
| `EMAIL_FROM` | (אופציונלי) ברירת המחדל כבר `גמ"ח זכרון אהרן <office@gemach.shlomo4you.com>` |

### שלב 6 — טבלאות ופריסה
הטבלאות `email_log` ו-`email_settings` הן חלק מ-`railway/schema.sql`, והוא
רץ **אוטומטית בכל פריסה** (`npm start` → `node railway/setup.mjs`). אין צורך
להריץ SQL ידנית.

שמירת המשתנים ב-Railway מפעילה פריסה מחדש מעצמה. אם לא — **Deployments** →
על הפריסה האחרונה → **Redeploy**.

---

## חלק ב' — קבלה (Cloudflare Email Routing)

Resend **שולח בלבד** — הוא אינו תיבת דואר. כדי שמיילים שנשלחים אל
`office@gemach.shlomo4you.com` יגיעו אליך, מגדירים העברה אוטומטית.
ההגדרה חינמית ולוקחת כ-10 דקות.

1. ב-**Cloudflare** → הדומיין `shlomo4you.com` → בתפריט: **Email** →
   **Email Routing**.
2. אם זו הפעם הראשונה — לוחצים **Get started** / **Enable Email Routing**.
   Cloudflare יציע להוסיף רשומות MX אוטומטית → מאשרים.
3. **Destination addresses** → **Add destination** → מזינים את כתובת
   ה-Gmail שלך → Cloudflare שולחת לשם מייל אימות → לוחצים על הקישור שבמייל.
4. **Routing rules** → **Create address**:
   - Custom address: `office@gemach.shlomo4you.com`
   - Action: **Send to an email**
   - Destination: כתובת ה-Gmail שאימתת → **Save**.

מעכשיו כל מייל שיישלח ל-`office@` יגיע לתיבה שלך.

> ⚠️ שים לב לקונפליקט MX: אם Resend ביקש רשומת `MX` על
> `gemach.shlomo4you.com` ו-Cloudflare Email Routing מוסיף MX משלו —
> ודא שהם על שמות שונים (Resend בדרך כלל על תת-דומיין כמו `send.`).
> אם שניהם על אותו שם בדיוק, פנה אליי לפני שאתה מוחק רשומה.

### תשובה ישירה מ-Gmail (מומלץ)
כדי שתוכל **להשיב** מ-Gmail והתשובה תצא מ-`office@` ולא מהכתובת הפרטית:
Gmail → ⚙️ → **See all settings** → **Accounts and Import** →
**Send mail as** → **Add another email address** → מזינים
`office@gemach.shlomo4you.com`, מסירים את הסימון "Treat as an alias",
ומאמתים דרך הקוד שיישלח (יגיע אליך בזכות ההעברה שהגדרת).

---

## חלופה: Gmail כגיבוי

הקוד תומך גם בשליחה דרך Gmail SMTP, בשימוש **רק אם `RESEND_API_KEY`
לא מוגדר**. אפשרי בשתי דרכים:

- **OAuth2** (בלי אימות דו-שלבי): `GMAIL_USER` + `GMAIL_CLIENT_ID` +
  `GMAIL_CLIENT_SECRET` + `GMAIL_REFRESH_TOKEN`
  (הפקה ב-Google Cloud Console + https://developers.google.com/oauthplayground,
  scope `https://mail.google.com/`).
- **סיסמת אפליקציה** (דורשת אימות דו-שלבי): `GMAIL_USER` +
  `GMAIL_APP_PASSWORD` (יוצרים ב-https://myaccount.google.com/apppasswords).

---

## איך זה עובד טכנית
- כל פעולה קוראת ל-`notify()` (צד לקוח) שמפעיל את `/api/notify` (צד שרת).
- השרת בודק את ההגדרות (דף "מיילים" → הגדרות), שולח דרך Resend API
  (`lib/mailer.ts`), ורושם כל שליחה — הצלחה או כשל — בטבלת `email_log`.
- השליחה היא "שגר ושכח" — אם מייל נכשל, **הפעולה במערכת כבר נשמרה**.
  הכשל מופיע ביומן ואפשר לשלוח שוב בלחיצה.
- שליחה יזומה: דף "מיילים" → "שליחה יזומה" → `/api/send-email`.
- מגבלת Resend בתוכנית החינמית: 3,000 מיילים בחודש / 100 ביום —
  מספיק בהחלט לגמ"ח.

## כדי שגם החברים יקבלו מייל
צריך שלכרטיס החבר תהיה כתובת מייל. אפשר להוסיף מייל בכרטיס החבר.
חברים בלי מייל — רק המנהל יקבל התראה לגביהם.
