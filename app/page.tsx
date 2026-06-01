"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/lib/supabase";
import { ils, num, gdate, toHebrewDate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { Badge, Loading } from "@/components/ui";
import type { FundSummary, Transaction, MemberBalance, Member } from "@/types";
import { useAuth } from "@/components/AuthGuard";
import { Users, ArrowDownCircle, ArrowUpCircle, Wallet, UserPlus, CreditCard, BarChart3, CheckCircle2 } from "lucide-react";

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

/* ---------- מודאל ופופ-אפ הצלחה ---------- */

const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" };
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 500, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" };
const modalTitle: React.CSSProperties = { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: BRAND };
const closeBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" };
const inp: React.CSSProperties = { padding: "0.5rem 0.75rem", border: "1.5px solid #d8dde5", borderRadius: 8, fontSize: ".9rem", width: "100%", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };
const saveBtnStyle: React.CSSProperties = { padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: ".9rem", cursor: "pointer" };
const ghostBtnStyle: React.CSSProperties = { padding: "0.55rem 1.2rem", background: "#eef2f1", color: BRAND, border: "none", borderRadius: 8, fontWeight: 600, fontSize: ".9rem", cursor: "pointer" };

function Req() { return <span style={{ color: RED, marginRight: 2 }}>*</span>; }
function Err({ children }: { children: string }) {
  return <div style={{ fontSize: ".75rem", color: RED, marginTop: 3 }}>{children}</div>;
}

type Toast = { title: string; lines: [string, string][] };

function MemberCombobox({ members, value, onChange }: {
  members: Member[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => members.filter(m => m.name.includes(q.trim())).slice(0, 30), [members, q]);
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  function select(name: string) { setQ(name); onChange(name); setOpen(false); }
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={q} onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} style={inp} placeholder="הקלד שם חבר…" autoComplete="off" autoFocus />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0, background: "#fff", border: "1.5px solid #d8dde5", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
          {filtered.map(m => (
            <div key={m.id} onMouseDown={() => select(m.name)}
              style={{ padding: "0.55rem 0.85rem", cursor: "pointer", fontSize: ".9rem", borderBottom: "1px solid #f0f2f5" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f4faf8")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              {m.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [top, setTop] = useState<MemberBalance[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [addTxn, setAddTxn] = useState(false);
  const [addMember, setAddMember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [txnForm, setTxnForm] = useState({ memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  const [memberForm, setMemberForm] = useState({ name: "", code: "", phone: "", address: "" });
  const [formErr, setFormErr] = useState<Record<string, string>>({});

  async function load() {
    const [s, r, t, m] = await Promise.all([
      supabase.from("fund_summary").select("*").single(),
      supabase.from("transactions").select("*, members(name)").order("created_at", { ascending: false }).limit(10),
      supabase.from("member_balances").select("*").order("balance", { ascending: false }).limit(6),
      supabase.from("members").select("*").order("name"),
    ]);
    setSummary(s.data as FundSummary);
    setRecent((r.data as Recent[]) || []);
    setTop((t.data as MemberBalance[]) || []);
    setMembers((m.data as Member[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // הצגת פופ-אפ הצלחה שנעלם באיטיות
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2300);
    return () => clearTimeout(id);
  }, [toast]);

  function closeTxn() {
    setAddTxn(false); setFormErr({});
    setTxnForm({ memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  }
  function closeMember() {
    setAddMember(false); setFormErr({});
    setMemberForm({ name: "", code: "", phone: "", address: "" });
  }
  function setTxnGregDate(val: string) {
    setTxnForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) }));
  }
  function setMemberPhone(val: string) {
    const digits = val.replace(/\D/g, "");
    if (digits.length > 10) return;
    const code = digits.length === 10 ? digits.slice(-4) : "";
    setMemberForm(f => ({ ...f, phone: val, code }));
  }

  async function saveTxn() {
    const errs: Record<string, string> = {};
    const member = members.find(m => m.name === txnForm.memberName.trim());
    if (!member) errs.member = "יש לבחור חבר קיים";
    const amt = Number(txnForm.amount);
    if (!amt || amt <= 0) errs.amount = "יש להזין סכום חיובי";
    if (!txnForm.method) errs.method = "שדה חובה";
    if (!txnForm.greg_date) errs.date = "יש לבחור תאריך";
    setFormErr(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      member_id: member!.id, amount: amt, type: txnForm.type,
      method: txnForm.method || null, greg_date: txnForm.greg_date || null,
      heb_date: txnForm.heb_date || null, notes: txnForm.notes || null,
    });
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    const t: Toast = {
      title: "הפעולה נשמרה בהצלחה",
      lines: [
        ["חבר", member!.name],
        ["סוג", txnForm.type],
        ["סכום", ils(amt)],
        ["אופן", txnForm.method],
        ["תאריך", txnForm.heb_date || gdate(txnForm.greg_date)],
        ...(txnForm.notes ? [["הערות", txnForm.notes] as [string, string]] : []),
      ],
    };
    closeTxn();
    setToast(t);
    load();
  }

  async function saveMember() {
    const errs: Record<string, string> = {};
    if (!memberForm.name.trim()) errs.name = "יש להזין שם";
    if (!memberForm.phone.trim()) errs.phone = "יש להזין טלפון";
    setFormErr(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    const code = memberForm.phone.replace(/\D/g, "").slice(-4);
    const { error } = await supabase.from("members").insert({
      name: memberForm.name.trim(),
      code: code || memberForm.code.trim() || null,
      phone: memberForm.phone.trim() || null,
      address: memberForm.address.trim() || null,
    });
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    const t: Toast = {
      title: "החבר נוסף בהצלחה",
      lines: [
        ["שם", memberForm.name.trim()],
        ["קוד", code || "—"],
        ["טלפון", memberForm.phone.trim()],
        ...(memberForm.address ? [["כתובת", memberForm.address.trim()] as [string, string]] : []),
      ],
    };
    closeMember();
    setToast(t);
    load();
  }

  const [now, setNow] = useState(new Date());
  const [parasha, setParasha] = useState("");
  const [holidays, setHolidays] = useState<string[]>([]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("https://www.hebcal.com/shabbat?cfg=json&geo=il&m=50&lg=he&M=on")
      .then(r => r.json())
      .then(data => {
        const items: any[] = data.items || [];
        const p = items.find(i => i.category === "parashat");
        if (p) setParasha(p.hebrew || p.title || "");
      }).catch(() => {});

    const d = new Date();
    fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&year=${d.getFullYear()}&month=${d.getMonth() + 1}&ss=off&mf=off&c=off&geo=none&leyning=off&b=18&lg=he`)
      .then(r => r.json())
      .then(data => {
        const todayStr = d.toISOString().split("T")[0];
        const hols = (data.items || [])
          .filter((i: any) => i.date === todayStr)
          .map((i: any) => i.hebrew || i.title);
        setHolidays(hols);
      }).catch(() => {});
  }, []);

  if (loading) return <Loading />;

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const dayOfWeek = now.toLocaleDateString("he-IL", { weekday: "long" });
  // תאריך עברי באותיות גימטריה (ט״ז בסיון תשפ״ו)
  let hebDate = "";
  try {
    hebDate = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      day: "numeric", month: "long", year: "numeric", numberingSystem: "hebr",
    }).format(now);
  } catch { hebDate = toHebrewDate(now.toISOString().split("T")[0]); }
  const gregDate = now.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

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
          שלום{name ? `, ${name}` : ""}
        </h1>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem 0.7rem", marginTop: 8, fontSize: ".95rem" }}>
          <span style={{ fontWeight: 800, color: "#2c3e50" }}>{dayOfWeek}</span>
          <span style={{ color: "#cbd5e0" }}>•</span>
          <span style={{ fontWeight: 600, color: BRAND }}>{hebDate}</span>
          <span style={{ color: "#cbd5e0" }}>•</span>
          <span style={{ color: "#9aa5b5" }}>{gregDate}</span>
          <span style={{ color: "#cbd5e0" }}>•</span>
          <span style={{ color: "#4a5568", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, monospace", letterSpacing: ".5px" }} dir="ltr">{timeStr}</span>
          {parasha && (
            <>
              <span style={{ color: "#cbd5e0" }}>•</span>
              <span style={{ fontWeight: 700, color: BRAND }}>פרשת {parasha.replace(/^פרשת\s*/, "")}</span>
            </>
          )}
          {holidays.map(h => (
            <span key={h}>
              <span style={{ color: "#cbd5e0", marginInlineEnd: "0.7rem" }}>•</span>
              <span style={{ fontWeight: 700, color: "#b7791f" }}>{h}</span>
            </span>
          ))}
        </div>
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
              <ShortcutBtn icon={<UserPlus size={17} />} label="הוספת חבר" color={BRAND} onClick={() => { setFormErr({}); setAddMember(true); }} />
              <ShortcutBtn icon={<CreditCard size={17} />} label="פעולה חדשה" color="#3b82f6" onClick={() => { setFormErr({}); setAddTxn(true); }} />
              <Link href="/reports" style={{ textDecoration: "none" }}>
                <ShortcutInner icon={<BarChart3 size={17} />} label="דוחות" color="#8b5cf6" />
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* ===== מודאל פעולה חדשה ===== */}
      {addTxn && (
        <div onClick={e => { if (e.target === e.currentTarget) closeTxn(); }} style={overlay}>
          <div style={modalBox}>
            <div style={modalHeader}>
              <h2 style={modalTitle}>+ פעולה חדשה</h2>
              <button onClick={closeTxn} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>חבר <Req /></label>
                <MemberCombobox members={members} value={txnForm.memberName} onChange={v => setTxnForm(f => ({ ...f, memberName: v }))} />
                {formErr.member && <Err>{formErr.member}</Err>}
              </div>
              <div>
                <label style={lbl}>סוג <Req /></label>
                <select value={txnForm.type} onChange={e => setTxnForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪ <Req /></label>
                <input type="number" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ ...inp, borderColor: formErr.amount ? RED : undefined }} placeholder="0" />
                {formErr.amount && <Err>{formErr.amount}</Err>}
              </div>
              <div>
                <label style={lbl}>אופן <Req /></label>
                <select value={txnForm.method} onChange={e => setTxnForm(f => ({ ...f, method: e.target.value }))}
                  style={{ ...inp, borderColor: formErr.method ? RED : undefined }}>
                  <option value="">— בחר —</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
                {formErr.method && <Err>{formErr.method}</Err>}
              </div>
              <div>
                <label style={lbl}>תאריך <Req /></label>
                <input type="date" value={txnForm.greg_date} onChange={e => setTxnGregDate(e.target.value)}
                  style={{ ...inp, borderColor: formErr.date ? RED : undefined }} />
                {formErr.date && <Err>{formErr.date}</Err>}
              </div>
              {txnForm.heb_date && (
                <div style={{ gridColumn: "1/-1", marginTop: -4, fontSize: ".82rem", color: BRAND, fontWeight: 600 }}>
                  תאריך עברי: {txnForm.heb_date}
                </div>
              )}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={txnForm.notes} onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))}
                  style={inp} placeholder="אופציונלי…" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={saveTxn} disabled={saving} style={saveBtnStyle}>{saving ? "שומר…" : "✓ שמור פעולה"}</button>
              <button onClick={closeTxn} style={ghostBtnStyle}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודאל חבר חדש ===== */}
      {addMember && (
        <div onClick={e => { if (e.target === e.currentTarget) closeMember(); }} style={overlay}>
          <div style={modalBox}>
            <div style={modalHeader}>
              <h2 style={modalTitle}>👤 חבר חדש</h2>
              <button onClick={closeMember} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>שם ומשפחה <Req /></label>
                <input value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))}
                  style={{ ...inp, borderColor: formErr.name ? RED : undefined }} placeholder="ישראל ישראלי" autoFocus />
                {formErr.name && <Err>{formErr.name}</Err>}
              </div>
              <div>
                <label style={lbl}>קוד</label>
                <input value={memberForm.code} onChange={e => setMemberForm(f => ({ ...f, code: e.target.value }))}
                  style={inp} placeholder="1234" />
              </div>
              <div>
                <label style={lbl}>טלפון <Req /></label>
                <input value={memberForm.phone} onChange={e => setMemberPhone(e.target.value)}
                  style={{ ...inp, borderColor: formErr.phone ? RED : undefined }} placeholder="050-0000000" dir="ltr" />
                {memberForm.code && <div style={{ fontSize: ".75rem", color: BRAND, marginTop: 4 }}>קוד: {memberForm.code}</div>}
                {formErr.phone && <Err>{formErr.phone}</Err>}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>כתובת</label>
                <input value={memberForm.address} onChange={e => setMemberForm(f => ({ ...f, address: e.target.value }))}
                  style={inp} placeholder="רחוב, עיר" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={saveMember} disabled={saving} style={saveBtnStyle}>{saving ? "שומר…" : "✓ הוסף חבר"}</button>
              <button onClick={closeMember} style={ghostBtnStyle}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== פופ-אפ הצלחה ===== */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 1200,
          background: "#fff", borderRadius: 14, padding: "1rem 1.25rem",
          boxShadow: "0 12px 40px rgba(0,0,0,.18)", borderRight: `4px solid ${BRAND}`,
          minWidth: 280, maxWidth: 360, direction: "rtl",
          animation: "toastIn .25s ease, toastOut .5s ease 1.8s forwards",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <CheckCircle2 size={22} color={BRAND} />
            <strong style={{ fontSize: ".98rem", color: "#1a1a2e" }}>{toast.title}</strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.3rem 0.75rem", fontSize: ".84rem" }}>
            {toast.lines.map(([l, v]) => (
              <div key={l} style={{ display: "contents" }}>
                <span style={{ color: "#9aa5b5" }}>{l}</span>
                <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutInner({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "0.55rem 0.85rem", background: `${color}10`, borderRadius: 8,
      color, fontWeight: 600, fontSize: ".85rem", border: `1px solid ${color}20`,
      cursor: "pointer",
    }}>
      {icon}{label}
    </div>
  );
}

function ShortcutBtn({ icon, label, color, onClick }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{ all: "unset", display: "block" }}>
      <ShortcutInner icon={icon} label={label} color={color} />
    </button>
  );
}
