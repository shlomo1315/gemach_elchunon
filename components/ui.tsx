"use client";

import React from "react";

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
