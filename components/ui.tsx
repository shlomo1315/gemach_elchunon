"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

// חלונית הצלחה צפה במרכז המסך עם רקע מטושטש
export function SuccessPopup({
  title,
  lines,
  onClose,
}: {
  title: string;
  lines: [string, string][];
  onClose?: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1300,
        background: "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem", direction: "rtl",
        animation: "overlayOut .5s ease 1.8s forwards",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,.28)",
          width: "100%", maxWidth: 460, padding: "2.5rem 2rem",
          textAlign: "center",
          animation: "popIn .3s cubic-bezier(.2,.9,.3,1.2), popOut .5s ease 1.8s forwards",
        }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: "50%", background: "#e3f6ec",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 1rem",
        }}>
          <CheckCircle2 size={42} color="#1e6f5c" />
        </div>
        <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.35rem", fontWeight: 800, color: "#1a1a2e" }}>{title}</h2>
        <div style={{
          display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.6rem 1rem",
          fontSize: ".95rem", textAlign: "right",
          background: "#f8fafc", borderRadius: 12, padding: "1rem 1.25rem",
        }}>
          {lines.map(([l, v]) => (
            <div key={l} style={{ display: "contents" }}>
              <span style={{ color: "#9aa5b5" }}>{l}</span>
              <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Card({
  children,
  style,
  id,
  hover,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  id?: string;
  hover?: boolean;
}) {
  return (
    <div
      id={id}
      className={hover ? "ui-card-hover" : undefined}
      style={{
        background: "var(--card)",
        borderRadius: 16,
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
        padding: "1.25rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  color = "#1e6f5c",
  icon,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card hover style={{ flex: 1, minWidth: 170, padding: "1.15rem 1.3rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: ".82rem", color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>
          {label}
        </div>
        {icon && (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: `${color}14`, color }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ fontSize: "1.65rem", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: ".74rem", color: "var(--faint)", marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

export function PageTitle({
  children,
  action,
  subtitle,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1.25rem",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 5, height: 26, borderRadius: 999, background: "var(--brand)", flexShrink: 0 }} />
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, lineHeight: 1.15 }}>
            {children}
          </h1>
          {subtitle && <div style={{ fontSize: ".82rem", color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--brand)", color: "#fff", boxShadow: "0 2px 8px rgba(30,111,92,.25)" },
    ghost: { background: "var(--brand-light)", color: "var(--brand)" },
    danger: { background: "var(--red)", color: "#fff", boxShadow: "0 2px 8px rgba(214,69,69,.25)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="ui-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderRadius: 10,
        padding: "0.6rem 1.1rem",
        fontSize: ".9rem",
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

export function Badge({ type }: { type: string }) {
  const isDep = type === "הפקדה";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: isDep ? "var(--green-bg)" : "var(--red-bg)",
        color: isDep ? "var(--green)" : "#c0392b",
        padding: "0.2rem 0.65rem",
        borderRadius: 999,
        fontSize: ".78rem",
        fontWeight: 700,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: .8 }} />
      {type}
    </span>
  );
}

export function Spinner({ size = 26, color = "var(--brand)" }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 9))}px solid var(--line)`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin .7s linear infinite",
      }}
    />
  );
}

export function Loading({ text = "טוען נתונים…" }: { text?: string }) {
  return (
    <div style={{ padding: "4rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "var(--muted)" }}>
      <Spinner />
      <span style={{ fontSize: ".92rem", fontWeight: 500 }}>{text}</span>
    </div>
  );
}

export function Empty({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--faint)" }}>
      {icon && (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%", background: "var(--bg-soft)", color: "var(--faint)" }}>
          {icon}
        </span>
      )}
      <span style={{ fontSize: ".95rem" }}>{text}</span>
    </div>
  );
}
