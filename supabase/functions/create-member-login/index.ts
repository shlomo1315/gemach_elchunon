// Supabase Edge Function: יצירת חשבון התחברות לחבר (מאובטח)
// המפתח הרגיש (service role) נשאר בצד השרת בלבד — לעולם לא בקוד הלקוח.
// הפונקציה מאמתת שהקורא הוא מנהל (קיים בטבלת admins) לפני יצירת המשתמש.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // לקוח בזהות הקורא — כדי לזהות מי שולח את הבקשה
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await caller.auth.getUser();
    const callerEmail = u?.user?.email?.toLowerCase();
    if (!callerEmail) {
      return new Response(JSON.stringify({ error: "לא מחובר" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // לקוח מנהל (service role) — עוקף RLS, לכן חובה לאמת הרשאה ידנית.
    // מנהל מזוהה בדיוק כמו באפליקציה (AuthGuard): משתמש מחובר שהמייל שלו
    // אינו רשום בטבלת members. כך אין תלות בטבלת admins נפרדת.
    const admin = createClient(url, serviceKey);
    const { data: callerMember } = await admin.from("members").select("id").ilike("email", callerEmail).maybeSingle();
    if (callerMember) {
      return new Response(JSON.stringify({ error: "אין הרשאה — רק מנהל יכול ליצור התחברות" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { email, password, memberId } = await req.json();
    if (!email || !password || String(password).length < 6) {
      return new Response(JSON.stringify({ error: "מייל וסיסמה (לפחות 6 תווים) נדרשים" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const lowerEmail = String(email).toLowerCase().trim();

    // יצירת המשתמש (מאומת מראש, ללא צורך באישור מייל)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: lowerEmail,
      password: String(password),
      email_confirm: true,
    });

    let userId = created?.user?.id;
    let updated = false;

    if (cErr) {
      // אם המשתמש כבר קיים — לאתר אותו ולעדכן את הסיסמה (אידמפוטנטי / איפוס סיסמה)
      const alreadyExists = /already.*registered|already.*exists|duplicate|been registered/i.test(cErr.message || "");
      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: cErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // איתור המשתמש הקיים לפי מייל
      let found: any = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (lErr) return new Response(JSON.stringify({ error: lErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        found = (list?.users || []).find((x: any) => (x.email || "").toLowerCase() === lowerEmail) || null;
        if (!list || list.users.length < 200) break;
      }
      if (!found) {
        return new Response(JSON.stringify({ error: "המשתמש קיים אך לא נמצא לעדכון" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { error: uErr } = await admin.auth.admin.updateUserById(found.id, { password: String(password), email_confirm: true });
      if (uErr) return new Response(JSON.stringify({ error: uErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      userId = found.id;
      updated = true;
    }

    // שיוך המייל לשורת החבר
    if (memberId) {
      await admin.from("members").update({ email: lowerEmail }).eq("id", memberId);
    }

    return new Response(JSON.stringify({ ok: true, userId, updated }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
