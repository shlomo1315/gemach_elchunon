"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/lib/supabase";
import { ils, num, gdate } from "@/lib/format";
import { Badge, Loading } from "@/components/ui";
import type { FundSummary, Transaction, MemberBalance } from "@/types";
import { useAuth } from "@/components/AuthGuard";
import { Users, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp } from "lucide-react";

type Recent = Transaction & { members: { name: string } | null };

const BRAND = "#1e6f5c";
const RED = "#e05252";

function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: "1.25rem 1.4rem",
      boxShadow: "0 2px 8px rgba(0,0,0,.06)", flex: "1 1 160px",
      borderTop: `4px solid ${color}`,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: ".78rem", color: "#9aa5b5", fontWeight: 600 }}>{label}</div>
        <div style={{ color, opacity: .7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: ".72rem", color: "#b0bac7" }}>{sub}</div>}
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
const AVA_COLORS = [BRAND, "#2980b9", "#8e44ad", "#e67e22", "#16a085", "#d35400", "#27ae60"];
function Avatar({ name }: { name: string }) {
  const c = AVA_COLORS[(name?.charCodeAt(0) || 0) % AVA_COLORS.length];
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: c, color: "#fff", fontWeight: 700, fontSize: ".72rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

const tooltipStyle = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.1)", padding: "0.4rem 0.8rem", fontSize: ".82rem" };

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [top, setTop] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, r, t] = await Promise.all([
        supabase.from("fund_summary").select("*").single(),
        supabase.from("transactions").select("*, members(name)").order("created_at", { ascending: false }).limit(10),
        supabase.from("member_balances").select("*").order("balance", { ascending: false }).limit(6),
      ]);
      setSummary(s.data as FundSummary);
      setRecent((r.data as Recent[]) || []);
      setTop((t.data as MemberBalance[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading />;

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const today = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const pieData = [
    { name: "הפקדות", value: summary?.total_deposits || 0 },
    { name: "משיכות", value: summary?.total_withdrawals || 0 },
  ];
  const pct = summary?.total_deposits
    ? Math.round(((summary.total_deposits - (summary.total_withdrawals || 0)) / summary.total_deposits) * 100)
    : 0;

  return (
    <div style={{ direction: "rtl" }}>
      {/* כותרת */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a2e" }}>
          שלום{name ? `, ${name}` : ""} 👋
        </h1>
        <div style={{ color: "#9aa5b5", fontSize: ".85rem", marginTop: 4 }}>{today}</div>
      </div>

      {/* KPI שורה */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard label="יתרה בקופה" value={ils(summary?.total_balance)} icon={<Wallet size={20} />} color={BRAND}
          sub={`${num(summary?.members_count)} חברים פעילים`} />
        <KpiCard label="סך הפקדות" value={ils(summary?.total_deposits)} icon={<ArrowDownCircle size={20} />} color="#16a085" />
        <KpiCard label="סך משיכות" value={ils(summary?.total_withdrawals)} icon={<ArrowUpCircle size={20} />} color={RED} />
        <KpiCard label="חברים" value={num(summary?.members_count)} icon={<Users size={20} />} color="#3b82f6"
          sub={`${num(summary?.txn_count)} פעולות`} />
      </div>

      {/* גריד ראשי */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>

        {/* פעולות אחרונות */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.25rem", borderBottom: "1px solid #f0f2f5" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1a1a2e" }}>פעולות אחרונות</h3>
            <Link href="/transactions" style={{ fontSize: ".78rem", color: BRAND, fontWeight: 600, textDecoration: "none" }}>
              כל הפעולות ←
            </Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#9aa5b5" }}>אין פעולות עדיין</div>
          ) : (
            recent.map((t, i) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "0.75rem 1.25rem",
                borderBottom: i < recent.length - 1 ? "1px solid #f8fafc" : "none",
                transition: "background .1s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fbf9")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <Avatar name={t.members?.name || "?"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: ".88rem", color: "#1a1a2e" }}>{t.members?.name || "—"}</div>
                  <div style={{ fontSize: ".74rem", color: "#9aa5b5", marginTop: 1 }}>
                    {t.heb_date || gdate(t.greg_date) || "—"}
                    {t.notes ? ` · ${t.notes}` : ""}
                  </div>
                </div>
                <Badge type={t.type} />
                <div style={{ fontWeight: 700, fontSize: ".92rem", color: t.type === "משיכה" ? RED : BRAND, minWidth: 80, textAlign: "left" }}>
                  {t.type === "משיכה" ? "−" : "+"}{ils(t.amount)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* עמודה ימנית */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* פאי */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 800, color: "#1a1a2e" }}>הפקדות מול משיכות</h3>
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    <Cell fill={BRAND} />
                    <Cell fill={RED} />
                  </Pie>
                  <Tooltip formatter={(v: number) => ils(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: BRAND }}>{pct}%</div>
                <div style={{ fontSize: ".65rem", color: "#9aa5b5" }}>נטו</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 4 }}>
              <span style={{ fontSize: ".75rem", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: BRAND, display: "inline-block" }} />הפקדות
              </span>
              <span style={{ fontSize: ".75rem", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: RED, display: "inline-block" }} />משיכות
              </span>
            </div>
          </div>

          {/* יתרות מובילות */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1a1a2e" }}>יתרות מובילות</h3>
              <Link href="/members" style={{ fontSize: ".75rem", color: BRAND, fontWeight: 600, textDecoration: "none" }}>הכל ←</Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {top.filter(m => m.balance > 0).map((m, i) => {
                const maxBalance = top[0]?.balance || 1;
                const pct = Math.round((m.balance / maxBalance) * 100);
                return (
                  <Link key={m.id} href={`/members/${m.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ padding: "0.5rem 0", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = ".8")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: ".82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: ".72rem", color: "#9aa5b5", minWidth: 14 }}>{i + 1}.</span>
                          {m.name}
                        </span>
                        <span style={{ fontSize: ".82rem", fontWeight: 700, color: BRAND }}>{ils(m.balance)}</span>
                      </div>
                      <div style={{ height: 4, background: "#f0f2f5", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: BRAND, borderRadius: 2, transition: "width .3s" }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* קיצורי דרך */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 800, color: "#1a1a2e" }}>קיצורי דרך</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { href: "/members", label: "➕ הוספת חבר", color: BRAND },
                { href: "/transactions", label: "💳 פעולה חדשה", color: "#3b82f6" },
                { href: "/reports", label: "📊 דוחות", color: "#8b5cf6" },
              ].map(({ href, label, color }) => (
                <Link key={href} href={href} style={{
                  display: "block", padding: "0.55rem 0.85rem",
                  background: `${color}10`, borderRadius: 8,
                  color, fontWeight: 600, fontSize: ".85rem", textDecoration: "none",
                  border: `1px solid ${color}20`,
                }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
