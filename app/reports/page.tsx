"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { ils } from "@/lib/format";
import { Card, PageTitle, Loading } from "@/components/ui";
import type { Transaction, MemberBalance } from "@/types";

const COLORS = ["#1e6f5c", "#c0392b", "#2980b9", "#e67e22", "#8e44ad"];

export default function ReportsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, m] = await Promise.all([
        supabase.from("transactions").select("*"),
        supabase.from("member_balances").select("*").order("balance", { ascending: false }).limit(10),
      ]);
      setTxns((t.data as Transaction[]) || []);
      setMembers((m.data as MemberBalance[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading />;

  const dep = txns.filter((t) => t.type === "הפקדה").reduce((s, t) => s + t.amount, 0);
  const wit = txns.filter((t) => t.type === "משיכה").reduce((s, t) => s + t.amount, 0);

  const typeData = [
    { name: "הפקדות", value: dep },
    { name: "משיכות", value: wit },
  ];

  const methodMap: Record<string, number> = {};
  txns.forEach((t) => {
    const k = t.method || "ללא ציון";
    methodMap[k] = (methodMap[k] || 0) + t.amount;
  });
  const methodData = Object.entries(methodMap).map(([name, value]) => ({ name, value }));

  const topData = members
    .filter((m) => m.balance > 0)
    .map((m) => ({ name: m.name || "—", value: m.balance }));

  return (
    <div>
      <PageTitle>דוחות וניתוח</PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>הפקדות מול משיכות</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" outerRadius={90} label>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "#1e6f5c" : "#c0392b"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => ils(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>פילוח לפי אופן פעולה</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={methodData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => ils(v)} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {methodData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ marginTop: 0 }}>10 היתרות הגבוהות ביותר</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topData} layout="vertical" margin={{ right: 30, left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => ils(v)} />
              <Bar dataKey="value" fill="#1e6f5c" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
