"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/lib/supabase";
import { ils, num, gdate, toHebrewDate, hebrewDateLetters, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { hebTextToGregDisplay } from "@/lib/hebrewParse";
import { Badge, Loading, SuccessPopup } from "@/components/ui";
import type { FundSummary, Transaction, MemberBalance, Member } from "@/types";
import { useAuth } from "@/components/AuthGuard";
import { Users, ArrowDownCircle, ArrowUpCircle, Wallet, UserPlus, CreditCard, BarChart3, Clock, Flame } from "lucide-react";

type Recent = Transaction & { members: { name: string } | null };

const BRAND = "#1e6f5c";
const RED = "#e05252";

const PERIOD_LABEL = { day: "היום", week: "השבוע", month: "החודש", year: "השנה" } as const;
const PERIOD_TAB = { day: "יום", week: "שבוע", month: "חודש", year: "שנה" } as const;

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
  const [allTxns, setAllTxns] = useState<{ amount: number; type: string; greg_date: string | null; heb_date: string | null; created_at: string }[]>([]);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("day");
  const [loading, setLoading] = useState(true);

  const [addTxn, setAddTxn] = useState(false);
  const [addMember, setAddMember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [txnForm, setTxnForm] = useState({ memberName: "", amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  const [memberForm, setMemberForm] = useState({ name: "", code: "", phone: "", address: "" });
  const [formErr, setFormErr] = useState<Record<string, string>>({});

  const [pendingChanges, setPendingChanges] = useState(0);
  const [openRequests, setOpenRequests] = useState(0);
  const [dueChecks, setDueChecks] = useState<any[]>([]);

  async function load() {
    const [s, r, t, m, a, pc, or, ck] = await Promise.all([
      supabase.from("fund_summary").select("*").single(),
      supabase.from("transactions").select("*, members(name)").order("created_at", { ascending: false }).limit(10),
      supabase.from("member_balances").select("*").order("balance", { ascending: false }).limit(6),
      supabase.from("members").select("*").order("name"),
      supabase.from("transactions").select("amount,type,greg_date,heb_date,created_at").limit(50000),
      supabase.from("transaction_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("member_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("checks").select("*, members(name)").eq("status", "pending").order("due_date", { ascending: true }).limit(200),
    ]);
    setSummary(s.data as FundSummary);
    setRecent((r.data as Recent[]) || []);
    setTop((t.data as MemberBalance[]) || []);
    setMembers((m.data as Member[]) || []);
    setAllTxns((a.data as any[]) || []);
    setPendingChanges(pc.count || 0);
    setOpenRequests(or.count || 0);
    setDueChecks((ck.data as any[]) || []);
    setLoading(false);
  }

  // שיקים שהגיע מועד פירעונם (תזכורת יומית עד פדיון)
  const checksDueNow = useMemo(() => {
    const today = new Date(); today.setHours(23, 59, 59, 999);
    return dueChecks.filter(c => c.due_date && new Date(c.due_date) <= today);
  }, [dueChecks]);

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
  const [zmanim, setZmanim] = useState<{ label: string; time: Date }[]>([]);
  const [dafBavli, setDafBavli] = useState("");
  const [dafYerushalmi, setDafYerushalmi] = useState("");
  const [rates, setRates] = useState<{ usd: number; eur: number; updated: Date } | null>(null);
  const [candles, setCandles] = useState<{ label: string; time: string; mins: number; havdalah: string }[]>([]);

  // זמני הדלקת נרות לשבת הקרובה — ירושלים, ביתר עילית, מודיעין עילית
  useEffect(() => {
    const cities = [
      { label: "ירושלים", lat: 31.7683, lon: 35.2137, b: 40 },
      { label: "ביתר עילית", lat: 31.6997, lon: 35.1163, b: 40 },
      { label: "מודיעין עילית", lat: 31.9326, lon: 35.0413, b: 40 },
    ];
    Promise.all(cities.map(c =>
      fetch(`https://www.hebcal.com/shabbat?cfg=json&latitude=${c.lat}&longitude=${c.lon}&tzid=Asia/Jerusalem&b=${c.b}&M=on&lg=he`, { cache: "no-store" })
        .then(r => r.json())
        .then(data => {
          const items: any[] = data.items || [];
          const fmt = (cat: string) => {
            const it = items.find(i => i.category === cat);
            const dt = it ? new Date(it.date) : null;
            return dt && !isNaN(dt.getTime())
              ? dt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" })
              : "";
          };
          return { label: c.label, time: fmt("candles"), mins: c.b, havdalah: fmt("havdalah") };
        })
        .catch(() => ({ label: c.label, time: "", mins: c.b, havdalah: "" }))
    )).then(res => setCandles(res.filter(c => c.time)));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // שערי מטבע (דולר/יורו מול שקל) — מתרענן כל 10 דקות
  useEffect(() => {
    const loadRates = () => {
      // מקור חינמי ויציב (currency-api) דרך CDN, עם כתובת גיבוי
      const urls = [
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
        "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
      ];
      const tryUrl = (i: number) => {
        if (i >= urls.length) return;
        fetch(urls[i], { cache: "no-store" })
          .then(r => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
          .then(d => {
            const t = d?.usd;
            if (t?.ils && t?.eur) {
              setRates({ usd: t.ils, eur: t.ils / t.eur, updated: new Date() });
            } else {
              tryUrl(i + 1);
            }
          })
          .catch(() => tryUrl(i + 1));
      };
      tryUrl(0);
    };
    loadRates();
    const id = setInterval(loadRates, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // פרשת השבוע לפי לוח ארץ ישראל (geonameid=281184 = ירושלים, i=on)
    fetch("https://www.hebcal.com/shabbat?cfg=json&geonameid=281184&i=on&lg=he&M=on", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        const items: any[] = data.items || [];
        const p = items.find(i => i.category === "parashat");
        if (p) {
          // הסרת ניקוד/טעמים, המרת מקף עברי לרווח, והסרת קידומת "פרשת"
          const clean = String(p.hebrew || p.title || "")
            .replace(/־/g, " ")                      // מקף עברי → רווח
            .replace(/[֑-ֽֿ-ׇ]/g, "") // ניקוד וטעמים
            .replace(/^פרשת\s*/, "")
            .replace(/\s+/g, " ")
            .trim();
          setParasha(clean);
        }
      }).catch(() => {});

    const d = new Date();
    fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&i=on&year=${d.getFullYear()}&month=${d.getMonth() + 1}&ss=off&mf=off&c=off&geo=none&leyning=off&lg=he`)
      .then(r => r.json())
      .then(data => {
        const todayStr = d.toISOString().split("T")[0];
        const hols = (data.items || [])
          .filter((i: any) => i.date === todayStr)
          .map((i: any) => i.hebrew || i.title);
        setHolidays(hols);
      }).catch(() => {});

    // הדף היומי (בבלי) + ירושלמי יומי — מתרענן לפי תאריך היום
    const today2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cleanHeb = (s: string) => String(s || "").replace(/־/g, " ").replace(/[֑-ֽֿ-ׇ]/g, "").replace(/\s+/g, " ").trim();
    fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&lg=he&F=on&yyomi=on&start=${today2}&end=${today2}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        const items: any[] = data.items || [];
        const daf = items.find(i => i.category === "dafyomi");
        const yeru = items.find(i => i.category === "yerushalmi");
        if (daf) setDafBavli(cleanHeb(daf.hebrew || daf.title || ""));
        if (yeru) setDafYerushalmi(cleanHeb(yeru.hebrew || yeru.title || ""));
      }).catch(() => {});

    // זמני היום (מודיעין עילית) — היום ומחר, כדי למצוא את הזמן ההלכתי הבא
    const ZMAN: [string, string][] = [
      ["alotHaShachar", "עלות השחר"],
      ["misheyakir", "זמן טלית ותפילין"],
      ["sunrise", "הנץ החמה"],
      ["sofZmanShma", "סוף זמן קריאת שמע"],
      ["sofZmanTfilla", "סוף זמן תפילה"],
      ["chatzot", "חצות היום"],
      ["minchaGedola", "מנחה גדולה"],
      ["minchaKetana", "מנחה קטנה"],
      ["plagHaMincha", "פלג המנחה"],
      ["sunset", "שקיעה"],
      ["tzeit7083deg", "צאת הכוכבים"],
    ];
    const LAT = 31.9326, LON = 35.0413;
    const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);
    Promise.all([d, tomorrow].map(day =>
      fetch(`https://www.hebcal.com/zmanim?cfg=json&latitude=${LAT}&longitude=${LON}&tzid=Asia/Jerusalem&date=${fmt(day)}`)
        .then(r => r.json()).catch(() => null)
    )).then(results => {
      const list: { label: string; time: Date }[] = [];
      for (const res of results) {
        const times = res?.times || {};
        for (const [key, label] of ZMAN) {
          if (times[key]) {
            const t = new Date(times[key]);
            if (!isNaN(t.getTime())) list.push({ label, time: t });
          }
        }
      }
      list.sort((a, b) => a.time.getTime() - b.time.getTime());
      setZmanim(list);
    }).catch(() => {});
  }, []);

  if (loading) return <Loading />;

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const TZ = "Asia/Jerusalem";
  const dayOfWeek = now.toLocaleDateString("he-IL", { weekday: "long", timeZone: TZ });
  // תאריך עברי באותיות גימטריה (ט״ז בסיון תשפ״ו) לפי שעון ירושלים
  const hebDate = hebrewDateLetters(now);
  const gregDate = now.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const timeStr = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TZ });

  // הזמן ההלכתי הבא
  const nextZman = zmanim.find(z => z.time.getTime() > now.getTime());
  let zmanCountdown = "";
  if (nextZman) {
    const diffMin = Math.round((nextZman.time.getTime() - now.getTime()) / 60000);
    const h = Math.floor(diffMin / 60), m = diffMin % 60;
    if (diffMin < 1) zmanCountdown = "עוד פחות מדקה";
    else if (h === 0) zmanCountdown = `בעוד ${m} דקות`;
    else if (m === 0) zmanCountdown = `בעוד ${h} שעות`;
    else zmanCountdown = `בעוד ${h} שעות ו-${m} דקות`;
  }
  const zmanTime = nextZman ? nextZman.time.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

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
          {parasha && (
            <>
              <span style={{ color: "#cbd5e0" }}>•</span>
              <span style={{ fontWeight: 700, color: BRAND }}>פרשת {parasha.replace(/^פרשת\s*/, "")}</span>
            </>
          )}
          <span style={{ color: "#cbd5e0" }}>•</span>
          <span style={{ fontWeight: 600, color: BRAND }}>{hebDate}</span>
          <span style={{ color: "#cbd5e0" }}>•</span>
          <span style={{ color: "#9aa5b5" }}>{gregDate}</span>
          <span style={{ color: "#cbd5e0" }}>•</span>
          <span style={{ color: "#4a5568", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, monospace", letterSpacing: ".5px" }} dir="ltr">{timeStr}</span>
          {dafBavli && (
            <>
              <span style={{ color: "#cbd5e0" }}>•</span>
              <span><span style={{ color: "#9aa5b5" }}>דף יומי: </span><span style={{ fontWeight: 700, color: "#7c3aed" }}>{dafBavli}</span></span>
            </>
          )}
          {dafYerushalmi && (
            <>
              <span style={{ color: "#cbd5e0" }}>•</span>
              <span><span style={{ color: "#9aa5b5" }}>ירושלמי: </span><span style={{ fontWeight: 700, color: "#0891b2" }}>{dafYerushalmi}</span></span>
            </>
          )}
          {rates && (
            <>
              <span style={{ color: "#cbd5e0" }}>•</span>
              <span><span style={{ color: "#9aa5b5" }}>דולר: </span><span style={{ fontWeight: 700, color: "#16a34a" }}>₪{rates.usd.toFixed(2)}</span></span>
              <span style={{ color: "#cbd5e0" }}>•</span>
              <span><span style={{ color: "#9aa5b5" }}>יורו: </span><span style={{ fontWeight: 700, color: "#2563eb" }}>₪{rates.eur.toFixed(2)}</span></span>
              <span style={{ color: "#b0bac7", fontSize: ".78rem" }} dir="ltr">
                (עודכן {rates.updated.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" })})
              </span>
            </>
          )}
          {holidays.map(h => (
            <span key={h}>
              <span style={{ color: "#cbd5e0", marginInlineEnd: "0.7rem" }}>•</span>
              <span style={{ fontWeight: 700, color: "#b7791f" }}>{h}</span>
            </span>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 10, marginTop: 12 }}>
          {/* הזמן ההלכתי הבא */}
          {nextZman && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg,#f0f9f5,#eef6ff)",
              border: "1px solid #d7e9e2", borderRadius: 12,
              padding: "0.55rem 1rem", fontSize: ".9rem",
            }}>
              <Clock size={18} color={BRAND} />
              <span style={{ color: "#4a5568" }}>
                שים לב: <strong style={{ color: "#1a1a2e" }}>{nextZman.label}</strong> בשעה{" "}
                <strong style={{ color: BRAND, fontVariantNumeric: "tabular-nums" }} dir="ltr">{zmanTime}</strong>
              </span>
              <span style={{ background: BRAND, color: "#fff", borderRadius: 999, padding: "0.15rem 0.7rem", fontSize: ".8rem", fontWeight: 700 }}>
                {zmanCountdown}
              </span>
            </div>
          )}

          {/* הדלקת נרות שבת הקרובה */}
          {candles.length > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap",
              background: "linear-gradient(135deg,#fff8ec,#fff3ee)",
              border: "1px solid #f2e0c9", borderRadius: 12,
              padding: "0.55rem 1rem", fontSize: ".9rem",
            }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#b45309", fontWeight: 800 }}>
                <Flame size={18} color="#e8820c" /> שבת
              </span>
              {candles.map(c => (
                <span key={c.label} style={{ display: "inline-flex", flexDirection: "column", gap: 2, paddingInline: 4, borderInlineStart: "1px solid #f0e2cc" }}>
                  <span style={{ color: "#7a8699", fontWeight: 700, fontSize: ".82rem" }}>{c.label}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".82rem" }}>
                    <span style={{ color: "#9aa5b5" }}>נרות</span>
                    <strong style={{ color: "#b45309", fontVariantNumeric: "tabular-nums" }} dir="ltr">{c.time}</strong>
                    <span style={{ color: "#c0a988", fontSize: ".72rem" }}>({c.mins} ד׳)</span>
                    {c.havdalah && (
                      <>
                        <span style={{ color: "#d8c4a3" }}>·</span>
                        <span style={{ color: "#9aa5b5" }}>צאת</span>
                        <strong style={{ color: "#7c3aed", fontVariantNumeric: "tabular-nums" }} dir="ltr">{c.havdalah}</strong>
                      </>
                    )}
                  </span>
                </span>
              ))}
            </div>
          )}
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

      {/* תזכורת: שיקים שהגיע מועד פירעונם */}
      {checksDueNow.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#fef2f2,#fff7ed)", border: "1px solid #f5c2a8", borderRadius: 16, padding: "1rem 1.25rem", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: "1.2rem" }}>🔔</span>
            <div style={{ fontWeight: 800, color: "#1a1a2e" }}>שיקים שהגיע מועד פירעונם ({checksDueNow.length})</div>
            <span style={{ fontSize: ".8rem", color: "#b45309" }}>— יש לסמן כנפדה לאחר הפקדה בבנק</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {checksDueNow.slice(0, 8).map(c => (
              <Link key={c.id} href={`/members/${c.member_id}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "0.5rem 0.85rem", fontSize: ".86rem" }}>
                  <span style={{ color: "#1a1a2e", fontWeight: 600 }}>{c.members?.name || "—"}</span>
                  <span style={{ color: "#7a8699" }}>{c.due_date ? gdate(c.due_date) : ""}{c.notes ? ` · ${c.notes}` : ""}</span>
                  <span style={{ fontWeight: 800, color: "#c0392b" }}>{ils(c.amount)}</span>
                </div>
              </Link>
            ))}
            {checksDueNow.length > 8 && <div style={{ fontSize: ".8rem", color: "#b45309" }}>ועוד {checksDueNow.length - 8}…</div>}
          </div>
        </div>
      )}

      {/* פעילות לפי תקופה */}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "1.1rem 1.25rem", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 7 }}>
            <Clock size={18} color={BRAND} /> פעילות {PERIOD_LABEL[period]}
          </h3>
          <div style={{ display: "inline-flex", background: "#f0f4f3", borderRadius: 999, padding: 3, gap: 2 }}>
            {(["day", "week", "month", "year"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  border: "none", cursor: "pointer", padding: "0.4rem 1rem", borderRadius: 999,
                  fontSize: ".84rem", fontWeight: 700, transition: "all .15s",
                  background: period === p ? BRAND : "transparent",
                  color: period === p ? "#fff" : "#7a8699",
                  boxShadow: period === p ? "0 2px 6px rgba(30,111,92,.3)" : "none",
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

      {/* ===== פופ-אפ הצלחה במרכז המסך ===== */}
      {toast && <SuccessPopup title={toast.title} lines={toast.lines} onClose={() => setToast(null)} />}
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
