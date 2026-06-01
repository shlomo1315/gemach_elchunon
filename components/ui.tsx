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
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
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
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Card style={{ flex: 1, minWidth: 170 }}>
      <div style={{ fontSize: ".85rem", color: "#7a8699", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color }}>{value}</div>
    </Card>
  );
}

export function PageTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
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
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
        {children}
      </h1>
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
    primary: { background: "var(--brand)", color: "#fff" },
    ghost: { background: "#eef2f1", color: "#1e6f5c" },
    danger: { background: "#e74c3c", color: "#fff" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        borderRadius: 8,
        padding: "0.55rem 1rem",
        fontSize: ".9rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
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
        background: isDep ? "#e3f6ec" : "#fde8e8",
        color: isDep ? "#1e7d4f" : "#c0392b",
        padding: "0.15rem 0.6rem",
        borderRadius: 999,
        fontSize: ".8rem",
        fontWeight: 600,
      }}
    >
      {type}
    </span>
  );
}

export function Loading() {
  return (
    <div style={{ padding: "3rem", textAlign: "center", color: "#7a8699" }}>
      טוען נתונים…
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: "2.5rem", textAlign: "center", color: "#9aa5b5" }}>
      {text}
    </div>
  );
}
