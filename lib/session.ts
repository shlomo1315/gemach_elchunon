/**
 * ניהול sessions — מחליף את Supabase Auth.
 *
 * העוגייה חתומה ב-HMAC-SHA256 עם AUTH_SECRET, כך שאי אפשר לזייף אותה
 * בצד הלקוח. אין תלות בספרייה חיצונית — הכל מ-node:crypto.
 */
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "gemach_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 יום

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "member";
  /** מזהה החבר — קיים רק כאשר role === "member" */
  member_id: string | null;
};

type Payload = SessionUser & { exp: number };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "חסר AUTH_SECRET (לפחות 32 תווים). צור אחד עם: openssl rand -base64 32",
    );
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(data: string): string {
  return b64url(createHmac("sha256", secret()).update(data).digest());
}

export function encodeSession(user: SessionUser): string {
  const payload: Payload = { ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  // השוואה בזמן קבוע — מונעת דליפת מידע דרך מדידת זמן
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.id, email: payload.email, role: payload.role, member_id: payload.member_id };
  } catch {
    return null;
  }
}

/** מחזיר את המשתמש המחובר, או null. לשימוש ב-route handlers. */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function generateSecret(): string {
  return randomBytes(32).toString("base64");
}
