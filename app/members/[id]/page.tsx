"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ils, gdate } from "@/lib/format";
import { Card, PageTitle, Button, Badge, Loading, Empty } from "@/components/ui";
import type { MemberBalance, Transaction } from "@/types";

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberBalance | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, t] = await Promise.all([
        supabase.from("member_balances").select("*").eq("id", id).single(),
        supabase
          .from("transactions")
          .select("*")
          .eq("member_id", id)
          .order("created_at", { ascending: true }),
      ]);
      setMember(m.data as MemberBalance);
      setTxns((t.data as Transaction[]) || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loading />;
  if (!member) return <Empty text="חבר לא נמצא" />;

  // יתרה רצה
  let running = 0;

  return (
    <div>
      <PageTitle
        action={
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            <Link href="/members"><Button variant="ghost">← חזרה</Button></Link>
            <Button onClick={() => window.print()}>🖨️ הדפסת דף יתרה</Button>
          </div>
        }
      >
        {member.name || "—"}
      </PageTitle>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Card style={{ flex: 1, minWidth: 240 }}>
          <Row label="קוד אישי" value={member.code || "—"} />
          <Row label="טלפון" value={member.phone || "—"} />
          <Row label="כתובת" value={member.address || "—"} />
        </Card>
        <Card style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: ".85rem", color: "#7a8699" }}>יתרה נוכחית</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: member.balance >= 0 ? "var(--brand)" : "#c0392b" }}>
            {ils(member.balance)}
          </div>
          <div style={{ fontSize: ".85rem", color: "#7a8699" }}>{member.txn_count} פעולות</div>
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <h3 style={{ padding: "1rem 1.25rem 0" }}>היסטוריית פעולות</h3>
        {txns.length === 0 ? (
          <Empty text="אין פעולות לחבר זה" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>סוג</th>
                  <th>סכום</th>
                  <th>אופן</th>
                  <th>תאריך</th>
                  <th>הערות</th>
                  <th>יתרה מצטברת</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t, i) => {
                  running += t.type === "משיכה" ? -t.amount : t.amount;
                  return (
                    <tr key={t.id}>
                      <td>{i + 1}</td>
                      <td><Badge type={t.type} /></td>
                      <td style={{ fontWeight: 600, color: t.type === "משיכה" ? "#c0392b" : "#1e7d4f" }}>
                        {t.type === "משיכה" ? "-" : "+"}{ils(t.amount)}
                      </td>
                      <td>{t.method || "—"}</td>
                      <td>{t.heb_date || gdate(t.greg_date) || "—"}</td>
                      <td style={{ color: "#7a8699" }}>{t.notes}</td>
                      <td style={{ fontWeight: 700 }}>{ils(running)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #eef0f4" }}>
      <span style={{ color: "#7a8699" }}>{label}</span>
      <span dir="auto" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
