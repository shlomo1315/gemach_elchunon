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
          <CheckCircle2 size={42} color="#107a5e" />
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
        borderRadius: "var(--r-lg)",
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
  color = "#107a5e",
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
    <Card hover style={{ flex: 1, minWidth: 170, padding: "1.2rem 1.35rem", position: "relative", overflow: "hidden" }}>
      {/* פס מבטא עליון מדורג */}
      <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: 0, height: 4, background: `linear-gradient(90deg, ${color}, ${color}2e)` }} />
      {/* זוהר פינתי עדין */}
      <div style={{ position: "absolute", insetInlineEnd: -28, top: -28, width: 108, height: 108, borderRadius: "50%", background: `${color}10`, pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, position: "relative" }}>
        <div style={{ fontSize: ".82rem", color: "var(--muted)", fontWeight: 700, marginBottom: 10 }}>
          {label}
        </div>
        {icon && (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${color}20, ${color}10)`, color, boxShadow: `inset 0 0 0 1px ${color}22` }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", position: "relative" }}>{value}</div>
      {sub && <div style={{ fontSize: ".75rem", color: "var(--faint)", marginTop: 5, position: "relative" }}>{sub}</div>}
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
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <span style={{ width: 5, height: 30, borderRadius: 999, background: "linear-gradient(180deg, var(--brand), var(--gold))", flexShrink: 0, boxShadow: "0 2px 8px rgba(16,122,94,.25)" }} />
        <div>
          <h1 className="display" style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0, lineHeight: 1.15 }}>
            {children}
          </h1>
          {subtitle && <div style={{ fontSize: ".83rem", color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>}
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
    primary: { background: "var(--grad-brand)", color: "#fff", boxShadow: "var(--shadow-brand)" },
    ghost: { background: "var(--brand-light)", color: "var(--brand-dark)", boxShadow: "inset 0 0 0 1px rgba(16,122,94,.14)" },
    danger: { background: "linear-gradient(135deg, #e15a5a, var(--red))", color: "#fff", boxShadow: "0 10px 24px rgba(214,69,69,.28)" },
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
