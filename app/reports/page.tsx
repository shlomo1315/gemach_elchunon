"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { ils } from "@/lib/format";
import { Card, PageTitle, Loading } from "@/components/ui";
import type { Transaction, MemberBalance } from "@/types";

const BRAND = "#1e6f5c";
const RED = "#e05252";
const BLUE = "#3b82f6";
const ORANGE = "#f59e0b";
const PURPLE = "#8b5cf6";
const PALETTE = [BRAND, RED, BLUE, ORANGE, PURPLE, "#06b6d4", "#ec4899"];

type Tab = "overview" | "methods" | "top" | "trend";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "סקירה כללית", icon: "📊" },
  { id: "methods",  label: "אופן פעולה",  icon: "💳" },
  { id: "top",      label: "יתרות מובילות", icon: "🏆" },
  { id: "trend",    label: "מגמה חודשית",  icon: "📈" },
];

function StatChip({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
      border: `1.5px solid ${color}30`,
      borderRadius: 14,
      padding: "1rem 1.25rem",
      flex: 1,
      minWidth: 150,
    }}>
      <div style={{ fontSize: ".78rem", color: "#7a8699", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: ".75rem", color: "#9aa5b5", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const customTooltipStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  boxShadow: "0 4px 16px rgba(0,0,0,.1)",
  padding: "0.5rem 0.9rem",
  fontSize: ".85rem",
  direction: "rtl" as const,
};

function IlsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={customTooltipStyle}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4, color: "#1a1a2e" }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || BRAND }}>
          {p.name ? `${p.name}: ` : ""}<strong>{ils(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [topN, setTopN] = useState(10);

  useEffect(() => {
    (async () => {
      const [t, m] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at"),
        supabase.from("member_balances").select("*").order("balance", { ascending: false }),
      ]);
      setTxns((t.data as Transaction[]) || []);
      setMembers((m.data as MemberBalance[]) || []);
      setLoading(false);
    })();
  }, []);

  const dep    = useMemo(() => txns.filter(t => t.type === "הפקדה").reduce((s, t) => s + t.amount, 0), [txns]);
  const wit    = useMemo(() => txns.filter(t => t.type === "משיכה").reduce((s, t) => s + t.amount, 0), [txns]);
  const net    = dep - wit;
  const total  = txns.length;

  const typeData = [
    { name: "הפקדות", value: dep },
    { name: "משיכות", value: wit },
  ];

  const methodData = useMemo(() => {
    const map: Record<string, { הפקדות: number; משיכות: number }> = {};
    txns.forEach(t => {
      const k = t.method || "ללא ציון";
      if (!map[k]) map[k] = { הפקדות: 0, משיכות: 0 };
      if (t.type === "הפקדה") map[k].הפקדות += t.amount;
      else map[k].משיכות += t.amount;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, total: v.הפקדות + v.משיכות }))
      .sort((a, b) => b.total - a.total);
  }, [txns]);

  const topData = useMemo(() =>
    members.filter(m => m.balance > 0).slice(0, topN)
      .map(m => ({ name: m.name || "—", value: m.balance }))
  , [members, topN]);

  const trendData = useMemo(() => {
    const map: Record<string, { month: string; הפקדות: number; משיכות: number }> = {};
    txns.forEach(t => {
      const d = t.greg_date ? new Date(t.greg_date) : null;
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("he-IL", { month: "short", year: "2-digit" });
      if (!map[key]) map[key] = { month: label, הפקדות: 0, משיכות: 0 };
      if (t.type === "הפקדה") map[key].הפקדות += t.amount;
      else map[key].משיכות += t.amount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [txns]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle>דוחות וניתוח</PageTitle>

      {/* KPI chips */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatChip label="סה״כ הפקדות" value={ils(dep)} color={BRAND} sub={`${txns.filter(t=>t.type==="הפקדה").length} פעולות`} />
        <StatChip label="סה״כ משיכות" value={ils(wit)} color={RED} sub={`${txns.filter(t=>t.type==="משיכה").length} פעולות`} />
        <StatChip label="נטו בקופה" value={ils(net)} color={net >= 0 ? BRAND : RED} />
        <StatChip label="סה״כ פעולות" value={String(total)} color={BLUE} sub={`${members.length} חברים`} />
      </div>

      {/* טאבים */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "0.5rem 1.1rem",
              borderRadius: 999,
              border: tab === t.id ? `2px solid ${BRAND}` : "2px solid #e2e8f0",
              background: tab === t.id ? BRAND : "#fff",
              color: tab === t.id ? "#fff" : "#4a5568",
              fontWeight: 600,
              fontSize: ".85rem",
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* תוכן לפי טאב */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <h3 style={{ marginTop: 0, fontSize: "1rem", color: "#2c3e50" }}>📊 הפקדות מול משיכות</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  <Cell fill={BRAND} />
                  <Cell fill={RED} />
                </Pie>
                <Tooltip content={<IlsTooltip />} />
                <Legend formatter={(v) => <span style={{ fontSize: ".85rem" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 8 }}>
              <span style={{ fontSize: ".85rem" }}>
                <span style={{ color: BRAND, fontWeight: 700 }}>●</span> הפקדות: <strong>{ils(dep)}</strong>
              </span>
              <span style={{ fontSize: ".85rem" }}>
                <span style={{ color: RED, fontWeight: 700 }}>●</span> משיכות: <strong>{ils(wit)}</strong>
              </span>
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, fontSize: "1rem", color: "#2c3e50" }}>💳 פילוח לפי אופן</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={methodData} margin={{ top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₪${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<IlsTooltip />} />
                <Bar dataKey="הפקדות" fill={BRAND} radius={[4, 4, 0, 0]} />
                <Bar dataKey="משיכות" fill={RED} radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {tab === "methods" && (
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "1rem", color: "#2c3e50" }}>💳 פירוט לפי אופן פעולה</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>אופן</th>
                  <th>הפקדות</th>
                  <th>משיכות</th>
                  <th>סה״כ</th>
                  <th>% מסך הכל</th>
                </tr>
              </thead>
              <tbody>
                {methodData.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: BRAND, fontWeight: 600 }}>{ils(r.הפקדות)}</td>
                    <td style={{ color: RED, fontWeight: 600 }}>{ils(r.משיכות)}</td>
                    <td style={{ fontWeight: 700 }}>{ils(r.total)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          height: 8, borderRadius: 4,
                          width: `${Math.round((r.total / (dep + wit)) * 100)}%`,
                          minWidth: 4, maxWidth: 120,
                          background: PALETTE[i % PALETTE.length],
                        }} />
                        <span style={{ fontSize: ".8rem", color: "#7a8699" }}>
                          {((r.total / (dep + wit)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "top" && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: "1rem", color: "#2c3e50" }}>🏆 יתרות מובילות</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {[5, 10, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  style={{
                    padding: "0.3rem 0.8rem",
                    borderRadius: 999,
                    border: topN === n ? `1.5px solid ${BRAND}` : "1.5px solid #e2e8f0",
                    background: topN === n ? BRAND : "#fff",
                    color: topN === n ? "#fff" : "#4a5568",
                    fontWeight: 600, fontSize: ".8rem", cursor: "pointer",
                  }}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(300, topN * 38)}>
            <BarChart data={topData} layout="vertical" margin={{ right: 60, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₪${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
              <Tooltip content={<IlsTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} label={{ position: "right", formatter: (v: number) => ils(v), fontSize: 11, fill: "#4a5568" }}>
                {topData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? ORANGE : i === 1 ? "#64748b" : i === 2 ? "#a0522d" : BRAND} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {tab === "trend" && (
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "1rem", color: "#2c3e50" }}>📈 מגמה חודשית — הפקדות מול משיכות</h3>
          {trendData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#9aa5b5" }}>אין נתוני תאריך לתצוגת מגמה</div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={trendData} margin={{ top: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₪${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<IlsTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="הפקדות" stroke={BRAND} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="משיכות" stroke={RED} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}
    </div>
  );
}
