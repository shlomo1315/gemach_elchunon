/**
 * שער הגישה למסד — מחליף את PostgREST של סופאבייס.
 *
 * הדפדפן שולח תיאור מובנה של השאילתה (טבלה, פעולה, מסננים), ולא SQL.
 * כאן מאמתים מול רשימת היתר, בונים SQL פרמטרי בלבד, וכופים את
 * הרשאות החבר לפני ההרצה.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { authorize, assertColumn, AuthzError, type Action } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filter = {
  op: "eq" | "neq" | "in" | "ilike" | "gte" | "lte" | "gt" | "lt" | "isNull" | "isNotNull";
  column: string;
  value?: unknown;
};

type Body = {
  table: string;
  action: Action;
  columns?: string;
  filters?: Filter[];
  order?: { column: string; ascending: boolean }[];
  limit?: number;
  offset?: number;
  single?: boolean;
  values?: Record<string, unknown> | Record<string, unknown>[];
  returning?: boolean;
};

/** בונה את מקטע ה-WHERE. כל ערך עובר כפרמטר — אף פעם לא משורשר לטקסט. */
function buildWhere(
  rule: ReturnType<typeof authorize>["rule"],
  table: string,
  filters: Filter[],
  forced: { column: string; value: string } | null,
  params: unknown[],
  alias = "t",
): string {
  const parts: string[] = [];

  for (const f of filters) {
    const col = `${alias}."${assertColumn(rule, table, f.column)}"`;
    switch (f.op) {
      case "isNull":     parts.push(`${col} is null`); break;
      case "isNotNull":  parts.push(`${col} is not null`); break;
      case "in": {
        const arr = Array.isArray(f.value) ? f.value : [];
        if (!arr.length) { parts.push("false"); break; }
        const ph = arr.map((v) => { params.push(v); return `$${params.length}`; });
        parts.push(`${col} in (${ph.join(", ")})`);
        break;
      }
      case "ilike":
        params.push(f.value);
        parts.push(`${col} ilike $${params.length}`);
        break;
      default: {
        const sqlOp = { eq: "=", neq: "<>", gte: ">=", lte: "<=", gt: ">", lt: "<" }[f.op];
        if (!sqlOp) throw new AuthzError(`אופרטור לא נתמך: ${f.op}`, 400);
        if (f.value === null) { parts.push(`${col} ${f.op === "eq" ? "is" : "is not"} null`); break; }
        params.push(f.value);
        parts.push(`${col} ${sqlOp} $${params.length}`);
      }
    }
  }

  // סינון החבר נכפה תמיד ואחרון — לא ניתן לעקיפה מצד הלקוח
  if (forced) {
    params.push(forced.value);
    parts.push(`${alias}."${forced.column}" = $${params.length}`);
  }

  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

/** מפרק את מחרוזת ה-select. תומך ב-"*", ברשימת עמודות, וב-embed של members(name). */
function parseColumns(rule: ReturnType<typeof authorize>["rule"], table: string, columns?: string) {
  const raw = (columns ?? "*").trim();
  const embed = /members\s*\(\s*name\s*\)/.test(raw);
  const withoutEmbed = raw.replace(/,?\s*members\s*\(\s*name\s*\)/, "").trim();

  let list: string;
  if (!withoutEmbed || withoutEmbed === "*") {
    list = "t.*";
  } else {
    list = withoutEmbed
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => `t."${assertColumn(rule, table, c)}"`)
      .join(", ");
  }
  return { list, embed };
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    const body = (await req.json()) as Body;
    const { table, action } = body;

    if (!table || !action) {
      return NextResponse.json({ error: "בקשה חסרה" }, { status: 400 });
    }

    const { rule, forcedFilter } = authorize(user, table, action);
    const params: unknown[] = [];
    let sql = "";

    if (action === "select") {
      const { list, embed } = parseColumns(rule, table, body.columns);
      const joinCol = table === "members" || table === "member_balances" ? null : "member_id";

      sql = `select ${list}`;
      if (embed && joinCol) sql += `, jsonb_build_object('name', m2."name") as members`;
      sql += ` from "${table}" t`;
      if (embed && joinCol) sql += ` left join members m2 on m2.id = t."${joinCol}"`;

      sql += buildWhere(rule, table, body.filters ?? [], forcedFilter, params);

      if (body.order?.length) {
        const parts = body.order.map(
          (o) => `t."${assertColumn(rule, table, o.column)}" ${o.ascending ? "asc" : "desc"} nulls last`,
        );
        sql += ` order by ${parts.join(", ")}`;
      }
      if (body.limit != null) {
        const n = Number(body.limit);
        if (!Number.isInteger(n) || n < 0 || n > 10_000) {
          return NextResponse.json({ error: "limit לא תקין" }, { status: 400 });
        }
        sql += ` limit ${n}`;
      }
      if (body.offset != null) {
        const n = Number(body.offset);
        if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
          return NextResponse.json({ error: "offset לא תקין" }, { status: 400 });
        }
        sql += ` offset ${n}`;
      }
    }

    else if (action === "insert") {
      const rowsIn = Array.isArray(body.values) ? body.values : [body.values ?? {}];
      if (!rowsIn.length) return NextResponse.json({ data: [], error: null });

      // חבר מוסיף שורה → משייכים אותה אליו בכפייה ומאלצים סטטוס התחלתי
      const rows = rowsIn.map((r) => {
        const row = { ...r };
        if (forcedFilter) {
          row[forcedFilter.column] = forcedFilter.value;
          Object.assign(row, rule.memberInsertForce ?? {});
        }
        return row;
      });

      const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
        .map((c) => assertColumn(rule, table, c));
      if (!cols.length) return NextResponse.json({ error: "אין עמודות להוספה" }, { status: 400 });

      const tuples = rows.map((row) => {
        const ph = cols.map((c) => {
          const v = row[c] ?? null;
          params.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v);
          return `$${params.length}`;
        });
        return `(${ph.join(", ")})`;
      });

      sql = `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values ${tuples.join(", ")}`;
      if (body.returning !== false) sql += " returning *";
    }

    else if (action === "update") {
      const values = (body.values ?? {}) as Record<string, unknown>;
      const cols = Object.keys(values).map((c) => assertColumn(rule, table, c));
      if (!cols.length) return NextResponse.json({ error: "אין עמודות לעדכון" }, { status: 400 });

      const sets = cols.map((c) => {
        const v = values[c];
        params.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v);
        return `"${c}" = $${params.length}`;
      });

      sql = `update "${table}" t set ${sets.join(", ")}`;
      sql += buildWhere(rule, table, body.filters ?? [], forcedFilter, params);
      if (body.returning !== false) sql += " returning *";
    }

    else if (action === "delete") {
      const where = buildWhere(rule, table, body.filters ?? [], forcedFilter, params);
      // מחיקה ללא תנאי היא כמעט תמיד תקלה — הקוד משתמש ב-.not("id","is",null) במכוון
      if (!where) return NextResponse.json({ error: "מחיקה ללא תנאי נחסמה" }, { status: 400 });
      sql = `delete from "${table}" t${where}`;
      if (body.returning !== false) sql += " returning *";
    }

    else {
      return NextResponse.json({ error: "פעולה לא נתמכת" }, { status: 400 });
    }

    const rows = await query(sql, params);
    const data = body.single ? (rows[0] ?? null) : rows;
    return NextResponse.json({ data, error: null, count: rows.length });
  } catch (e) {
    const err = e as Error & { status?: number; code?: string; detail?: string };
    const status = err instanceof AuthzError ? err.status : 500;
    if (status === 500) console.error("[api/db]", err.message, err.detail ?? "");
    return NextResponse.json(
      { data: null, error: { message: err.message, code: err.code ?? null } },
      { status },
    );
  }
}
