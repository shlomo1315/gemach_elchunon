"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ArrowLeftRight, BarChart3, LogOut } from "lucide-react";
import { useAuth } from "./AuthGuard";

const links = [
  { href: "/", label: "ראשי", icon: LayoutDashboard },
  { href: "/members", label: "חברים", icon: Users },
  { href: "/transactions", label: "פעולות", icon: ArrowLeftRight },
  { href: "/reports", label: "דוחות", icon: BarChart3 },
];

export default function Sidebar() {
  const path = usePathname();
  const { user, logout } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

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

      {/* משתמש + יציאה */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: "0.9rem", marginTop: "0.5rem" }}>
        {displayName && (
          <div style={{ fontSize: ".75rem", opacity: 0.65, marginBottom: 8, padding: "0 0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            👤 {displayName}
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
