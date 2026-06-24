"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, CartesianGrid, LabelList,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { ils } from "@/lib/format";
import { Loading } from "@/components/ui";
import type { Transaction, MemberBalance } from "@/types";

const BRAND = "#107a5e";
const RED = "#e05252";
const BLUE = "#3b82f6";
const ORANGE = "#f59e0b";
const PURPLE = "#8b5cf6";
const CYAN = "#06b6d4";
const PALETTE = [BRAND, BLUE, ORANGE, PURPLE, CYAN, "#ec4899", "#84cc16"];

type Tab = "overview" | "methods" | "top" | "trend";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "📊 סקירה" },
  { id: "methods", label: "💳 אופן פעולה" },
  { id: "top", label: "🏆 יתרות" },
  { id: "trend", label: "📈 מגמה" },
];

function Chip({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      flex: "1 1 150px", background: "#fff", borderRadius: 14,
      padding: "1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,.05)",
      borderTop: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: ".75rem", color: "#9aa5b5", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.55rem", fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: ".72rem", color: "#b0bac7", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "1.25rem", boxShadow: "var(--shadow)", marginBottom: 16 }}>
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "0 0 1rem", fontSize: ".95rem", fontWeight: 800, color: "#2c3e50" }}>{children}</h3>;
}

function IlsTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.5rem 0.9rem", fontSize: ".83rem", direction: "rtl", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
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

  const dep = useMemo(() => txns.filter(t => t.type === "הפקדה").reduce((s, t) => s + t.amount, 0), [txns]);
  const wit = useMemo(() => txns.filter(t => t.type === "משיכה").reduce((s, t) => s + t.amount, 0), [txns]);
  const net = dep - wit;

  const typeData = [{ name: "הפקדות", value: dep }, { name: "משיכות", value: wit }];

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
    members.filter(m => m.balance > 0).slice(0, topN).map(m => ({ name: m.name || "—", value: m.balance })),
    [members, topN]);

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
    <div style={{ direction: "rtl" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a2e" }}>דוחות וניתוח</h1>
      </div>

      {/* KPI */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <Chip label="סך הפקדות" value={ils(dep)} color={BRAND} sub={`${txns.filter(t => t.type === "הפקדה").length} פעולות`} />
        <Chip label="סך משיכות" value={ils(wit)} color={RED} sub={`${txns.filter(t => t.type === "משיכה").length} פעולות`} />
        <Chip label="יתרה נטו" value={ils(net)} color={net >= 0 ? BRAND : RED} />
        <Chip label="סך פעולות" value={String(txns.length)} color={BLUE} sub={`${members.length} חברים`} />
      </div>

      {/* טאבים */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "0.45rem 1rem", borderRadius: 999,
            border: tab === t.id ? `2px solid ${BRAND}` : "2px solid #e2e8f0",
            background: tab === t.id ? "var(--grad-brand)" : "#fff",
            boxShadow: tab === t.id ? "var(--shadow-brand)" : undefined,
            color: tab === t.id ? "#fff" : "#4a5568",
            fontWeight: 600, fontSize: ".84rem", cursor: "pointer",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* סקירה */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Panel>
            <PanelTitle>הפקדות מול משיכות</PanelTitle>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={95} innerRadius={48} paddingAngle={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "#ccc" }}>
                  <Cell fill={BRAND} />
                  <Cell fill={RED} />
                </Pie>
                <Tooltip content={<IlsTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
              {[["הפקדות", ils(dep), BRAND], ["משיכות", ils(wit), RED]].map(([l, v, c]) => (
                <div key={l as string} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".7rem", color: "#9aa5b5" }}>{l}</div>
                  <div style={{ fontWeight: 700, color: c as string }}>{v}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle>פילוח לפי אופן פעולה</PanelTitle>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={methodData} margin={{ top: 10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<IlsTip />} />
                <Bar dataKey="הפקדות" fill={BRAND} radius={[4, 4, 0, 0]} />
                <Bar dataKey="משיכות" fill={RED} radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}

      {/* אופן */}
      {tab === "methods" && (
        <Panel>
          <PanelTitle>פירוט לפי אופן פעולה</PanelTitle>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["אופן", "הפקדות", "משיכות", "סה״כ", "אחוז"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 0.9rem", textAlign: "right", fontSize: ".82rem", fontWeight: 700, color: "#4a5568", borderBottom: "2px solid #f0f2f5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {methodData.map((r, i) => (
                  <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = "#f8fbf9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "0.65rem 0.9rem", fontWeight: 600, borderBottom: "1px solid #f0f2f5" }}>{r.name}</td>
                    <td style={{ padding: "0.65rem 0.9rem", color: BRAND, fontWeight: 600, borderBottom: "1px solid #f0f2f5" }}>{ils(r.הפקדות)}</td>
                    <td style={{ padding: "0.65rem 0.9rem", color: RED, fontWeight: 600, borderBottom: "1px solid #f0f2f5" }}>{ils(r.משיכות)}</td>
                    <td style={{ padding: "0.65rem 0.9rem", fontWeight: 700, borderBottom: "1px solid #f0f2f5" }}>{ils(r.total)}</td>
                    <td style={{ padding: "0.65rem 0.9rem", borderBottom: "1px solid #f0f2f5" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, maxWidth: 80, height: 6, background: "#f0f2f5", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${((r.total / (dep + wit)) * 100).toFixed(1)}%`, height: "100%", background: PALETTE[i % PALETTE.length], borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: ".78rem", color: "#7a8699" }}>{((r.total / (dep + wit)) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* יתרות */}
      {tab === "top" && (
        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <PanelTitle>יתרות מובילות</PanelTitle>
            <div style={{ display: "flex", gap: 6 }}>
              {[5, 10, 20].map(n => (
                <button key={n} onClick={() => setTopN(n)} style={{
                  padding: "0.25rem 0.75rem", borderRadius: 999,
                  border: topN === n ? `1.5px solid ${BRAND}` : "1.5px solid #e2e8f0",
                  background: topN === n ? "var(--grad-brand)" : "#fff",
                  boxShadow: topN === n ? "var(--shadow-brand)" : undefined,
                  color: topN === n ? "#fff" : "#4a5568",
                  fontWeight: 600, fontSize: ".78rem", cursor: "pointer",
                }}>Top {n}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(280, topN * 36)}>
            <BarChart data={topData} layout="vertical" margin={{ right: 70, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip content={<IlsTip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" formatter={(v: number) => ils(v)} style={{ fontSize: 11, fill: "#4a5568" }} />
                {topData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? ORANGE : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : BRAND} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* מגמה */}
      {tab === "trend" && (
        <Panel>
          <PanelTitle>מגמה חודשית — הפקדות מול משיכות</PanelTitle>
          {trendData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#9aa5b5" }}>אין נתוני תאריך לתצוגת מגמה</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData} margin={{ top: 10, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<IlsTip />} />
                <Legend />
                <Line type="monotone" dataKey="הפקדות" stroke={BRAND} strokeWidth={2.5} dot={{ r: 4, fill: BRAND }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="משיכות" stroke={RED} strokeWidth={2.5} dot={{ r: 4, fill: RED }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      )}
    </div>
  );
}
