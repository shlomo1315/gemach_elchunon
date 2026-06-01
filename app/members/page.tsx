"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ils } from "@/lib/format";
import { PageTitle, Button, Loading, Empty } from "@/components/ui";
import type { MemberBalance } from "@/types";

const BRAND = "#1e6f5c";
const inp: React.CSSProperties = {
  padding: "0.55rem 0.8rem",
  border: "1.5px solid #d8dde5",
  borderRadius: 10,
  fontSize: ".9rem",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color .15s",
};
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ name }: { name: string }) {
  const colors = ["#1e6f5c","#2980b9","#8e44ad","#e67e22","#16a085","#c0392b","#d35400","#27ae60"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: colors[idx],
      color: "#fff", fontWeight: 700, fontSize: ".8rem",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "balance" | "txn_count">("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  async function load() {
    const { data } = await supabase.from("member_balances").select("*").order("name");
    setMembers((data as MemberBalance[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const closeModal = useCallback(() => {
    setAdding(false);
    setForm({ name: "", code: "", phone: "", address: "" });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim();
    let list = s
      ? members.filter(m =>
          (m.name || "").includes(s) ||
          (m.code || "").includes(s) ||
          (m.phone || "").includes(s) ||
          (m.address || "").includes(s)
        )
      : [...members];
    list.sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (typeof av === "string") return sortDir * av.localeCompare(bv as string);
      return sortDir * ((av as number) - (bv as number));
    });
    return list;
  }, [q, members, sortBy, sortDir]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortBy(col); setSortDir(-1); }
  }

  const SortTh = ({ col, children }: { col: typeof sortBy; children: React.ReactNode }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
    >
      {children}
      {sortBy === col ? (sortDir === 1 ? " ↑" : " ↓") : " ⇅"}
    </th>
  );

  async function addMember() {
    if (!form.name.trim()) { alert("יש להזין שם"); return; }
    setSaving(true);
    const { error } = await supabase.from("members").insert({
      name: form.name.trim(),
      code: form.code.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    });
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    closeModal();
    load();
  }

  const withBalance = members.filter(m => m.balance > 0).length;

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle action={<Button onClick={() => setAdding(true)}>+ חבר חדש</Button>}>
        חברים ({members.length})
      </PageTitle>

      {/* KPI שורה קצרה */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { label: "סה״כ חברים", value: members.length, color: BRAND },
          { label: "עם יתרה חיובית", value: withBalance, color: "#2980b9" },
          { label: "ללא פעולות", value: members.filter(m => m.txn_count === 0).length, color: "#7a8699" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "#fff", borderRadius: 12, padding: "0.7rem 1.1rem",
            border: `1.5px solid ${color}22`, flex: "1 1 120px",
            boxShadow: "0 1px 3px rgba(0,0,0,.05)",
          }}>
            <div style={{ fontSize: ".75rem", color: "#9aa5b5" }}>{label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* חיפוש */}
      <div style={{
        background: "#fff", borderRadius: 12, padding: "0.75rem 1rem",
        boxShadow: "0 1px 3px rgba(0,0,0,.06)", marginBottom: 12,
      }}>
        <input
          placeholder="🔍 חיפוש לפי שם / קוד / טלפון / כתובת…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ ...inp, border: "1.5px solid #e2e8f0", background: "#f8fafc" }}
        />
      </div>

      {/* טבלה */}
      <div style={{
        background: "#fff", borderRadius: 14,
        boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        overflow: "hidden",
      }}>
        {filtered.length === 0 ? (
          <Empty text="לא נמצאו חברים" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f4f3" }}>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>
                    שם ומשפחה
                  </th>
                  <th style={{ padding: "0.7rem 0.75rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>קוד</th>
                  <th style={{ padding: "0.7rem 0.75rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>טלפון</th>
                  <th style={{ padding: "0.7rem 0.75rem", textAlign: "right", fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>כתובת</th>
                  <SortTh col="txn_count"><span style={{ fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>פעולות</span></SortTh>
                  <SortTh col="balance"><span style={{ fontSize: ".85rem", fontWeight: 700, color: "#2c3e50" }}>יתרה</span></SortTh>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/members/${m.id}`)}
                    style={{ cursor: "pointer", transition: "background .1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f4faf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ padding: "0.65rem 1rem", borderBottom: "1px solid #f0f2f5" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={m.name || "?"} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#1a1a2e" }}>{m.name || "—"}</div>
                          {m.address && <div style={{ fontSize: ".75rem", color: "#9aa5b5", marginTop: 1 }}>{m.address}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", fontSize: ".85rem", color: "#4a5568" }}>
                      {m.code || "—"}
                    </td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", fontSize: ".85rem" }} dir="ltr">
                      {m.phone || "—"}
                    </td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", fontSize: ".82rem", color: "#7a8699" }}>
                      {m.address || "—"}
                    </td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5", textAlign: "center" }}>
                      {m.txn_count > 0 ? (
                        <span style={{
                          background: "#eef2ff", color: "#4f46e5",
                          borderRadius: 999, padding: "0.15rem 0.6rem",
                          fontSize: ".8rem", fontWeight: 600,
                        }}>{m.txn_count}</span>
                      ) : (
                        <span style={{ color: "#cbd5e0", fontSize: ".8rem" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid #f0f2f5" }}>
                      <span style={{
                        background: m.balance > 0 ? "#e3f6ec" : m.balance < 0 ? "#fde8e8" : "#f0f4f3",
                        color: m.balance > 0 ? BRAND : m.balance < 0 ? "#c0392b" : "#7a8699",
                        borderRadius: 8, padding: "0.25rem 0.7rem",
                        fontSize: ".85rem", fontWeight: 700,
                        display: "inline-block",
                      }}>
                        {ils(m.balance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: "0.6rem 1rem", borderTop: "1px solid #f0f2f5", fontSize: ".78rem", color: "#9aa5b5", textAlign: "center" }}>
          מציג {filtered.length} מתוך {members.length} חברים • לחץ על שורה לכרטסת החבר
        </div>
      </div>

      {/* מודאל הוספת חבר */}
      {adding && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div style={{
            background: "#fff", borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            width: "100%", maxWidth: 480,
            padding: "1.75rem",
            direction: "rtl",
            animation: "modalIn 0.18s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: BRAND }}>👤 חבר חדש</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", color: "#9aa5b5", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>שם ומשפחה *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  style={inp} placeholder="ישראל ישראלי" autoFocus />
              </div>
              <div>
                <label style={lbl}>קוד</label>
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                  style={inp} placeholder="1234" />
              </div>
              <div>
                <label style={lbl}>טלפון</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  style={inp} placeholder="050-0000000" dir="ltr" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>כתובת</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  style={inp} placeholder="רחוב, עיר" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <Button onClick={addMember} disabled={saving}>{saving ? "שומר…" : "✓ הוסף חבר"}</Button>
              <Button variant="ghost" onClick={closeModal}>ביטול</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
