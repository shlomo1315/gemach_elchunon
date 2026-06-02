"use client";

import { useEffect, useState } from "react";
import { LogOut, Wallet, ArrowDownCircle, ArrowUpCircle, ListChecks } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ils, gdate } from "@/lib/format";
import { hebTextToGreg } from "@/lib/hebrewParse";
import { Badge, Loading } from "@/components/ui";
import type { MemberBalance, Transaction } from "@/types";

const BRAND = "#1e6f5c";
const BRAND_DARK = "#16513f";
const RED = "#e05252";

function gregOf(t: Transaction): string {
  if (t.greg_date) return gdate(t.greg_date);
  const iso = hebTextToGreg(t.heb_date);
  return iso ? gdate(iso) : "";
}

function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "1.25rem 1.4rem", boxShadow: "0 2px 8px rgba(0,0,0,.06)", borderTop: `4px solid ${color}`, flex: "1 1 180px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: ".8rem", color: "#9aa5b5", fontWeight: 600 }}>{label}</div>
        <div style={{ color, opacity: .7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function MemberPortal({ memberId, logout }: { memberId: string; logout: () => void }) {
  const [member, setMember] = useState<MemberBalance | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, t] = await Promise.all([
        supabase.from("member_balances").select("*").eq("id", memberId).single(),
        supabase.from("transactions").select("*").eq("member_id", memberId).order("created_at", { ascending: false }),
      ]);
      setMember(m.data as MemberBalance);
      setTxns((t.data as Transaction[]) || []);
      setLoading(false);
    })();
  }, [memberId]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loading /></div>;

  const dep = txns.filter(t => t.type === "הפקדה").reduce((s, t) => s + t.amount, 0);
  const wit = txns.filter(t => t.type === "משיכה").reduce((s, t) => s + t.amount, 0);
  const balance = member?.balance ?? dep - wit;

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: "var(--bg)" }}>
      {/* כותרת עליונה */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, ${BRAND})`, color: "#fff", padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>גמ״ח חסדי אהרן</div>
          <div style={{ fontSize: ".85rem", opacity: .85, marginTop: 2 }}>שלום, {member?.name} · אזור אישי (צפייה בלבד)</div>
        </div>
        <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "0.5rem 1rem", fontWeight: 600, cursor: "pointer", fontSize: ".9rem" }}>
          <LogOut size={16} /> יציאה
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
        {/* יתרה גדולה */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.07)", marginBottom: 18 }}>
          <div style={{ fontSize: ".9rem", color: "#9aa5b5", fontWeight: 600 }}>היתרה שלך בגמ״ח</div>
          <div style={{ fontSize: "2.8rem", fontWeight: 800, color: balance >= 0 ? BRAND : RED, lineHeight: 1.2 }}>{ils(balance)}</div>
          <div style={{ fontSize: ".85rem", color: "#b0bac7" }}>{txns.length} פעולות סה״כ</div>
        </div>

        {/* מצב מפורט */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <Stat label="סך ההפקדות שלך" value={ils(dep)} color="#16a085" icon={<ArrowDownCircle size={20} />} />
          <Stat label="סך המשיכות שלך" value={ils(wit)} color={RED} icon={<ArrowUpCircle size={20} />} />
          <Stat label="יתרה נוכחית" value={ils(balance)} color={BRAND} icon={<Wallet size={20} />} />
          <Stat label="מספר פעולות" value={String(txns.length)} color="#3b82f6" icon={<ListChecks size={20} />} />
        </div>

        {/* פעולות אחרונות */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
          <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid #f0f2f5", fontWeight: 800, color: "#1a1a2e" }}>
            הפעולות שלך
          </div>
          {txns.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#9aa5b5" }}>אין פעולות עדיין</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>סוג</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>סכום</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>תאריך עברי</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>תאריך לועזי</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: 700, color: "#4a5568" }}>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "0.55rem 1rem" }}><Badge type={t.type} /></td>
                      <td style={{ padding: "0.55rem 1rem", fontWeight: 700, color: t.type === "משיכה" ? RED : BRAND }}>
                        {t.type === "משיכה" ? "−" : "+"}{ils(t.amount)}
                      </td>
                      <td style={{ padding: "0.55rem 1rem", color: "#4a5568" }}>{t.heb_date || "—"}</td>
                      <td style={{ padding: "0.55rem 1rem", color: "#7a8699" }} dir="ltr">{gregOf(t) || "—"}</td>
                      <td style={{ padding: "0.55rem 1rem", color: "#7a8699" }}>{t.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", color: "#b0bac7", fontSize: ".78rem", marginTop: 16 }}>
          אזור אישי לצפייה בלבד · לשאלות פנה לגבאי הגמ״ח
        </div>
      </div>
    </div>
  );
}
