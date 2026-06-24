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
      width: 230, background: "linear-gradient(185deg, #1b6555 0%, var(--brand-dark) 55%, #123f31 100%)",
      color: "#fff", padding: "1.25rem 0.85rem",
      flexShrink: 0, display: "flex", flexDirection: "column",
      boxShadow: "2px 0 20px rgba(16,30,54,.12)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 0.4rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,.14)", marginBottom: "1rem" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.15rem", fontWeight: 900, letterSpacing: "-.04em",
        }}>חא</div>
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.25 }}>גמ״ח חסדי אהרן</div>
          <div style={{ fontSize: ".7rem", opacity: 0.6, marginTop: 1 }}>מערכת ניהול</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              position: "relative",
              display: "flex", alignItems: "center", gap: 11,
              padding: "0.62rem 0.8rem", borderRadius: 10,
              color: active ? "#fff" : "rgba(255,255,255,.82)", textDecoration: "none",
              background: active ? "rgba(255,255,255,.16)" : "transparent",
              fontWeight: active ? 700 : 500, fontSize: ".93rem",
              transition: "background .14s, color .14s",
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              {active && <span style={{ position: "absolute", insetInlineStart: -0, top: "50%", transform: "translateY(-50%)", width: 3.5, height: 20, borderRadius: 999, background: "#7fe7c4" }} />}
              <Icon size={18} style={{ flexShrink: 0, opacity: active ? 1 : .9 }} />
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
