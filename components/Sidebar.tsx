"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ArrowLeftRight, BarChart3, LogOut, Settings, Upload, Sun, Moon, Inbox } from "lucide-react";
import { useAuth } from "./AuthGuard";

const links = [
  { href: "/", label: "ראשי", icon: LayoutDashboard },
  { href: "/members", label: "חברים", icon: Users },
  { href: "/transactions", label: "פעולות", icon: ArrowLeftRight },
  { href: "/requests", label: "בקשות", icon: Inbox },
  { href: "/import", label: "ייבוא מאקסל", icon: Upload },
  { href: "/reports", label: "דוחות", icon: BarChart3 },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const { user, logout, theme, toggleTheme } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const isDark = theme === "dark";

  return (
    <aside className="no-print" style={{
      position: "relative",
      width: 238, flexShrink: 0,
      background: "linear-gradient(185deg, #15795f 0%, var(--brand-dark) 52%, var(--brand-deep) 100%)",
      color: "#fff", padding: "1.35rem 0.9rem",
      display: "flex", flexDirection: "column",
      boxShadow: "3px 0 28px rgba(7, 61, 46, .28)",
      overflow: "hidden",
    }}>
      {/* זוהר דקורטיבי עליון */}
      <div style={{ position: "absolute", top: -90, insetInlineEnd: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(199,154,62,.22), transparent 68%)", pointerEvents: "none" }} />
      {/* פס זהב עדין בקצה */}
      <div style={{ position: "absolute", top: 0, bottom: 0, insetInlineStart: 0, width: 3, background: "linear-gradient(180deg, var(--gold), transparent 60%)", opacity: .55, pointerEvents: "none" }} />

      {/* לוגו ומותג */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0 0.3rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,.13)", marginBottom: "1.1rem" }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: "linear-gradient(135deg, #e2c069 0%, var(--gold) 55%, var(--gold-dark) 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-.04em", color: "#0c5642",
          boxShadow: "0 8px 20px rgba(199,154,62,.42), inset 0 1px 1px rgba(255,255,255,.5)",
        }}>חא</div>
        <div>
          <div className="display" style={{ fontSize: "1.18rem", fontWeight: 800, lineHeight: 1.2 }}>גמ״ח חסדי אהרן</div>
          <div style={{ fontSize: ".7rem", opacity: 0.62, marginTop: 2, letterSpacing: ".04em" }}>מערכת ניהול</div>
        </div>
      </div>

      <nav style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              position: "relative",
              display: "flex", alignItems: "center", gap: 12,
              padding: "0.66rem 0.85rem", borderRadius: 11,
              color: active ? "#fff" : "rgba(255,255,255,.8)", textDecoration: "none",
              background: active ? "rgba(255,255,255,.15)" : "transparent",
              fontWeight: active ? 700 : 500, fontSize: ".94rem",
              boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,.08)" : "none",
              transition: "background .15s, color .15s",
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              {active && <span style={{ position: "absolute", insetInlineStart: -0, top: "50%", transform: "translateY(-50%)", width: 4, height: 22, borderRadius: 999, background: "linear-gradient(180deg, #e2c069, var(--gold))", boxShadow: "0 0 12px rgba(199,154,62,.8)" }} />}
              <Icon size={18} style={{ flexShrink: 0, opacity: active ? 1 : .9, color: active ? "var(--gold-light)" : undefined }} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* מתג מצב כהה/בהיר */}
      <button onClick={toggleTheme} title={isDark ? "מצב בהיר" : "מצב כהה"} style={{
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        width: "100%", padding: "0.55rem 0.75rem", marginBottom: 4,
        background: "rgba(255,255,255,.08)", border: "none",
        borderRadius: 10, color: "rgba(255,255,255,.9)",
        fontSize: ".85rem", fontWeight: 600, cursor: "pointer",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.18)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isDark ? <Moon size={16} /> : <Sun size={16} />}
          {isDark ? "מצב כהה" : "מצב בהיר"}
        </span>
        {/* מתג ויזואלי */}
        <span style={{
          width: 38, height: 20, borderRadius: 999, position: "relative",
          background: isDark ? "#0e1525" : "rgba(255,255,255,.35)", transition: "background .2s",
          flexShrink: 0,
        }}>
          <span style={{
            position: "absolute", top: 2, [isDark ? "left" : "right"]: 2,
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .2s",
          }}>
            {isDark ? <Moon size={10} color="#0c5642" /> : <Sun size={10} color="#f59e0b" />}
          </span>
        </span>
      </button>

      {/* משתמש + יציאה */}
      <div style={{ position: "relative", borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: "0.9rem", marginTop: "0.5rem" }}>
        {displayName && (
          <div style={{ fontSize: ".75rem", opacity: 0.65, marginBottom: 8, padding: "0 0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </div>
        )}
        <button onClick={logout} style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "0.55rem 0.75rem",
          background: "rgba(255,255,255,.08)", border: "none",
          borderRadius: 10, color: "rgba(255,255,255,.8)",
          fontSize: ".85rem", fontWeight: 500, cursor: "pointer",
          transition: "background .1s",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.18)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
        >
          <LogOut size={16} />
          יציאה
        </button>
      </div>
    </aside>
  );
}
