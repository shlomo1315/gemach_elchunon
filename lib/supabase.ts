/**
 * שכבת גישה לנתונים מול Railway Postgres.
 *
 * הקובץ שומר במכוון על אותו שם ועל אותו ממשק כמו לקוח סופאבייס
 * שהיה כאן קודם (`supabase.from(...).select(...).eq(...)`), כדי שכל
 * הקריאות הקיימות באפליקציה ימשיכו לעבוד ללא שינוי — רק היעד
 * השתנה: במקום PostgREST של סופאבייס, ה-API routes שלנו.
 *
 * ההבדל המהותי: הדפדפן שולח תיאור מובנה של השאילתה, והשרת הוא זה
 * שבונה את ה-SQL ואוכף את ההרשאות (מה שקודם עשה ה-RLS).
 */

export type User = {
  id: string;
  email: string;
  role: "admin" | "member";
  member_id: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: { full_name?: string };
};

type Result<T = any> = { data: T; error: { message: string } | null; count?: number };

type FilterOp =
  | "eq" | "neq" | "in" | "ilike" | "gte" | "lte" | "gt" | "lt" | "isNull" | "isNotNull";

type Filter = { op: FilterOp; column: string; value?: unknown };

async function post(url: string, body: unknown): Promise<Result> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || "שגיאת שרת";
      return { data: null, error: { message: String(msg) } };
    }
    return { data: json.data ?? null, error: json.error ?? null, count: json.count };
  } catch (e) {
    return { data: null, error: { message: (e as Error).message || "שגיאת רשת" } };
  }
}

/**
 * בונה שאילתה בשרשור, בדיוק כמו supabase-js.
 * מממש PromiseLike כדי ש-`await supabase.from(...)...` יפעל כרגיל.
 */
class QueryBuilder implements PromiseLike<Result> {
  private table: string;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private columns = "*";
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";
  private values: unknown = null;
  private actionSet = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*") {
    // אחרי insert/update/delete, select() הוא ה-returning — לא משנה פעולה
    if (!this.actionSet) this.action = "select";
    if (columns && columns !== "*") this.columns = columns;
    return this;
  }
  insert(values: unknown) { this.action = "insert"; this.actionSet = true; this.values = values; return this; }
  update(values: unknown) { this.action = "update"; this.actionSet = true; this.values = values; return this; }
  delete()                { this.action = "delete"; this.actionSet = true; return this; }
  upsert(values: unknown) { return this.insert(values); }

  eq(column: string, value: unknown)    { this.filters.push({ op: "eq", column, value }); return this; }
  neq(column: string, value: unknown)   { this.filters.push({ op: "neq", column, value }); return this; }
  in(column: string, value: unknown[])  { this.filters.push({ op: "in", column, value }); return this; }
  ilike(column: string, value: string)  { this.filters.push({ op: "ilike", column, value }); return this; }
  gte(column: string, value: unknown)   { this.filters.push({ op: "gte", column, value }); return this; }
  lte(column: string, value: unknown)   { this.filters.push({ op: "lte", column, value }); return this; }
  gt(column: string, value: unknown)    { this.filters.push({ op: "gt", column, value }); return this; }
  lt(column: string, value: unknown)    { this.filters.push({ op: "lt", column, value }); return this; }

  is(column: string, value: unknown) {
    this.filters.push(value === null ? { op: "isNull", column } : { op: "eq", column, value });
    return this;
  }

  /** תואם ל-.not(column, "is", null) שבשימוש בקוד */
  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) this.filters.push({ op: "isNotNull", column });
    else this.filters.push({ op: "neq", column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number)   { this.limitN = n; return this; }
  /** עימוד בסגנון סופאבייס: טווח כולל־קצוות (from..to), כמו range(0, 49). */
  range(from: number, to: number) {
    this.offsetN = from;
    this.limitN = Math.max(0, to - from + 1);
    return this;
  }
  single()           { this.singleMode = "single"; return this; }
  maybeSingle()      { this.singleMode = "maybe"; return this; }

  private async run(): Promise<Result> {
    const res = await post("/api/db", {
      table: this.table,
      action: this.action,
      columns: this.columns,
      filters: this.filters,
      order: this.orders,
      limit: this.limitN,
      offset: this.offsetN,
      single: this.singleMode !== "none",
      values: this.values,
    });

    if (res.error) return res;

    // supabase מחזיר שגיאה כאשר single() לא מצא שורה; maybeSingle מחזיר null
    if (this.singleMode === "single" && res.data == null) {
      return { data: null, error: { message: "לא נמצאה שורה תואמת" } };
    }
    return res;
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onFulfilled, onRejected);
  }
}

