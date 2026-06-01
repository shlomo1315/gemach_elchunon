"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  BarChart3,
} from "lucide-react";

const links = [
  { href: "/", label: "ראשי", icon: LayoutDashboard },
  { href: "/members", label: "חברים", icon: Users },
  { href: "/transactions", label: "פעולות", icon: ArrowLeftRight },
  { href: "/reports", label: "דוחות", icon: BarChart3 },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside
      className="no-print"
      style={{
        width: 220,
        background: "var(--brand-dark)",
        color: "#fff",
        padding: "1.25rem 0.75rem",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "0 0.5rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,.15)", marginBottom: "1rem" }}>
        <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>גמ"ח אייזנבלט</div>
        <div style={{ fontSize: ".75rem", opacity: 0.7 }}>מערכת ניהול</div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                color: "#fff",
                textDecoration: "none",
                background: active ? "rgba(255,255,255,.18)" : "transparent",
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
