# מעבר מ-Supabase ל-Railway

התיקייה הזו מכילה את כל מה שנדרש כדי להעביר את המערכת מסופאבייס ל-Railway.

| קובץ | תפקיד |
|---|---|
| `schema.sql` | הסכמה המלאה — איחוד של כל 9 קבצי ה-SQL שהורצו בסופאבייס |
| `migrate.mjs` | העברת כל הנתונים מסופאבייס ל-Railway |
| `create-admin.mjs` | יצירת משתמש מנהל |

---

## מה השתנה בקוד

סופאבייס סיפק ארבעה שירותים שלא קיימים ב-Postgres רגיל. כל אחד הוחלף:

| סופאבייס | המחליף |
|---|---|
| **PostgREST** — הדפדפן שאל את המסד ישירות | `app/api/db` — הדפדפן שולח תיאור מובנה, השרת בונה את ה-SQL |
| **RLS** (`is_admin()`, `current_member_id()`) | `lib/authz.ts` — אותם כללים בדיוק, נאכפים בשרת |
| **Auth** | `lib/session.ts` — עוגייה חתומה ב-HMAC + bcrypt |
| **Storage** (`member-docs`) | טבלת `documents` + `app/api/storage` |
| **Edge Function** (`quick-service`) | `app/api/auth/member-login` |

`lib/supabase.ts` שומר על אותו ממשק (`supabase.from(...).select(...)`), ולכן
כל הקריאות הקיימות באפליקציה ממשיכות לעבוד — רק היעד השתנה.

> **הסיסמאות נשמרות.** סופאבייס מאחסן bcrypt, שהוא פורמט סטנדרטי, ולכן
> ההאשים עוברים כמו שהם וכל המשתמשים ממשיכים להתחבר עם אותה סיסמה.

---

## שלבי ההעברה

### 1. הרצת הסכמה

```bash
psql "$RAILWAY_DB_URL" -f railway/schema.sql
```

### 2. העברת הנתונים

צריך את מחרוזת החיבור **הישירה** של סופאבייס (פורט 5432), ולא את
ה-pooler — רק דרכה יש גישה ל-`auth.users` שבה שמורות הסיסמאות.
מוצאים אותה ב: `Project Settings → Database → Connection string → URI`.

```bash
# קודם בדיקה יבשה — קורא בלבד, לא כותב כלום
SUPABASE_DB_URL="postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres" \
RAILWAY_DB_URL="postgresql://postgres:PASS@xxx.proxy.rlwy.net:PORT/railway" \
node railway/migrate.mjs --dry-run

# ואז ההעברה עצמה
SUPABASE_DB_URL="..." RAILWAY_DB_URL="..." node railway/migrate.mjs
```

הסקריפט מעביר את ה-UUID-ים המקוריים כמו שהם, ולכן כל הקשרים בין
הטבלאות נשמרים. הוא בטוח להרצה חוזרת, ובסיום משווה את מספר הפעולות
ואת סך היתרה בין שני המסדים.

לרענון מלא מאפס: `node railway/migrate.mjs --truncate`

### 3. משתני סביבה

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}   # הפניה לשירות המסד ב-Railway
AUTH_SECRET=<openssl rand -base64 32>     # חובה — בלעדיו אין התחברות
```

### 4. משתמש מנהל

אם המשתמשים הועברו בשלב 2 — אין צורך בכלום; מתחברים עם אותה סיסמה.
אחרת:

```bash
RAILWAY_DB_URL="..." node railway/create-admin.mjs admin@example.com <סיסמה>
```

---

## מה לא עובר אוטומטית

**קבצים שהועלו ל-Storage של סופאבייס.** הנתיבים שלהם (`document_url`)
כן עוברים, אבל התוכן עצמו יושב ב-bucket של סופאבייס. אם יש מסמכים
קיימים שחשוב לשמר — צריך להוריד אותם מה-bucket ולהעלות דרך
`/api/storage/upload`. מסמכים חדשים נשמרים ישירות ב-Railway.

---

## בדיקה מקומית

הסכמה והקוד נבדקו מול Postgres אמיתי עם נתוני האמת (117 חברים,
201 פעולות), כולל: בידוד חבר, חסימת הזרקות SQL, זיוף עוגיות,
מעבר תיקיות ב-Storage, וחישוב היתרות.

```bash
psql "$DATABASE_URL" -f railway/schema.sql
DATABASE_URL="..." AUTH_SECRET="..." npm run dev
```
