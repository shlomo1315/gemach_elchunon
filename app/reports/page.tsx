"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { ils } from "@/lib/format";
import { Loading } from "@/components/ui";
import type { Transaction, MemberBalance } from "@/types";

const BRAND = "#107a5e";
const GOLD = "#c79a3e";
const RED = "#e05252";
const BLUE = "#3b82f6";
const ORANGE = "#f59e0b";
const PURPLE = "#8b5cf6";
const CYAN = "#06b6d4";
const PALETTE = [BRAND, GOLD, BLUE, ORANGE, PURPLE, CYAN, "#ec4899", "#84cc16"];

type Tab = "overview" | "methods" | "top" | "trend";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "📊 סקירה" },
  { id: "methods", label: "💳 אופן פעולה" },
  { id: "top", label: "🏆 יתרות" },
  { id: "trend", label: "📈 מגמה" },
];

function Chip({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="hover-lift" style={{
      position: "relative", overflow: "hidden",
      flex: "1 1 150px", background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
      padding: "1rem 1.25rem", boxShadow: "var(--shadow)",
    }}>
      <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: 0, height: 4, background: `linear-gradient(90deg, ${color}, ${color}2e)` }} />
      <div style={{ fontSize: ".75rem", color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.55rem", fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: ".72rem", color: "var(--faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="hover-lift" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: "1.25rem", boxShadow: "var(--shadow)", marginBottom: 16 }}>
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="display" style={{ margin: "0 0 1rem", fontSize: "1.02rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center" }}>
      <span className="section-bar" style={{ marginInlineEnd: 8 }} />
      {children}
    </h3>
  );
}

function IlsTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "0.5rem 0.9rem", fontSize: ".83rem", direction: "rtl", boxShadow: "var(--shadow-md)" }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>{label}</div>}
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
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>דוחות וניתוח</h1>
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
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={92} innerRadius={60} paddingAngle={3} stroke="none">
                    <Cell fill={BRAND} />
                    <Cell fill={RED} />
                  </Pie>
                  <Tooltip content={<IlsTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: ".72rem", color: "var(--faint)", fontWeight: 600 }}>סך הכל</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }} dir="ltr">{ils(dep + wit)}</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 12 }}>
              {[["הפקדות", ils(dep), BRAND, dep + wit > 0 ? Math.round((dep / (dep + wit)) * 100) : 0], ["משיכות", ils(wit), RED, dep + wit > 0 ? Math.round((wit / (dep + wit)) * 100) : 0]].map(([l, v, c, p]) => (
                <div key={l as string} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".75rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 5, justifyContent: "center", fontWeight: 600 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: c as string, display: "inline-block" }} />{l} · {p}%
                  </div>
                  <div style={{ fontWeight: 800, color: c as string, fontVariantNumeric: "tabular-nums", marginTop: 3 }} dir="ltr">{v}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle>פילוח לפי אופן פעולה</PanelTitle>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={methodData} margin={{ top: 10, right: 8, bottom: 22 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7688" }} interval={0} angle={-18} textAnchor="end" height={52} />
                <YAxis tick={{ fontSize: 10, fill: "#9aa5b5" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip content={<IlsTip />} cursor={{ fill: "rgba(16,122,94,.05)" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                <Bar dataKey="הפקדות" fill={BRAND} radius={[5, 5, 0, 0]} maxBarSize={46} />
                <Bar dataKey="משיכות" fill={RED} radius={[5, 5, 0, 0]} maxBarSize={46} />
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
                }}>{n} המובילים</button>
              ))}
            </div>
          </div>
          {topData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--faint)" }}>אין נתונים להצגה</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 540, overflowY: "auto", paddingInlineEnd: 4 }}>
              {topData.map((m, i) => {
                const max = topData[0]?.value || 1;
                const pct = Math.max(1.5, Math.round((m.value / max) * 100));
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                const color = i === 0 ? GOLD : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : BRAND;
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 5 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span style={{ width: 26, textAlign: "center", fontSize: medal ? "1.05rem" : ".82rem", fontWeight: 800, color: "var(--faint)", flexShrink: 0 }}>{medal || (i + 1)}</span>
                        <span style={{ fontWeight: 600, fontSize: ".92rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      </span>
                      <span style={{ fontWeight: 800, fontSize: ".92rem", color, fontVariantNumeric: "tabular-nums", flexShrink: 0 }} dir="ltr">{ils(m.value)}</span>
                    </div>
                    <div style={{ height: 9, background: "#eef2f5", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: i < 3 ? `linear-gradient(90deg, ${color}, ${color}bb)` : "var(--grad-brand)", borderRadius: 999, transition: "width .4s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              <AreaChart data={trendData} margin={{ top: 10, right: 16 }}>
                <defs>
                  <linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gWit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.24} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7688" }} minTickGap={20} />
                <YAxis tick={{ fontSize: 10, fill: "#9aa5b5" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip content={<IlsTip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                <Area type="monotone" dataKey="הפקדות" stroke={BRAND} strokeWidth={2.5} fill="url(#gDep)" dot={{ r: 3, fill: BRAND }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="משיכות" stroke={RED} strokeWidth={2.5} fill="url(#gWit)" dot={{ r: 3, fill: RED }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      )}
    </div>
  );
}
