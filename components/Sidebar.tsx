"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ArrowLeftRight, BarChart3, LogOut, Settings, Upload, Sun, Moon } from "lucide-react";
import { useAuth } from "./AuthGuard";

const links = [
  { href: "/", label: "ראשי", icon: LayoutDashboard },
  { href: "/members", label: "חברים", icon: Users },
  { href: "/transactions", label: "פעולות", icon: ArrowLeftRight },
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
      width: 220, background: "var(--brand-dark)",
      color: "#fff", padding: "1.25rem 0.75rem",
      flexShrink: 0, display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "0 0.5rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,.15)", marginBottom: "1rem" }}>
        <div style={{ fontSize: "1.15rem", fontWeight: 800, lineHeight: 1.3 }}>גמ״ח חסדי אהרן</div>
        <div style={{ fontSize: ".72rem", opacity: 0.6, marginTop: 2 }}>מערכת ניהול</div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "0.6rem 0.75rem", borderRadius: 8,
              color: "#fff", textDecoration: "none",
              background: active ? "rgba(255,255,255,.18)" : "transparent",
              fontWeight: active ? 700 : 500,
              transition: "background .1s",
            }}>
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* מתג מצב כהה/בהיר */}
      <button onClick={toggleTheme} title={isDark ? "מצב בהיר" : "מצב כהה"} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        width: "100%", padding: "0.55rem 0.75rem", marginBottom: 4,
        background: "rgba(255,255,255,.08)", border: "none",
        borderRadius: 8, color: "rgba(255,255,255,.9)",
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
            {isDark ? <Moon size={10} color="#16513f" /> : <Sun size={10} color="#f59e0b" />}
          </span>
        </span>
      </button>

      {/* משתמש + יציאה */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: "0.9rem", marginTop: "0.5rem" }}>
        {displayName && (
          <div style={{ fontSize: ".75rem", opacity: 0.65, marginBottom: 8, padding: "0 0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </div>
        )}
        <button onClick={logout} style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "0.55rem 0.75rem",
          background: "rgba(255,255,255,.08)", border: "none",
          borderRadius: 8, color: "rgba(255,255,255,.8)",
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
