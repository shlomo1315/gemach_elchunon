"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/lib/supabase";
import { ils, num, gdate, toHebrewDate, hebrewDateLetters, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { hebTextToGregDisplay } from "@/lib/hebrewParse";
import { Badge, Loading, SuccessPopup } from "@/components/ui";
import type { FundSummary, Transaction, MemberBalance, Member, ChangeRequest, MemberRequest } from "@/types";
import { useAuth } from "@/components/AuthGuard";
import HebrewInfoBar from "@/components/HebrewInfoBar";
import DatePicker from "@/components/DatePicker";
import { Users, ArrowDownCircle, ArrowUpCircle, Wallet, UserPlus, CreditCard, BarChart3, Clock, Bell } from "lucide-react";

type Recent = Transaction & { members: { name: string } | null };

const BRAND = "#107a5e";
const RED = "#e05252";

const PERIOD_LABEL = { day: "היום", week: "השבוע", month: "החודש", year: "השנה" } as const;
const PERIOD_TAB = { day: "יום", week: "שבוע", month: "חודש", year: "שנה" } as const;

function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="ui-card-hover" style={{
      position: "relative", overflow: "hidden",
      background: "#fff", borderRadius: "var(--r-lg)", padding: "1.25rem 1.4rem",
      boxShadow: "var(--shadow)", flex: "1 1 160px",
      border: "1px solid var(--line)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ position: "absolute", insetInline: 0, top: 0, height: 4, background: `linear-gradient(90deg, ${color}, ${color}2e)` }} />
      <div style={{ position: "absolute", insetInlineEnd: -28, top: -28, width: 104, height: 104, borderRadius: "50%", background: `${color}10`, pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div style={{ fontSize: ".79rem", color: "var(--muted)", fontWeight: 700 }}>{label}</div>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${color}20, ${color}10)`, color, boxShadow: `inset 0 0 0 1px ${color}22` }}>{icon}</span>
      </div>
      <div style={{ fontSize: "1.7rem", fontWeight: 800, color, lineHeight: 1.05, fontVariantNumeric: "tabular-nums", position: "relative" }}>{value}</div>
      {sub && <div style={{ fontSize: ".73rem", color: "var(--faint)", position: "relative" }}>{sub}</div>}
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
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: 18, boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 500, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" };
const modalTitle: React.CSSProperties = { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: BRAND };
const closeBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" };
const inp: React.CSSProperties = { padding: "0.6rem 0.8rem", border: "1.5px solid #dce1e8", borderRadius: 10, fontSize: ".9rem", width: "100%", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };

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
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0, background: "#fff", border: "1.5px solid #dce1e8", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
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
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [allTxns, setAllTxns] = useState<{ amount: number; type: string; greg_date: string | null; heb_date: string | null; created_at: string }[]>([]);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("day");
  const [loading, setLoading] = useState(true);

  const [addTxn, setAddTxn] = useState(false);
  const [addMember, setAddMember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [txnForm, setTxnForm] = useState({ memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", subtype: "" });
  const [memberForm, setMemberForm] = useState({ name: "", code: "", phone: "", address: "" });
  const [formErr, setFormErr] = useState<Record<string, string>>({});

  // החבר הנבחר בטופס הפעולה — לזיהוי יתרת חיסכון בעת משיכה
  const selTxnMember = useMemo(() => members.find(m => m.name === txnForm.memberName.trim()) || null, [members, txnForm.memberName]);
  const selTxnSavings = selTxnMember?.savings_balance ?? 0;

  const [pendingChanges, setPendingChanges] = useState(0);
  const [openRequests, setOpenRequests] = useState(0);
  const [dueChecks, setDueChecks] = useState<any[]>([]);
  // חלונית התראות בכניסה למערכת (בקשות ופניות ממתינות)
  const [pendingList, setPendingList] = useState<ChangeRequest[]>([]);
  const [requestsList, setRequestsList] = useState<MemberRequest[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  async function load() {
    const [s, r, t, m, a, pc, or, ck] = await Promise.all([
      supabase.from("fund_summary").select("*").single(),
      supabase.from("transactions").select("*, members(name)").order("created_at", { ascending: false }).limit(10),
      supabase.from("member_balances").select("*").order("balance", { ascending: false }).limit(6),
      supabase.from("member_balances").select("*").order("name"),
      supabase.from("transactions").select("amount,type,greg_date,heb_date,created_at").limit(50000),
      supabase.from("transaction_change_requests").select("*, members(name)").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("member_requests").select("*, members(name)").eq("status", "open").order("created_at", { ascending: false }),
      supabase.from("checks").select("*, members(name)").eq("status", "pending").order("due_date", { ascending: true }).limit(200),
    ]);
    setSummary(s.data as FundSummary);
    setRecent((r.data as Recent[]) || []);
    setTop((t.data as MemberBalance[]) || []);
    setMembers((m.data as MemberBalance[]) || []);
    setAllTxns((a.data as any[]) || []);
    const pcList = (pc.data as ChangeRequest[]) || [];
    const orList = (or.data as MemberRequest[]) || [];
    setPendingList(pcList);
    setRequestsList(orList);
    setPendingChanges(pcList.length);
    setOpenRequests(orList.length);
    const ckList = (ck.data as any[]) || [];
    setDueChecks(ckList);
    setLoading(false);
    // שיקים לפרעון תוך 3 ימים (לצורך טריגר ההתראות)
    const soonLimit = new Date(); soonLimit.setHours(23, 59, 59, 999); soonLimit.setDate(soonLimit.getDate() + 3);
    const dueSoonCount = ckList.filter(c => c.due_date && new Date(c.due_date) <= soonLimit).length;
    // הצגת חלונית ההתראות פעם אחת בכל כניסה למערכת (לפי session)
    if (pcList.length + orList.length + dueSoonCount > 0 && typeof window !== "undefined" && !sessionStorage.getItem("notif_seen")) {
      setNotifOpen(true);
      sessionStorage.setItem("notif_seen", "1");
    }
  }

  // שיקים לפרעון תוך 3 ימים הקרובים (כולל כאלה שכבר הגיע מועדם)
  const checksDueSoon = useMemo(() => {
    const limit = new Date(); limit.setHours(23, 59, 59, 999); limit.setDate(limit.getDate() + 3);
    return dueChecks.filter(c => c.due_date && new Date(c.due_date) <= limit);
  }, [dueChecks]);
  const checksDueSoonSum = useMemo(() => checksDueSoon.reduce((s, c) => s + (Number(c.amount) || 0), 0), [checksDueSoon]);

  // סטטיסטיקות לפי התקופה הנבחרת (יום/שבוע/חודש/שנה)
  const periodStats = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    if (period === "week") start.setDate(start.getDate() - start.getDay());
    else if (period === "month") start.setDate(1);
    else if (period === "year") { start.setMonth(0, 1); }
    const startMs = start.getTime();
    let depCount = 0, depSum = 0, wdCount = 0, wdSum = 0;
    for (const t of allTxns) {
      // נספר לפי מועד הרישום במערכת — כך כל פעולה שמוזנת מופיעה מיד בתקופה הנוכחית
      const dt = new Date(t.created_at).getTime();
      if (isNaN(dt) || dt < startMs) continue;
      if (t.type === "משיכה") { wdCount++; wdSum += Number(t.amount) || 0; }
      else { depCount++; depSum += Number(t.amount) || 0; }
    }
    return { depCount, depSum, wdCount, wdSum, net: depSum - wdSum };
  }, [allTxns, period]);
  useEffect(() => { load(); }, []);

  // הצגת פופ-אפ הצלחה שנעלם באיטיות
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2300);
    return () => clearTimeout(id);
  }, [toast]);

  function closeTxn() {
    setAddTxn(false); setFormErr({});
    setTxnForm({ memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", subtype: "" });
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

    // סיווג: משיכה = הלוואה/החזר פיקדון (לפי בחירה), הפקדה = פיקדון
    const savings = member?.savings_balance ?? 0;
    const effectiveSubtype = txnForm.subtype || (savings > 0 ? "refund" : "loan");
    const category = txnForm.type === "משיכה" ? effectiveSubtype : "deposit";

    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      member_id: member!.id, amount: amt, type: txnForm.type,
      method: txnForm.method || null, greg_date: txnForm.greg_date || null,
      heb_date: txnForm.heb_date || null, notes: txnForm.notes || null, category,
    });
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    const t: Toast = {
      title: "הפעולה נשמרה בהצלחה",
      lines: [
        ["חבר", member!.name],
        ["סוג", txnForm.type === "משיכה" ? `משיכה · ${effectiveSubtype === "refund" ? "החזר פיקדון" : "הלוואה"}` : txnForm.type],
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

  if (loading) return <Loading />;

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  const pieData = [
    { name: "הפקדות", value: summary?.total_deposits || 0 },
    { name: "משיכות", value: summary?.total_withdrawals || 0 },
  ];
  const pct = summary?.total_deposits
    ? Math.round(((summary.total_deposits - (summary.total_withdrawals || 0)) / summary.total_deposits) * 100)
    : 0;

  return (
    <div style={{ direction: "rtl" }}>
      {/* ===== Hero — באנר פתיחה ===== */}
      <div className="keep-color" style={{
        position: "relative", overflow: "hidden",
        borderRadius: "var(--r-xl)", background: "var(--grad-brand-deep)",
        color: "#fff", padding: "1.6rem 1.85rem", marginBottom: "1.25rem",
        boxShadow: "var(--shadow-brand)",
      }}>
        {/* זוהר זהב + אור עדין */}
        <div style={{ position: "absolute", top: -90, insetInlineStart: -50, width: 270, height: 270, borderRadius: "50%", background: "radial-gradient(circle, rgba(199,154,62,.30), transparent 66%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -100, insetInlineEnd: "32%", width: 230, height: 230, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.10), transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div className="display" style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.12 }}>
              שלום{name ? `, ${name}` : ""}
            </div>
            <div style={{ fontSize: ".95rem", opacity: .82, marginTop: 7, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 24, height: 2, background: "var(--gold)", borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
              ברוך בואך למערכת הניהול
            </div>
          </div>
          {/* יתרה ראשית */}
          <div style={{
            textAlign: "center", background: "rgba(255,255,255,.1)",
            border: "1px solid rgba(255,255,255,.18)", borderRadius: "var(--r-lg)",
            padding: "0.9rem 1.7rem", minWidth: 190,
          }}>
            <div style={{ fontSize: ".77rem", opacity: .85, fontWeight: 600, marginBottom: 5, letterSpacing: ".03em" }}>יתרה בקופה</div>
            <div style={{ fontSize: "2.05rem", fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{ils(summary?.total_balance)}</div>
            <div style={{ fontSize: ".76rem", opacity: .82, marginTop: 6 }}>{num(summary?.members_count)} חברים פעילים</div>
          </div>
        </div>
      </div>

      {/* שורת מידע יומי משותפת */}
      <div style={{ marginBottom: "1.5rem" }}>
        <HebrewInfoBar />
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

      {/* ממתינים לאישור מנהל */}
      {(pendingChanges > 0 || openRequests > 0) && (
        <Link href="/requests" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "linear-gradient(135deg,#fff7ed,#fffbeb)", border: "1px solid #fcd9a8", borderRadius: 16, padding: "1rem 1.25rem", marginBottom: 20, cursor: "pointer" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "#f59e0b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 800, color: "#1a1a2e" }}>ממתינים לאישור מנהל</div>
              <div style={{ fontSize: ".85rem", color: "#92741f" }}>
                {pendingChanges > 0 && <span>{pendingChanges} בקשות פעולה</span>}
                {pendingChanges > 0 && openRequests > 0 && <span> · </span>}
                {openRequests > 0 && <span>{openRequests} פניות חדשות</span>}
              </div>
            </div>
            <span style={{ background: "#f59e0b", color: "#fff", borderRadius: 999, padding: "0.3rem 1rem", fontWeight: 800, fontSize: ".9rem" }}>
              {pendingChanges + openRequests} →
            </span>
          </div>
        </Link>
      )}

      {/* פרעון שיקים — לפרעון תוך 3 ימים (לחיצה פותחת את כרטיס החבר לסימון פדיון) */}
      {checksDueSoon.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#fef2f2,#fff7ed)", border: "1px solid #f5c2a8", borderRadius: 16, padding: "1rem 1.25rem", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.2rem" }}>🔔</span>
            <div style={{ fontWeight: 800, color: "#1a1a2e" }}>פרעון שיקים — תוך 3 ימים ({checksDueSoon.length})</div>
            <span style={{ fontSize: ".82rem", color: "#b45309" }}>· סה״כ {ils(checksDueSoonSum)} — לחיצה פותחת את כרטיס החבר לסימון פדיון</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {checksDueSoon.slice(0, 10).map(c => {
              const overdue = c.due_date && new Date(c.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <Link key={c.id} href={`/members/${c.member_id}`} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "0.5rem 0.85rem", fontSize: ".86rem" }}>
                    <span style={{ color: "#1a1a2e", fontWeight: 600 }}>{c.members?.name || "—"}</span>
                    <span style={{ color: overdue ? "#c0392b" : "#7a8699" }}>{c.due_date ? gdate(c.due_date) : ""}{overdue ? " · באיחור" : ""}</span>
                    <span style={{ fontWeight: 800, color: "#c0392b" }}>{ils(c.amount)}</span>
                  </div>
                </Link>
              );
            })}
            {checksDueSoon.length > 10 && <div style={{ fontSize: ".8rem", color: "#b45309" }}>ועוד {checksDueSoon.length - 10}…</div>}
          </div>
        </div>
      )}

      {/* פעילות לפי תקופה */}
      <div style={{ background: "#fff", borderRadius: "var(--r-lg)", border: "1px solid var(--line)", boxShadow: "var(--shadow)", padding: "1.1rem 1.25rem", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h3 className="display" style={{ margin: 0, fontSize: "1.08rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} color={BRAND} /> פעילות {PERIOD_LABEL[period]}
          </h3>
          <div style={{ display: "inline-flex", background: "#f0f4f3", borderRadius: 999, padding: 3, gap: 2 }}>
            {(["day", "week", "month", "year"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  border: "none", cursor: "pointer", padding: "0.4rem 1rem", borderRadius: 999,
                  fontSize: ".84rem", fontWeight: 700, transition: "all .15s",
                  background: period === p ? "var(--grad-brand)" : "transparent",
                  color: period === p ? "#fff" : "#7a8699",
                  boxShadow: period === p ? "0 3px 10px rgba(16,122,94,.32)" : "none",
                }}>
                {PERIOD_TAB[p]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <KpiCard label={`הפקדות ${PERIOD_LABEL[period]}`} value={num(periodStats.depCount)} icon={<ArrowDownCircle size={20} />} color="#16a085"
            sub={ils(periodStats.depSum)} />
          <KpiCard label={`משיכות ${PERIOD_LABEL[period]}`} value={num(periodStats.wdCount)} icon={<ArrowUpCircle size={20} />} color={RED}
            sub={ils(periodStats.wdSum)} />
          <KpiCard label={`תנועה נטו ${PERIOD_LABEL[period]}`} value={ils(periodStats.net)} icon={<Wallet size={20} />} color={periodStats.net >= 0 ? BRAND : RED}
            sub={`${num(periodStats.depCount + periodStats.wdCount)} פעולות בסך הכל`} />
        </div>
      </div>

      {/* גריד ראשי */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>

        {/* פעולות אחרונות */}
        <div style={{ background: "#fff", borderRadius: "var(--r-lg)", border: "1px solid var(--line)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--line-soft)" }}>
            <h3 className="display" style={{ margin: 0, fontSize: "1.08rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}><span className="section-bar" />פעולות אחרונות</h3>
            <Link href="/transactions" style={{ fontSize: ".78rem", color: BRAND, fontWeight: 600, textDecoration: "none" }}>
              כל הפעולות ←
            </Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#9aa5b5" }}>אין פעולות עדיין</div>
          ) : (
            recent.map((t, i) => (
              <Link key={t.id} href={`/members/${t.member_id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "0.75rem 1.25rem",
                borderBottom: i < recent.length - 1 ? "1px solid #f8fafc" : "none",
                transition: "background .1s", cursor: "pointer",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fbf9")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <Avatar name={t.members?.name || "?"} />
                {/* שם + הערה */}
                <div style={{ width: 200, minWidth: 0, flexShrink: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: ".88rem", color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.members?.name || "—"}</div>
                  {t.notes && <div style={{ fontSize: ".74rem", color: "#9aa5b5", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes}</div>}
                </div>
                {/* תאריך באמצע — עברי (גימטריה) + לועזי אוטומטי */}
                <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
                  {(() => {
                    // אם התאריך העברי שמור בספרות — נציג גימטריה מהתאריך הלועזי; אחרת הטקסט המקורי
                    const heb = t.heb_date && !/\d/.test(t.heb_date)
                      ? t.heb_date
                      : (t.greg_date ? hebrewDateLetters(new Date(t.greg_date + "T12:00:00")) : (t.heb_date || "—"));
                    const g = gdate(t.greg_date) || hebTextToGregDisplay(t.heb_date);
                    return (
                      <>
                        <div style={{ fontSize: ".8rem", color: "#4a5568", fontWeight: 600 }}>{heb}</div>
                        {g && <div style={{ fontSize: ".7rem", color: "#b0bac7", marginTop: 1 }} dir="ltr">{g}</div>}
                      </>
                    );
                  })()}
                </div>
                <Badge type={t.type} />
                <div style={{ fontWeight: 700, fontSize: ".92rem", color: t.type === "משיכה" ? RED : BRAND, minWidth: 84, textAlign: "left", flexShrink: 0 }}>
                  {t.type === "משיכה" ? "−" : "+"}{ils(t.amount)}
                </div>
              </div>
              </Link>
            ))
          )}
        </div>

        {/* עמודה ימנית */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* פאי */}
          <div className="hover-lift" style={{ background: "#fff", borderRadius: "var(--r-lg)", border: "1px solid var(--line)", padding: "1.1rem 1.25rem", boxShadow: "var(--shadow)" }}>
            <h3 className="display" style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}><span className="section-bar" />הפקדות מול משיכות</h3>
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
          <div className="hover-lift" style={{ background: "#fff", borderRadius: "var(--r-lg)", border: "1px solid var(--line)", padding: "1.1rem 1.25rem", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 className="display" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}><span className="section-bar" />יתרות מובילות</h3>
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
          <div className="hover-lift" style={{ background: "#fff", borderRadius: "var(--r-lg)", border: "1px solid var(--line)", padding: "1.1rem 1.25rem", boxShadow: "var(--shadow)" }}>
            <h3 className="display" style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}><span className="section-bar" />קיצורי דרך</h3>
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
              {txnForm.type === "משיכה" && (
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>סיווג המשיכה <Req /></label>
                  {selTxnMember && selTxnSavings > 0 && (
                    <div style={{ fontSize: ".78rem", background: "#f0faf6", border: "1px solid #c6e9d8", borderRadius: 7, padding: "0.35rem 0.6rem", marginBottom: 6, color: BRAND }}>
                      יתרת חיסכון לחבר: <strong>{ils(selTxnSavings)}</strong> — ברירת מחדל: משיכת פיקדון
                    </div>
                  )}
                  <select value={txnForm.subtype || (selTxnSavings > 0 ? "refund" : "loan")}
                    onChange={e => setTxnForm(f => ({ ...f, subtype: e.target.value }))} style={inp}>
                    <option value="refund">משיכת פיקדון (החזר חיסכון)</option>
                    <option value="loan">הלוואה חדשה</option>
                  </select>
                </div>
              )}
              <div>
                <label style={lbl}>תאריך <Req /></label>
                <DatePicker value={txnForm.greg_date} onChange={setTxnGregDate} error={!!formErr.date} />
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
              <button onClick={saveTxn} disabled={saving} className="btn btn-primary">{saving ? "שומר…" : "✓ שמור פעולה"}</button>
              <button onClick={closeTxn} className="btn btn-soft">ביטול</button>
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
              <button onClick={saveMember} disabled={saving} className="btn btn-primary">{saving ? "שומר…" : "✓ הוסף חבר"}</button>
              <button onClick={closeMember} className="btn btn-soft">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== פופ-אפ הצלחה במרכז המסך ===== */}
      {toast && <SuccessPopup title={toast.title} lines={toast.lines} onClose={() => setToast(null)} />}

      {/* ===== חלונית התראות בכניסה: בקשות ופניות ממתינות ===== */}
      {notifOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setNotifOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,30,25,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,.3)", direction: "rtl", overflow: "hidden", animation: "modalIn 0.22s ease" }}>
            {/* כותרת */}
            <div style={{ background: `linear-gradient(135deg, #0c5642, ${BRAND})`, color: "#fff", padding: "1.1rem 1.3rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bell size={22} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>התראות לטיפול</div>
                  <div style={{ fontSize: ".8rem", opacity: .85 }}>{pendingChanges + openRequests + checksDueSoon.length} פריטים — בקשות, פניות ושיקים לפרעון</div>
                </div>
              </div>
              <button onClick={() => setNotifOpen(false)} title="סגור" style={{ background: "rgba(255,255,255,.18)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", fontSize: "1.1rem", cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>

            {/* רשימה */}
            <div style={{ padding: "0.9rem 1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingList.map(c => (
                <div key={c.id} style={notifRow}>
                  <div style={{ ...notifDot, background: "#f59e0b" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: ".9rem" }}>
                      {c.members?.name || "—"} · {c.kind === "add" ? "בקשת פעולה חדשה" : c.kind === "delete" ? "בקשת מחיקת פעולה" : "הצעת תיקון לפעולה"}
                    </div>
                    <div style={{ fontSize: ".78rem", color: "#7a8699" }}>
                      {c.proposed?.amount ? `${ils(Number(c.proposed.amount))} · ` : ""}{new Date(c.created_at).toLocaleDateString("he-IL")}{c.document_url ? " · 📎 מסמך" : ""}
                    </div>
                  </div>
                </div>
              ))}
              {requestsList.map(r => (
                <div key={r.id} style={notifRow}>
                  <div style={{ ...notifDot, background: "#3b82f6" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: ".9rem" }}>
                      {r.members?.name || "—"} · {r.type === "loan" ? "בקשת הלוואה" : r.type === "deposit_refund" ? "בקשת החזר פיקדון" : "פנייה / הודעה"}
                    </div>
                    <div style={{ fontSize: ".78rem", color: "#7a8699" }}>
                      {r.subject ? `${r.subject} · ` : ""}{r.amount ? `${ils(r.amount)} · ` : ""}{new Date(r.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                </div>
              ))}
              {checksDueSoon.map(c => (
                <Link key={c.id} href={`/members/${c.member_id}`} onClick={() => setNotifOpen(false)} style={{ textDecoration: "none" }}>
                  <div style={notifRow}>
                    <div style={{ ...notifDot, background: "#c0392b" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: ".9rem" }}>{c.members?.name || "—"} · פרעון שיק</div>
                      <div style={{ fontSize: ".78rem", color: "#7a8699" }}>{ils(c.amount)} · פירעון {c.due_date ? gdate(c.due_date) : ""}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* כפתורים */}
            <div style={{ borderTop: "1px solid #f0f2f5", padding: "0.85rem 1rem", display: "flex", gap: 10 }}>
              <Link href="/requests" onClick={() => setNotifOpen(false)} className="btn btn-primary" style={{ flex: 1 }}>מעבר לטיפול בבקשות →</Link>
              <button onClick={() => setNotifOpen(false)} className="btn btn-soft">סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const notifRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", borderRadius: 12, padding: "0.6rem 0.8rem" };
const notifDot: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 };

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
