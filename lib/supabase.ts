import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// לקוח Supabase משותף (צד לקוח). המערכת פנימית ומשתמשת במפתח ה-anon.
export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});
