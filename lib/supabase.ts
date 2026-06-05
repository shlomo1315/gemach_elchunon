import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, storageKey: "gemach_session" },
});

// מחזיר את הודעת השגיאה האמיתית של Edge Function (מגוף התשובה), במקום
// ההודעה הגנרית "Edge Function returned a non-2xx status code".
export async function fnErrMessage(error: any, data?: any): Promise<string> {
  if (data && data.error) return String(data.error);
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
    }
    if (ctx && typeof ctx.text === "function") {
      const txt = await ctx.clone().text();
      if (txt) return txt;
    }
  } catch { /* ignore */ }
  return error?.message || "נכשל";
}
