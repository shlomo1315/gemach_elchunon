/** כללי גישה למסמכים — מחליף את מדיניות ה-Storage של סופאבייס. */
import type { SessionUser } from "./session";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
];

/**
 * הנתיב נשמר כ-"<member_id>/<filename>". מנהל ניגש להכל; חבר ניגש
 * רק לתיקייה שלו — התחליף המדויק ל-`owner = auth.uid() or is_admin()`.
 */
export function canAccessPath(user: SessionUser, path: string): boolean {
  if (user.role === "admin") return true;
  if (!user.member_id) return false;
  // חוסם מעבר תיקיות ("../") ומוודא שהקידומת היא בדיוק מזהה החבר
  if (path.includes("..")) return false;
  return path.startsWith(`${user.member_id}/`);
}
