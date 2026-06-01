"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ils } from "@/lib/format";
import { Card, PageTitle, Button, Loading, Empty } from "@/components/ui";
import type { MemberBalance } from "@/types";

export default function MembersPage() {
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("member_balances")
      .select("*")
      .order("name");
    setMembers((data as MemberBalance[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return members;
    return members.filter(
      (m) =>
        (m.name || "").includes(s) ||
        (m.code || "").includes(s) ||
        (m.phone || "").includes(s) ||
        (m.address || "").includes(s)
    );
  }, [q, members]);

  async function addMember() {
    if (!form.name.trim()) {
      alert("יש להזין שם");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("members").insert({
      name: form.name.trim(),
      code: form.code.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    });
    setSaving(false);
    if (error) {
      alert("שגיאה: " + error.message);
      return;
    }
    setForm({ name: "", code: "", phone: "", address: "" });
    setAdding(false);
    load();
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle
        action={
          <Button onClick={() => setAdding((v) => !v)}>
            {adding ? "ביטול" : "+ חבר חדש"}
          </Button>
        }
      >
        חברים ({filtered.length})
      </PageTitle>

      {adding && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <Field label="שם ומשפחה" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="קוד" value={form.code} onChange={(v) => setForm({ ...form, code: v })} w={90} />
            <Field label="טלפון" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="כתובת" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Button onClick={addMember} disabled={saving}>
              {saving ? "שומר…" : "שמירה"}
            </Button>
          </div>
        </Card>
      )}

      <Card style={{ padding: 0 }}>
        <div style={{ padding: 12 }}>
          <input
            placeholder="🔍 חיפוש לפי שם / קוד / טלפון / כתובת…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={inputStyle}
          />
        </div>
        {filtered.length === 0 ? (
          <Empty text="לא נמצאו חברים" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>שם ומשפחה</th>
                  <th>קוד</th>
                  <th>טלפון</th>
                  <th>כתובת</th>
                  <th>פעולות</th>
                  <th>יתרה</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/members/${m.id}`} style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>
                        {m.name || "—"}
                      </Link>
                    </td>
                    <td>{m.code}</td>
                    <td dir="ltr" style={{ textAlign: "right" }}>{m.phone}</td>
                    <td style={{ color: "#7a8699" }}>{m.address}</td>
                    <td>{m.txn_count}</td>
                    <td style={{ fontWeight: 700, color: m.balance >= 0 ? "var(--brand)" : "#c0392b" }}>
                      {ils(m.balance)}
                    </td>
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  border: "1px solid #d8dde5",
  borderRadius: 8,
  fontSize: ".9rem",
};

function Field({
  label,
  value,
  onChange,
  w = 150,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  w?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: ".8rem", color: "#7a8699" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: w }}
      />
    </div>
  );
}
