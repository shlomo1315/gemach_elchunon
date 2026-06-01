"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ils, num, gdate } from "@/lib/format";
import { Card, StatCard, PageTitle, Badge, Loading, Empty } from "@/components/ui";
import type { FundSummary, Transaction, MemberBalance } from "@/types";

type Recent = Transaction & { members: { name: string } | null };

export default function Dashboard() {
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [top, setTop] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, r, t] = await Promise.all([
        supabase.from("fund_summary").select("*").single(),
        supabase
          .from("transactions")
          .select("*, members(name)")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("member_balances")
          .select("*")
          .order("balance", { ascending: false })
          .limit(5),
      ]);
      setSummary(s.data as FundSummary);
      setRecent((r.data as Recent[]) || []);
      setTop((t.data as MemberBalance[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle>סקירה כללית</PageTitle>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label='סך הכל בקופה' value={ils(summary?.total_balance)} />
        <StatCard label="מספר חברים" value={num(summary?.members_count)} color="#2c3e50" />
        <StatCard label="סך הפקדות" value={ils(summary?.total_deposits)} color="#1e7d4f" />
        <StatCard label="סך משיכות" value={ils(summary?.total_withdrawals)} color="#c0392b" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>פעולות אחרונות</h3>
          {recent.length === 0 ? (
            <Empty text="אין פעולות עדיין" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>חבר</th>
                  <th>סוג</th>
                  <th>סכום</th>
                  <th>תאריך</th>
                  <th>הערות</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td>{t.members?.name}</td>
                    <td><Badge type={t.type} /></td>
                    <td>{ils(t.amount)}</td>
                    <td>{t.heb_date || gdate(t.greg_date)}</td>
                    <td style={{ color: "#7a8699" }}>{t.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>יתרות מובילות</h3>
          {top.map((m) => (
            <Link
              key={m.id}
              href={`/members/${m.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.6rem 0",
                borderBottom: "1px solid #eef0f4",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span>{m.name || "—"}</span>
              <strong style={{ color: "var(--brand)" }}>{ils(m.balance)}</strong>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
