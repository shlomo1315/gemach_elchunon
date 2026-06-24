"use client";

import { HandHeart } from "lucide-react";

/**
 * אמבלמת הלוגו של "זכרון אהרן" — יד מחזיקה לב (סמל החסד והנתינה)
 * בזהב, על מגן אמרלד עם טבעת זהב וזוהר. סקיילבילי לכל גודל.
 */
export function LogoMark({ size = 46 }: { size?: number }) {
  const r = Math.round(size * 0.3);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: r, flexShrink: 0,
        position: "relative", overflow: "hidden",
        background: "linear-gradient(140deg, #18a078 0%, #0d5a45 55%, #063b2c 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 10px 22px rgba(7,61,46,.42), inset 0 1px 1px rgba(255,255,255,.22)",
      }}
    >
      {/* טבעת זהב פנימית */}
      <span style={{ position: "absolute", inset: Math.max(2, Math.round(size * 0.045)), borderRadius: Math.max(4, r - 3), border: "1.5px solid rgba(212,175,90,.7)", pointerEvents: "none" }} />
      {/* זוהר זהב עליון */}
      <span style={{ position: "absolute", top: "-22%", insetInlineEnd: "-18%", width: "68%", height: "68%", borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,90,.5), transparent 65%)", pointerEvents: "none" }} />
      <HandHeart size={Math.round(size * 0.5)} color="#eccb73" strokeWidth={2} style={{ position: "relative", zIndex: 1 }} />
    </div>
  );
}

/**
 * לוגו מלא — אמבלמה + שם בפונט הסריף האלגנטי.
 * onDark=true לרקע כהה (סרגל צד), false לרקע בהיר.
 */
export function Logo({
  size = 46,
  onDark = true,
  subtitle = "גמ״ח · מערכת ניהול",
  nameSize,
}: {
  size?: number;
  onDark?: boolean;
  subtitle?: string | null;
  nameSize?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <LogoMark size={size} />
      <div style={{ minWidth: 0 }}>
        <div className="display" style={{ fontSize: nameSize ?? Math.round(size * 0.42), fontWeight: 800, lineHeight: 1.15, color: onDark ? "#fff" : "var(--brand-dark)", whiteSpace: "nowrap" }}>
          זכרון אהרן
        </div>
        {subtitle && (
          <div style={{ fontSize: ".7rem", opacity: onDark ? 0.64 : 0.75, marginTop: 2, letterSpacing: ".03em", color: onDark ? "#fff" : "var(--muted)", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