// ---------------------------------------------------------------- auth

type AuthListener = (event: string, session: { user: User } | null) => void;
const listeners = new Set<AuthListener>();

function emit(event: string, session: { user: User } | null) {
  listeners.forEach((fn) => { try { fn(event, session); } catch { /* ignore */ } });
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const res = await post("/api/auth/login", { email, password });
    if (res.error) return { data: { user: null, session: null }, error: res.error };
    const user = res.data as User;
    emit("SIGNED_IN", { user });
    return { data: { user, session: { user } }, error: null };
  },

  async getSession() {
    try {
      const res = await fetch("/api/auth/session", { credentials: "same-origin" });
      const json = await res.json();
      const user: User | null = json?.user ?? null;
      return { data: { session: user ? { user } : null }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  async getUser() {
    const { data } = await auth.getSession();
    return { data: { user: data.session?.user ?? null }, error: null };
  },

  onAuthStateChange(cb: AuthListener) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: (): void => { listeners.delete(cb); } } } };
  },

  async signOut() {
    await post("/api/auth/logout", {});
    emit("SIGNED_OUT", null);
    return { error: null };
  },

  async updateUser(payload: { password?: string; email?: string; data?: { full_name?: string } }) {
    const res = await post("/api/auth/user", payload);
    return { data: { user: res.data as User | null }, error: res.error };
  },
};

// ------------------------------------------------------------- storage

function storageFrom(_bucket: string) {
  return {
    async upload(path: string, file: File, _opts?: { upsert?: boolean }) {
      try {
        const form = new FormData();
        form.append("path", path);
        form.append("file", file);
        const res = await fetch("/api/storage/upload", {
          method: "POST",
          credentials: "same-origin",
          body: form,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { data: null, error: { message: json?.error || "שגיאה בהעלאה" } };
        return { data: json.data, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },

    /**
     * אין צורך בחתימה: ההרשאה נבדקת בכל בקשה מול ה-session, ולכן
     * מחזירים כתובת ישירה ל-route מוגן. קישור שדלף אינו מקנה גישה.
     */
    async createSignedUrl(path: string, _expiresIn?: number) {
      return {
        data: { signedUrl: `/api/storage/file?path=${encodeURIComponent(path)}` },
        error: null,
      };
    },

    getPublicUrl(path: string) {
      return { data: { publicUrl: `/api/storage/file?path=${encodeURIComponent(path)}` } };
    },
  };
}

// ----------------------------------------------------------- functions

/** ה-Edge Function (שהופעלה בשם "quick-service") הוחלפה ב-route מקומי. */
const FUNCTION_ROUTES: Record<string, string> = {
  "quick-service": "/api/auth/member-login",
  "create-member-login": "/api/auth/member-login",
};

const functions = {
  async invoke(name: string, opts?: { body?: unknown }) {
    const url = FUNCTION_ROUTES[name];
    if (!url) return { data: null, error: { message: `פונקציה לא מוכרת: ${name}` } };
    const res = await post(url, opts?.body ?? {});
    if (res.error) return { data: null, error: res.error };
    return { data: res.data, error: null };
  },
};

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  storage: { from: storageFrom },
  functions,
};

/** נשמר לתאימות — הודעות השגיאה כבר מגיעות מפורשות מה-API. */
export async function fnErrMessage(error: any, data?: any): Promise<string> {
  if (data && data.error) return String(data.error);
  return error?.message || "נכשל";
}
