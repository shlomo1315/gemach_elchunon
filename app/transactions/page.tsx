"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ils, gdate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { Card, PageTitle, Button, Badge, Loading, Empty } from "@/components/ui";
import type { Transaction, Member } from "@/types";

type Row = Transaction & { members: { name: string } | null };

export default function TransactionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("");
  const [methodF, setMethodF] = useState("");

  const [form, setForm] = useState({
    memberName: "",
    amount: "",
    type: "הפקדה",
    method: "",
    heb_date: "",
    notes: "",
  });

  async function load() {
    const [t, m] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, members(name)")
        .order("created_at", { ascending: false }),
      supabase.from("members").select("*").order("name"),
    ]);
    setRows((t.data as Row[]) || []);
    setMembers((m.data as Member[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeF && r.type !== typeF) return false;
      if (methodF && r.method !== methodF) return false;
      if (q.trim()) {
        const s = q.trim();
        const hay = `${r.members?.name || ""} ${r.notes || ""} ${r.heb_date || ""}`;
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, q, typeF, methodF]);

  const totals = useMemo(() => {
    let dep = 0,
      wit = 0;
    filtered.forEach((r) => (r.type === "הפקדה" ? (dep += r.amount) : (wit += r.amount)));
    return { dep, wit, net: dep - wit };
  }, [filtered]);

  async function addTxn() {
    const member = members.find((m) => m.name === form.memberName.trim());
    if (!member) {
      alert("יש לבחור חבר קיים מהרשימה");
      return;
    }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      alert("יש להזין סכום חיובי");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      member_id: member.id,
      amount: amt,
      type: form.type,
      method: form.method || null,
      heb_date: form.heb_date || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) {
      alert("שגיאה: " + error.message);
      return;
    }
    setForm({ memberName: "", amount: "", type: "הפקדה", method: "", heb_date: "", notes: "" });
    setAdding(false);
    load();
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle
        action={
          <Button onClick={() => setAdding((v) => !v)}>
            {adding ? "ביטול" : "+ פעולה חדשה"}
          </Button>
        }
      >
        פעולות ({filtered.length})
      </PageTitle>

      {adding && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={lbl}>חבר</label>
              <input
                list="members-list"
                value={form.memberName}
                onChange={(e) => setForm({ ...form, memberName: e.target.value })}
                style={{ ...inp, width: 200 }}
                placeholder="הקלד שם…"
              />
              <datalist id="members-list">
                {members.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
            </div>
            <Sel label="סוג" value={form.type} options={[...TXN_TYPES]} onChange={(v) => setForm({ ...form, type: v })} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={lbl}>סכום ₪</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                style={{ ...inp, width: 110 }}
              />
            </div>
            <Sel label="אופן" value={form.method} options={["", ...TXN_METHODS]} onChange={(v) => setForm({ ...form, method: v })} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={lbl}>תאריך עברי</label>
              <input value={form.heb_date} onChange={(e) => setForm({ ...form, heb_date: e.target.value })} style={{ ...inp, width: 130 }} placeholder="כ&quot;ה ניסן תשפ&quot;ו" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={lbl}>הערות</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inp, width: 180 }} />
            </div>
            <Button onClick={addTxn} disabled={saving}>{saving ? "שומר…" : "שמירה"}</Button>
          </div>
        </Card>
      )}

      {/* סינון */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="🔍 חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inp, flex: 1, minWidth: 180 }} />
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={inp}>
            <option value="">כל הסוגים</option>
            {TXN_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={methodF} onChange={(e) => setMethodF(e.target.value)} style={inp}>
            <option value="">כל האופנים</option>
            {TXN_METHODS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: ".9rem" }}>
          <span>הפקדות: <strong style={{ color: "#1e7d4f" }}>{ils(totals.dep)}</strong></span>
          <span>משיכות: <strong style={{ color: "#c0392b" }}>{ils(totals.wit)}</strong></span>
          <span>נטו: <strong style={{ color: "var(--brand)" }}>{ils(totals.net)}</strong></span>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <Empty text="לא נמצאו פעולות" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>חבר</th>
                  <th>סוג</th>
                  <th>סכום</th>
                  <th>אופן</th>
                  <th>תאריך</th>
                  <th>הערות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.members?.name || "—"}</td>
                    <td><Badge type={r.type} /></td>
                    <td style={{ fontWeight: 600, color: r.type === "משיכה" ? "#c0392b" : "#1e7d4f" }}>
                      {r.type === "משיכה" ? "-" : "+"}{ils(r.amount)}
                    </td>
                    <td>{r.method || "—"}</td>
                    <td>{r.heb_date || gdate(r.greg_date) || "—"}</td>
                    <td style={{ color: "#7a8699" }}>{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "0.5rem 0.7rem",
  border: "1px solid #d8dde5",
  borderRadius: 8,
  fontSize: ".9rem",
};
const lbl: React.CSSProperties = { fontSize: ".8rem", color: "#7a8699" };

function Sel({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={lbl}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inp}>
        {options.map((o) => (
          <option key={o} value={o}>{o || "—"}</option>
        ))}
      </select>
    </div>
  );
}
