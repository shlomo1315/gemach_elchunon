"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil, CheckCircle2 } from "lucide-react";
import { supabase, fnErrMessage } from "@/lib/supabase";
import { ils, gdate, toHebrewDate, TXN_TYPES, TXN_METHODS } from "@/lib/format";
import { hebTextToGreg } from "@/lib/hebrewParse";
import { Card, PageTitle, Button, Badge, Loading, Empty } from "@/components/ui";
import DatePicker from "@/components/DatePicker";
import type { MemberBalance, Transaction, Check } from "@/types";
import { archiveTransactions } from "@/lib/archive";

const BRAND = "#107a5e";

// תאריך לועזי: מהשדה השמור, ואם אין — חישוב אוטומטי מהתאריך העברי הטקסטואלי
function gregOf(t: Transaction): string {
  if (t.greg_date) return gdate(t.greg_date);
  const iso = hebTextToGreg(t.heb_date);
  return iso ? gdate(iso) : "—";
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberBalance | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [allMembers, setAllMembers] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  // עריכת פרטי החבר ישירות בכרטסת
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState({ name: "", code: "", phone: "", address: "", email: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  // יצירת התחברות לחבר
  const [loginPass, setLoginPass] = useState("");
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");
  // שחזור מחיקה
  const [undoSnap, setUndoSnap] = useState<{txns: Transaction[]; label: string} | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // פופאפ הצלחה ליצירת/עדכון התחברות (נסגר אוטומטית באיטיות כלפי פנים)
  const [loginPopup, setLoginPopup] = useState<string | null>(null);
  const [loginPopupClosing, setLoginPopupClosing] = useState(false);

  useEffect(() => {
    if (!loginPopup) return;
    setLoginPopupClosing(false);
    const tClose = setTimeout(() => setLoginPopupClosing(true), 1400);
    const tDone = setTimeout(() => setLoginPopup(null), 2000);
    return () => { clearTimeout(tClose); clearTimeout(tDone); };
  }, [loginPopup]);

  function startEditInfo() {
    if (!member) return;
    setInfo({ name: member.name || "", code: member.code || "", phone: member.phone || "", address: member.address || "", email: member.email || "" });
    setLoginPass(""); setLoginMsg("");
    setEditInfo(true);
  }

  async function saveInfo() {
    if (!member) return;
    setSavingInfo(true);
    const { error } = await supabase.from("members").update({
      name: info.name.trim(), code: info.code.trim() || null,
      phone: info.phone.trim() || null, address: info.address.trim() || null,
      email: info.email.trim().toLowerCase() || null,
    }).eq("id", member.id);
    setSavingInfo(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setEditInfo(false);
    load();
  }

  async function createLogin() {
    if (!member) return;
    const email = info.email.trim().toLowerCase();
    if (!email) { setLoginMsg("יש להזין מייל לחבר תחילה"); return; }
    if (loginPass.length < 6) { setLoginMsg("סיסמה חייבת להיות לפחות 6 תווים"); return; }
    setCreatingLogin(true); setLoginMsg("");
    const { data, error } = await supabase.functions.invoke("quick-service", {
      body: { email, password: loginPass, memberId: member.id },
    });
    setCreatingLogin(false);
    if (error || (data && (data as any).error)) {
      setLoginMsg("שגיאה: " + (await fnErrMessage(error, data)));
      return;
    }
    setLoginMsg("");
    setLoginPopup((data as any)?.updated ? "הפרטים עודכנו בהצלחה" : "חשבון ההתחברות נוצר בהצלחה");
    setLoginPass("");
    load();
  }

  useEffect(() => {
    supabase.from("members").select("id, name, code").order("name").then(({ data }) => {
      if (data) setAllMembers(data as { id: string; name: string; code: string | null }[]);
    });
  }, []);

  async function load() {
    const [m, t, c] = await Promise.all([
      supabase.from("member_balances").select("*").eq("id", id).single(),
      supabase.from("transactions").select("*").eq("member_id", id).order("created_at", { ascending: true }),
      supabase.from("checks").select("*").eq("member_id", id).order("due_date", { ascending: true }),
    ]);
    setMember(m.data as MemberBalance);
    setTxns((t.data as Transaction[]) || []);
    setChecks((c.data as Check[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  // A5: שיקים
  const [checks, setChecks] = useState<Check[]>([]);
  const [chkBusy, setChkBusy] = useState<string | null>(null);
  // עורך שיקים מרובים: מקלידים מספר → נפתחות שורות; ממלאים מלמעלה והסכום משתכפל; עורכים ידנית; שומרים
  type ChkDraft = { amount: string; due_date: string; notes: string };
  const [chkMaster, setChkMaster] = useState({ amount: "", due_date: "", count: "1", loan_transaction_id: "" });
  const [chkDrafts, setChkDrafts] = useState<ChkDraft[]>([{ amount: "", due_date: "", notes: "" }]);
  const [savingChks, setSavingChks] = useState(false);

  // ההלוואות של החבר (פעולות משיכה) — לשיוך שיקים אליהן
  const loans = useMemo(() => txns.filter(t => t.type === "משיכה"), [txns]);

  // אם יש בדיוק הלוואה אחת — לשייך אליה אוטומטית את השיקים
  useEffect(() => {
    if (loans.length === 1 && !chkMaster.loan_transaction_id) {
      setChkMaster(f => ({ ...f, loan_transaction_id: loans[0].id }));
    }
  }, [loans, chkMaster.loan_transaction_id]);

  // תאריך השיק ה-i: חודש עוקב מהתאריך הראשון (חישוב ב-UTC כדי לא להיסחף עקב אזור זמן)
  function monthlyISO(firstISO: string, i: number): string {
    if (!firstISO) return "";
    const [y, m, d] = firstISO.split("-").map(Number);
    return new Date(Date.UTC(y, (m - 1) + i, d)).toISOString().slice(0, 10);
  }
  function setMasterCount(v: string) {
    const n = Math.max(0, Math.min(60, Number(v) || 0));
    setChkMaster(f => ({ ...f, count: v }));
    setChkDrafts(prev => Array.from({ length: n }, (_, i) => prev[i] || { amount: chkMaster.amount, due_date: monthlyISO(chkMaster.due_date, i), notes: "" }));
  }
  function setMasterAmount(v: string) {
    setChkMaster(f => ({ ...f, amount: v }));
    setChkDrafts(ds => ds.map(d => ({ ...d, amount: v }))); // משתכפל לכל השורות
  }
  function setMasterDate(v: string) {
    setChkMaster(f => ({ ...f, due_date: v }));
    setChkDrafts(ds => ds.map((d, i) => ({ ...d, due_date: monthlyISO(v, i) }))); // פריסה חודשית
  }
  function updateDraft(i: number, field: keyof ChkDraft, v: string) {
    setChkDrafts(ds => ds.map((d, idx) => idx === i ? { ...d, [field]: v } : d));
  }
  function removeDraft(i: number) {
    setChkDrafts(ds => ds.filter((_, idx) => idx !== i));
    setChkMaster(f => ({ ...f, count: String(Math.max(0, chkDrafts.length - 1)) }));
  }

  async function saveChecks() {
    if (!member) return;
    const valid = chkDrafts.filter(d => Number(d.amount) > 0 && d.due_date);
    if (valid.length === 0) { alert("אין שיקים תקינים לשמירה (סכום חיובי ותאריך פירעון לכל שיק)"); return; }
    // אם יש יותר מהלוואה אחת — חובה לבחור לאיזו הלוואה השיקים מיועדים
    if (loans.length > 1 && !chkMaster.loan_transaction_id) { alert("יש לבחור לאיזו הלוואה השיקים מיועדים"); return; }
    // סך השיקים להלוואה לא יכול לחרוג מסכום ההלוואה
    const loanId = chkMaster.loan_transaction_id;
    if (loanId) {
      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        const existingSum = checks.filter(c => c.loan_transaction_id === loanId && c.status !== "bounced").reduce((s, c) => s + c.amount, 0);
        const newSum = valid.reduce((s, d) => s + Number(d.amount), 0);
        if (existingSum + newSum > loan.amount + 0.001) {
          const remaining = Math.max(0, loan.amount - existingSum);
          alert(`סכום השיקים חורג מסכום ההלוואה.\nהלוואה: ${ils(loan.amount)}\nשיקים קיימים להלוואה זו: ${ils(existingSum)}\nניתן להוסיף עוד עד ${ils(remaining)} (ניסית להוסיף ${ils(newSum)}).`);
          return;
        }
      }
    }
    setSavingChks(true);
    const rows = valid.map((d, i) => ({
      member_id: member.id,
      amount: Number(d.amount),
      due_date: d.due_date,
      hebrew_due: toHebrewDate(d.due_date),
      notes: d.notes || (valid.length > 1 ? `שיק ${i + 1}/${valid.length}` : null),
      status: "pending",
      kind: "repayment", // כל השיקים הם לפירעון חוב
      loan_transaction_id: chkMaster.loan_transaction_id || null,
    }));
    const { error } = await supabase.from("checks").insert(rows);
    setSavingChks(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setChkMaster({ amount: "", due_date: "", count: "1", loan_transaction_id: "" });
    setChkDrafts([{ amount: "", due_date: "", notes: "" }]);
    load();
  }

  // התקדמות פירעון: כמה מהחוב כבר נפרע בשיקים וכמה צפוי להיפרע
  const checkStats = useMemo(() => {
    const pend = checks.filter(c => c.status === "pending");
    const cashed = checks.filter(c => c.status === "cashed");
    const pendSum = pend.reduce((s, c) => s + c.amount, 0);
    const cashedSum = cashed.reduce((s, c) => s + c.amount, 0);
    const debt = member ? Math.max(0, member.loan_balance ?? 0) : 0; // חוב הלוואות בפועל
    const projectedDebt = Math.max(0, debt - pendSum);               // יתרת חוב צפויה אחרי פדיון כל הממתינים
    const planTotal = cashedSum + pendSum;                           // סך תכנית הפירעון בשיקים
    const progressPct = planTotal > 0 ? Math.round((cashedSum / planTotal) * 100) : 0;
    return {
      pend, pendSum, cashedSum, debt, projectedDebt, planTotal, progressPct,
      total: checks.length, pendCount: pend.length, cashedCount: cashed.length,
    };
  }, [checks, member]);

  // פדיון שיק → יוצר הפקדת פרעון שמקטינה את חוב ההלוואה ומקשר אותה לשיק.
  async function markCashed(c: Check) {
    if (!member) return;
    if (!confirm(`לסמן שיק על סך ${ils(c.amount)} כנפדה? תיווצר הפקדה שתקטין את חוב ההלוואה.`)) return;
    setChkBusy(c.id);
    // הפניה להלוואה שהשיק פורע — תופיע בהערות הפעולה
    const loan = c.loan_transaction_id ? txns.find(t => t.id === c.loan_transaction_id) : null;
    const loanRef = loan ? ` · פרעון הלוואה ע״ס ${ils(loan.amount)}${loan.greg_date ? " מ-" + gdate(loan.greg_date) : ""}` : " (פרעון)";
    const { data: txn, error: tErr } = await supabase.from("transactions").insert({
      member_id: member.id, amount: c.amount, type: "הפקדה", method: "צ'יקים",
      greg_date: c.due_date, heb_date: c.hebrew_due,
      notes: "פדיון שיק" + loanRef + (c.notes ? " · " + c.notes : ""),
      category: "repayment",
    }).select("id").single();
    if (tErr) { setChkBusy(null); alert("שגיאה ביצירת ההפקדה: " + tErr.message); return; }
    await supabase.from("checks").update({ status: "cashed", cashed_at: new Date().toISOString(), transaction_id: (txn as any)?.id || null }).eq("id", c.id);
    setChkBusy(null);
    load();
  }

  async function markBounced(c: Check) {
    setChkBusy(c.id);
    await supabase.from("checks").update({ status: "bounced" }).eq("id", c.id);
    setChkBusy(null);
    load();
  }

  async function deleteCheck(c: Check) {
    if (!confirm("למחוק את השיק?")) return;
    setChkBusy(c.id);
    await supabase.from("checks").delete().eq("id", c.id);
    setChkBusy(null);
    load();
  }

  function openEdit(t: Transaction) {
    setForm({
      amount: String(t.amount), type: t.type, method: t.method || "",
      greg_date: t.greg_date?.split("T")[0] || "", heb_date: t.heb_date || "", notes: t.notes || "",
    });
    setEditing(t);
  }

  // הוספת פעולה חדשה לחבר הנוכחי
  const [addTxn, setAddTxn] = useState(false);
  const [addForm, setAddForm] = useState({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", repay: "", subtype: "", thirdPartyName: "", thirdPartyMemberId: "", thirdPartyLinkType: "" });
  const [savingAdd, setSavingAdd] = useState(false);

  function openAdd() {
    const defSubtype = (member?.savings_balance ?? 0) > 0 ? "refund" : "loan";
    setAddForm({ amount: "", type: "הפקדה", method: "", greg_date: "", heb_date: "", notes: "", repay: "", subtype: defSubtype, thirdPartyName: "", thirdPartyMemberId: "", thirdPartyLinkType: "" });
    setAddTxn(true);
  }
  function setAddGreg(val: string) { setAddForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) })); }
  async function saveAdd() {
    if (!member) return;
    if (!addForm.amount || Number(addForm.amount) <= 0) { alert("יש להזין סכום חיובי"); return; }
    if (!addForm.method) { alert("יש לבחור אופן"); return; }
    if (!addForm.greg_date) { alert("יש לבחור תאריך"); return; }
    setSavingAdd(true);
    const effectiveSubtype = addForm.subtype || ((member.savings_balance ?? 0) > 0 ? "refund" : "loan");
    const category = addForm.type === "משיכה" ? effectiveSubtype : "deposit";
    const mainNotes = addForm.method === "העברה לצד ג" && addForm.thirdPartyName
      ? [addForm.notes, `צד ג': ${addForm.thirdPartyName}`].filter(Boolean).join(" · ")
      : addForm.notes || null;
    const { data: txn, error } = await supabase.from("transactions").insert({
      member_id: member.id, amount: Number(addForm.amount), type: addForm.type,
      method: addForm.method || null, greg_date: addForm.greg_date || null,
      heb_date: addForm.heb_date || null, notes: mainNotes, category,
    }).select("id").single();
    if (error) { setSavingAdd(false); alert("שגיאה: " + error.message); return; }
    // פעולה מקושרת לחבר אחר בגמ"ח (העברה לצד ג)
    if (addForm.method === "העברה לצד ג" && addForm.thirdPartyMemberId && addForm.thirdPartyLinkType) {
      const linkedType = addForm.thirdPartyLinkType === "loan" ? "משיכה" : "הפקדה";
      const linkedCategory = addForm.thirdPartyLinkType === "loan" ? "loan" : "repayment";
      const linkedNotes = `העברה מ${member.name}${addForm.thirdPartyName ? ` (${addForm.thirdPartyName})` : ""}`;
      await supabase.from("transactions").insert({
        member_id: addForm.thirdPartyMemberId,
        amount: Number(addForm.amount),
        type: linkedType,
        method: "העברה בנקאית",
        greg_date: addForm.greg_date || null,
        heb_date: addForm.heb_date || null,
        notes: linkedNotes,
        category: linkedCategory,
      });
    }
    setSavingAdd(false);
    setAddTxn(false);
    // אם זו הלוואה שתוחזר בשיקים — פתיחת עורך השיקים משויך להלוואה זו
    const goChecks = addForm.type === "משיכה" && addForm.repay === "שיקים" && effectiveSubtype === "loan";
    const newLoanId = (txn as any)?.id || "";
    await load();
    if (goChecks && newLoanId) {
      setChkMaster(f => ({ ...f, loan_transaction_id: newLoanId }));
      setTimeout(() => document.getElementById("checks-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }

  // בחירת תאריך לועזי → חישוב עברי אוטומטי
  function setGreg(val: string) {
    setForm(f => ({ ...f, greg_date: val, heb_date: toHebrewDate(val) }));
  }
  // הקלדת תאריך עברי → חישוב לועזי אוטומטי (אם ניתן)
  function setHeb(val: string) {
    const iso = hebTextToGreg(val);
    setForm(f => ({ ...f, heb_date: val, greg_date: iso || f.greg_date }));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("transactions").update({
      amount: Number(form.amount), type: form.type, method: form.method || null,
      greg_date: form.greg_date || null, heb_date: form.heb_date || null, notes: form.notes || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setEditing(null);
    load();
  }

  function scheduleUndo(txns: Transaction[], label: string) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoSnap({ txns, label });
    undoTimerRef.current = setTimeout(() => { setUndoSnap(null); undoTimerRef.current = null; }, 8000);
  }

  async function restoreDeleted() {
    if (!undoSnap) return;
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    const snap = undoSnap;
    setUndoSnap(null);
    const rows = snap.txns.map((t: Transaction) => { const { id: _id, created_at: _ca, ...rest } = t; return rest; });
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) { alert("שגיאת שחזור: " + error.message); return; }
    // הסרה מהארכיון הקבוע (בוטל תוך 8 שניות — לא נחשב למחיקה)
    const ids = snap.txns.map((t: Transaction) => t.id);
    await supabase.from("deleted_transactions").delete().in("original_id", ids);
    load();
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("למחוק את הפעולה?")) return;
    const snapshot = editing;
    setSaving(true);
    await archiveTransactions([snapshot], member?.name);
    await supabase.from("transactions").delete().eq("id", editing.id);
    setSaving(false);
    setEditing(null);
    scheduleUndo([snapshot], "הפעולה נמחקה");
    load();
  }

  // מחיקת כל הפעולות של החבר — עם אישור כפול
  const [deletingAll, setDeletingAll] = useState(false);
  async function deleteAllTxns() {
    if (!member || txns.length === 0) return;
    if (!confirm(`למחוק את כל ${txns.length} הפעולות של "${member.name}"?\n\nפעולה זו אינה ניתנת לביטול!`)) return;
    if (!confirm("אישור אחרון — כל הפעולות יימחקו לצמיתות. להמשיך?")) return;
    setDeletingAll(true);
    await archiveTransactions(txns, member.name);
    const { error } = await supabase.from("transactions").delete().eq("member_id", member.id);
    setDeletingAll(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    load();
  }

  // בחירה מרובה (סימון וי) ומחיקת הנבחרות
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingSel, setDeletingSel] = useState(false);
  function toggleOne(tid: string) {
    setSelected(s => { const n = new Set(s); n.has(tid) ? n.delete(tid) : n.add(tid); return n; });
  }
  function toggleAll() {
    setSelected(s => s.size === txns.length ? new Set() : new Set(txns.map(t => t.id)));
  }
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`למחוק ${selected.size} פעולות שנבחרו?\n\nניתן לשחזר תוך 8 שניות.`)) return;
    const snapshot = txns.filter(t => selected.has(t.id));
    setDeletingSel(true);
    await archiveTransactions(snapshot, member?.name);
    const { error } = await supabase.from("transactions").delete().in("id", Array.from(selected));
    setDeletingSel(false);
    if (error) { alert("שגיאה: " + error.message); return; }
    setSelected(new Set());
    scheduleUndo(snapshot, `${snapshot.length} פעולות נמחקו`);
    load();
  }

  function buildShtarChov(name: string, address: string, phone: string, amount: string, date: string) {
    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><title>שטר חוב — ${name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:13px;direction:rtl;padding:22px 30px;color:#000;line-height:1.75}
.wrap{border:1.5px solid #555;padding:16px 22px 22px}
.hdr{text-align:center;margin-bottom:5px}
.ttl{font-size:19px;font-weight:bold}
.sub{font-size:12px;margin-top:1px}
.hr1{border:none;border-top:2.5px solid #2a5fa8;margin:5px 0 2px}
.hr2{border:none;border-top:1px solid #2a5fa8;margin:1px 0 10px}
.bsd{text-align:right;font-size:12px;margin-bottom:2px}
.r{margin:5px 0}
.f{display:inline-block;border-bottom:1px solid #000;vertical-align:bottom;padding-bottom:1px}
.sm{min-width:65px}.md{min-width:125px}.lg{min-width:185px}.xl{min-width:240px}
.lg2{min-width:200px}
.jus{font-size:12px;text-align:justify;line-height:1.6;margin:6px 0}
.sep{border:none;border-top:1px solid #aaa;margin:10px 0}
.np{display:block;text-align:center;margin-top:18px}
@media print{.np{display:none!important}body{padding:12px 20px}}
</style></head>
<body>
<div class="wrap">
<div class="bsd">בס&quot;ד</div>
<div class="hdr">
  <div class="ttl">גמ&quot;ח &#x27;זכרון אהרן&#x27;</div>
  <div class="sub">ע&quot;ש הנה&quot;ח ר&#x27; אהרן אייזנבלט זצ&quot;ל</div>
  <div class="sub">קהילת באיאן מודיעין עילית</div>
</div>
<hr class="hr1"><hr class="hr2">

<div class="r">תאריך <span class="f lg2">${date}</span></div>
<div class="r">אני הח&quot;מ, שם: <span class="f lg">${name}</span> &nbsp; כתובת: <span class="f lg">${address}</span></div>
<div class="r">טלפון: <span class="f md">${phone}</span> &nbsp; נייד: <span class="f md"></span></div>

<div class="r" style="margin:9px 0">מאשר בזה כי קיבלתי הלוואה מגמ&quot;ח &#x27;זכרון אהרן&#x27; בהנהלת אלחנן אייזנבלט</div>

<div class="r">סך: <span class="f md">${amount}</span> &nbsp; במילים: <span class="f xl"></span></div>
<div class="r">ומתחייב אני להחזירו בל&quot;נ עד: <span class="f lg2"></span></div>
<div class="r">○ בתשלומים חודשיים בסך <span class="f sm"></span> &nbsp;&nbsp;&nbsp; ○ בתשלום אחד</div>
<div class="r">ומסרתי עבורן שיקים לפרעון החוב.</div>

<div class="jus" style="margin-top:9px">
  והנני מתחייב בזה, על כל תשלום בנפרד, שבכל בעיה שבגינה לא יכובד, גם אם אינני באשמתי,
  עלי לדאוג להעביר למלוא את סכום התשלום בתוספת עמלת הבנק (עמלה זו היא
  רק אם ההחזרה היתה באשמתי) תוך עשרה ימים מיום חזרתו, גם אם לא נדרשתי לכך מהמלוה.
  ואם לא אעמוד בזה, עלי להחזיר מיידית את כל סכום יתרת ההלוואה – אני או הערבים.
</div>
<div class="jus">וכן אני מתחייב שבכל ד&quot;ד שיתעורר, המכריע היחיד יהיה רב השכונה הרב ליוש שליט&quot;א.</div>
<div class="jus">כל פעולות הגמ&quot;ח הם ע&quot;פ היתר עיסקא ברית פנחס.</div>

<div class="r" style="margin-top:11px">ו&quot;ז באתי עה&quot;ח: <span class="f" style="min-width:220px"></span></div>

<hr class="sep">

<div class="jus">
  אני הח&quot;מ נעשיתי ערב קבלן [כל אחד מאיתנו בנפרד], על הלוואה הנ&quot;ל, שאמרתי:
  תן לו ואני קבלן. והנני מתחייב על כל ההלוואה, ועל כל תשלום בנפרד, לשלמו מיד לכשידרוש
  ממני המלוה כל התנאים דלעיל, האמורים לגבי הלוה.
</div>

<div style="margin-top:10px">
  <div class="r">שם <span class="f lg"></span> &nbsp; כתובת: <span class="f lg"></span></div>
  <div class="r">טלפון: 05<span class="f sm"></span>-<span class="f sm"></span> &nbsp;&nbsp; נייד: 0<span class="f sm"></span>-<span class="f md"></span></div>
  <div class="r">חתימה: <span class="f" style="min-width:185px"></span></div>
</div>
<div style="margin-top:10px">
  <div class="r">שם <span class="f lg"></span> &nbsp; כתובת: <span class="f lg"></span></div>
  <div class="r">טלפון: 0<span class="f sm"></span>-<span class="f md"></span> &nbsp;&nbsp; נייד: 0<span class="f sm"></span>-<span class="f md"></span></div>
  <div class="r">חתימה: <span class="f" style="min-width:185px"></span></div>
</div>
</div>
<div class="np"><button onclick="window.print()" style="padding:9px 26px;background:#107a5e;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:Arial">🖨️ הדפסה / שמירה כ-PDF</button></div>
</body></html>`;
  }

  function downloadShtarChov() {
    const loan = txns.filter(t => t.type === "משיכה" && (t.category === "loan" || !t.category)).at(-1);
    const loanAmount = loan ? ils(loan.amount) : "";
    const loanDate = loan?.greg_date ? gdate(loan.greg_date) : (loan?.heb_date || "");
    const w = window.open("", "_blank", "width=820,height=1120");
    if (!w) { alert("לא ניתן לפתוח חלון — בדוק חסימת חלונות קופצים"); return; }
    w.document.write(buildShtarChov(member?.name || "", member?.address || "", member?.phone || "", loanAmount, loanDate));
    w.document.close(); w.focus();
  }

  if (loading) return <Loading />;
  if (!member) return <Empty text="חבר לא נמצא" />;

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
        <Card style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>פרטי החבר</h3>
            {!editInfo && (
              <button className="no-print btn btn-ghost btn-sm" onClick={startEditInfo}>
                <Pencil size={14} /> ערוך פרטים
              </button>
            )}
          </div>

          {!editInfo ? (
            <>
              <Row label="שם" value={member.name || "—"} />
              <Row label="קוד אישי" value={member.code || "—"} />
              <Row label="טלפון" value={member.phone || "—"} />
              <Row label="כתובת" value={member.address || "—"} />
              <Row label="מייל להתחברות" value={member.email || "—"} />
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>שם</label>
                <input value={info.name} onChange={e => setInfo(f => ({ ...f, name: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>קוד אישי</label>
                <input value={info.code} onChange={e => setInfo(f => ({ ...f, code: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>טלפון</label>
                <input value={info.phone} onChange={e => setInfo(f => ({ ...f, phone: e.target.value }))} style={inp} dir="ltr" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>כתובת</label>
                <input value={info.address} onChange={e => setInfo(f => ({ ...f, address: e.target.value }))} style={inp} />
              </div>
              {/* התחברות לפורטל האישי — מייל + סיסמה חצי/חצי, כפתור רוחב מלא מתחת */}
              <div style={{ gridColumn: "1/-1", background: "#f4faf8", borderRadius: 12, padding: "1rem", border: "1px solid #d7e9e2" }}>
                <div style={{ fontSize: ".82rem", fontWeight: 700, color: BRAND, marginBottom: 10 }}>🔐 התחברות לפורטל האישי (צפייה בלבד)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                  <div>
                    <label style={lbl}>מייל להתחברות</label>
                    <input value={info.email} onChange={e => setInfo(f => ({ ...f, email: e.target.value }))} style={inp} dir="ltr" type="email" placeholder="member@example.com" />
                  </div>
                  <div>
                    <label style={lbl}>סיסמה (לפחות 6 תווים)</label>
                    <input value={loginPass} onChange={e => setLoginPass(e.target.value)} style={inp} dir="ltr" type="text" placeholder="סיסמה לחבר" />
                  </div>
                </div>
                <button onClick={createLogin} disabled={creatingLogin} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
                  {creatingLogin ? "שומר…" : member.email ? "עדכן פרטים" : "צור התחברות"}
                </button>
                {loginMsg && <div style={{ fontSize: ".78rem", marginTop: 6, color: loginMsg.startsWith("✓") ? BRAND : "#c0392b" }}>{loginMsg}</div>}
                <div style={{ fontSize: ".72rem", color: "#9aa5b5", marginTop: 6 }}>החבר יתחבר עם המייל והסיסמה המוגדרים כאן.</div>
              </div>

              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
                <button onClick={saveInfo} disabled={savingInfo} className="btn btn-primary">{savingInfo ? "שומר…" : "✓ שמור פרטים"}</button>
                <button onClick={() => setEditInfo(false)} className="btn btn-soft">ביטול</button>
              </div>
            </div>
          )}
        </Card>
        <Card style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <div style={{ fontSize: ".8rem", color: "#7a8699" }}>יתרה נוכחית</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1.1, color: member.balance >= 0 ? "var(--brand)" : "#c0392b" }}>
            {ils(member.balance)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
            <div style={{ background: "#fef2f2", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
              <div style={{ fontSize: ".72rem", color: "#7a8699" }}>חוב הלוואות</div>
              <div style={{ fontWeight: 800, color: (member.loan_balance ?? 0) > 0 ? "#c0392b" : "var(--brand)" }}>{ils(Math.max(0, member.loan_balance ?? 0))}</div>
              {(member.loan_balance ?? 0) > 0 && (
                <button className="no-print btn btn-primary btn-sm" onClick={downloadShtarChov} style={{ marginTop: 5 }}>
                  📄 שטר חוב
                </button>
              )}
            </div>
            <div style={{ background: "#f0faf6", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
              <div style={{ fontSize: ".72rem", color: "#7a8699" }}>יתרת חיסכון</div>
              <div style={{ fontWeight: 800, color: "var(--brand)" }}>{ils(member.savings_balance ?? 0)}</div>
            </div>
          </div>
          {checkStats.total > 0 && (
            <div style={{ marginTop: 2, fontSize: ".78rem", color: "#5a6b7b", background: "#f8fafc", borderRadius: 8, padding: "0.5rem 0.65rem", lineHeight: 1.7 }}>
              <div><b style={{ color: "#1a1a2e" }}>שיקים:</b> {checkStats.total} במערכת · נפדו {checkStats.cashedCount} · ממתינים {checkStats.pendCount}</div>
              <div>צפי פרעון (ממתינים): <b>{ils(checkStats.pendSum)}</b> · נותר חוב: <b style={{ color: checkStats.projectedDebt > 0 ? "#c0392b" : "var(--brand)" }}>{ils(checkStats.projectedDebt)}</b></div>
            </div>
          )}
          <div style={{ fontSize: ".78rem", color: "#9aa5b5", marginTop: 2 }}>{member.txn_count} פעולות</div>
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem 0" }}>
          <h3 style={{ margin: 0 }}>היסטוריית פעולות</h3>
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            {txns.length > 0 && (
              <button onClick={deleteAllTxns} disabled={deletingAll} className="btn btn-danger btn-sm">
                🗑️ {deletingAll ? "מוחק…" : "מחק את כל הפעולות"}
              </button>
            )}
            <button onClick={openAdd} className="btn btn-primary btn-sm">
              ＋ הוספת פעולה
            </button>
          </div>
        </div>
        {txns.length === 0 ? (
          <Empty text="אין פעולות לחבר זה" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            {selected.size > 0 && (
              <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.6rem 1.25rem", background: "#fef5f5", borderBottom: "1px solid #f3d7d7" }}>
                <span style={{ fontWeight: 700, color: "#c0392b" }}>נבחרו {selected.size} פעולות</span>
                <button onClick={deleteSelected} disabled={deletingSel} className="btn btn-danger btn-sm">
                  🗑️ {deletingSel ? "מוחק…" : "מחק את הנבחרות"}
                </button>
                <button onClick={() => setSelected(new Set())} className="btn btn-soft btn-sm">
                  בטל בחירה
                </button>
              </div>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th className="no-print" style={{ width: 36 }}>
                    <input type="checkbox" checked={selected.size === txns.length && txns.length > 0} onChange={toggleAll} style={{ cursor: "pointer", width: 16, height: 16 }} />
                  </th>
                  <th>#</th>
                  <th>סוג</th>
                  <th>סכום</th>
                  <th>אופן</th>
                  <th>תאריך עברי</th>
                  <th>תאריך לועזי</th>
                  <th>הערות</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t, i) => (
                  <tr key={t.id} onClick={() => openEdit(t)} style={{ cursor: "pointer", background: selected.has(t.id) ? "#fef5f5" : "" }}
                    onMouseEnter={e => { if (!selected.has(t.id)) e.currentTarget.style.background = "#f4faf8"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected.has(t.id) ? "#fef5f5" : ""; }}>
                    <td className="no-print" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td>{i + 1}</td>
                    <td><Badge type={t.type} /></td>
                    <td style={{ fontWeight: 600, color: t.type === "משיכה" ? "#c0392b" : "#1e7d4f" }}>
                      {t.type === "משיכה" ? "-" : "+"}{ils(t.amount)}
                    </td>
                    <td>{t.method || "—"}</td>
                    <td>{t.heb_date || "—"}</td>
                    <td dir="ltr" style={{ textAlign: "right" }}>{gregOf(t)}</td>
                    <td style={{ color: "#7a8699" }}>{t.notes}</td>
                    <td className="no-print">
                      <Pencil size={15} color="#f59e0b" style={{ opacity: .7 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* A5: שיקים */}
      <Card id="checks-section" style={{ padding: 0, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem 0", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>שיקים לפרעון</h3>
          {(() => {
            const pend = checks.filter(c => c.status === "pending");
            const sum = pend.reduce((s, c) => s + c.amount, 0);
            return pend.length > 0 ? <span style={{ fontSize: ".82rem", color: "#7a8699" }}>{pend.length} שיקים פתוחים · {ils(sum)}</span> : null;
          })()}
        </div>

        {/* התקדמות פירעון ההלוואה בשיקים */}
        {checks.length > 0 && (
          <div style={{ padding: "0.75rem 1.25rem 0" }}>
            {checkStats.planTotal > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 8, background: "#eef2f1", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${checkStats.progressPct}%`, height: "100%", background: BRAND, transition: "width .3s" }} />
                </div>
                <div style={{ fontSize: ".78rem", color: "#7a8699", marginTop: 4 }}>
                  נפדו {ils(checkStats.cashedSum)} מתוך {ils(checkStats.planTotal)} · {checkStats.progressPct}% מתכנית השיקים
                </div>
              </div>
            )}
          </div>
        )}

        {/* עורך שיקים — זמין רק לחבר עם הלוואה פעילה (כל השיקים הם לפירעון חוב) */}
        {(member.loan_balance ?? 0) > 0 ? (
        <div className="no-print" style={{ padding: "0.75rem 1.25rem 1rem", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
            <div style={{ width: 120 }}>
              <label style={lbl}>סכום לכל שיק ₪</label>
              <input type="number" value={chkMaster.amount} onChange={e => setMasterAmount(e.target.value)} style={inp} placeholder="0" />
            </div>
            <div style={{ width: 150 }}>
              <label style={lbl}>תאריך פירעון (ראשון)</label>
              <DatePicker value={chkMaster.due_date} onChange={setMasterDate} />
            </div>
            <div style={{ width: 100 }}>
              <label style={lbl}>מספר שיקים</label>
              <input type="number" min={0} max={60} value={chkMaster.count} onChange={e => setMasterCount(e.target.value)} style={inp} />
            </div>
            {loans.length > 0 && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={lbl}>{loans.length > 1 ? "לאיזו הלוואה השיקים מיועדים? (חובה)" : "שיוך להלוואה (משיכה)"}</label>
                <select value={chkMaster.loan_transaction_id} onChange={e => setChkMaster(f => ({ ...f, loan_transaction_id: e.target.value }))} style={inp}>
                  {loans.length > 1 && <option value="">— בחר הלוואה —</option>}
                  {loans.map(l => (
                    <option key={l.id} value={l.id}>הלוואה {ils(l.amount)} · {gregOf(l)}{l.notes ? ` · ${l.notes}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ fontSize: ".76rem", color: "#7a8699", marginTop: 6 }}>
            הזן מספר שיקים → ייפתחו שורות לעריכה. הסכום מלמעלה משתכפל לכולן והתאריך נפרס חודש-חודש; אפשר לערוך כל שורה ידנית ואז לשמור.
          </div>
          {(() => {
            const loan = chkMaster.loan_transaction_id ? loans.find(l => l.id === chkMaster.loan_transaction_id) : null;
            if (!loan) return null;
            const existingSum = checks.filter(c => c.loan_transaction_id === loan.id && c.status !== "bounced").reduce((s, c) => s + c.amount, 0);
            const draftsSum = chkDrafts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
            const remaining = loan.amount - existingSum;
            const over = draftsSum > remaining + 0.001;
            return (
              <div style={{ fontSize: ".78rem", marginTop: 4, color: over ? "#c0392b" : "#5a6b7b", fontWeight: over ? 700 : 400 }}>
                הלוואה {ils(loan.amount)} · שויכו כבר {ils(existingSum)} · נותר לשיוך <b>{ils(Math.max(0, remaining))}</b>
                {draftsSum > 0 ? ` · בטיוטה ${ils(draftsSum)}` : ""}{over ? " — חורג מסכום ההלוואה!" : ""}
              </div>
            );
          })()}

          {/* שורות עריכה */}
          {chkDrafts.length > 0 && (
            <div style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1.4fr 1.4fr 36px", gap: 8, background: "#f8fafc", padding: "0.4rem 0.6rem", fontSize: ".74rem", fontWeight: 700, color: "#7a8699" }}>
                <div>#</div><div>סכום ₪</div><div>תאריך פירעון</div><div>הערות</div><div></div>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {chkDrafts.map((d, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1.4fr 1.4fr 36px", gap: 8, alignItems: "center", padding: "0.35rem 0.6rem", borderTop: "1px solid #f0f2f5" }}>
                    <div style={{ fontSize: ".8rem", color: "#9aa5b5", fontWeight: 700 }}>{i + 1}</div>
                    <input type="number" value={d.amount} onChange={e => updateDraft(i, "amount", e.target.value)} style={{ ...inp, padding: "0.35rem 0.5rem" }} />
                    <div>
                      <DatePicker value={d.due_date} onChange={v => updateDraft(i, "due_date", v)} />
                      {d.due_date && <div style={{ fontSize: ".68rem", color: BRAND, marginTop: 2 }}>{toHebrewDate(d.due_date)}</div>}
                    </div>
                    <input value={d.notes} onChange={e => updateDraft(i, "notes", e.target.value)} style={{ ...inp, padding: "0.35rem 0.5rem" }} placeholder="מס' שיק / בנק" />
                    <button onClick={() => removeDraft(i)} title="הסר שורה" style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
            <button onClick={saveChecks} disabled={savingChks || chkDrafts.length === 0} className="btn btn-primary">
              {savingChks ? "שומר…" : `✓ שמור ${chkDrafts.length || ""} שיקים`}
            </button>
            {(() => {
              const total = chkDrafts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
              return total > 0 ? <span style={{ fontSize: ".82rem", color: "#7a8699" }}>סה״כ {ils(total)}</span> : null;
            })()}
          </div>
        </div>
        ) : (
          <div className="no-print" style={{ padding: "0.9rem 1.25rem", color: "#7a8699", fontSize: ".85rem", borderBottom: "1px solid #f0f2f5" }}>
            שיקים זמינים רק לחבר עם הלוואה פעילה (כל השיקים הם לפירעון החוב). כדי להזין שיקים — רשום משיכה (הלוואה) ובחר "אופן החזר → שיקים".
          </div>
        )}

        {checks.length === 0 ? (
          <Empty text="אין שיקים לחבר זה" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>סכום</th>
                  <th>פירעון (לועזי)</th>
                  <th>פירעון (עברי)</th>
                  <th>סטטוס</th>
                  <th>הערות</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {checks.map(c => {
                  const overdue = c.status === "pending" && c.due_date && new Date(c.due_date) <= new Date();
                  return (
                    <tr key={c.id} style={{ background: overdue ? "#fff7ed" : "" }}>
                      <td style={{ fontWeight: 700 }}>
                        {ils(c.amount)}
                        {c.loan_transaction_id && (() => {
                          const l = txns.find(t => t.id === c.loan_transaction_id);
                          return l ? <div style={{ fontSize: ".68rem", color: "#7a8699", fontWeight: 500 }}>↳ הלוואה {ils(l.amount)}</div> : null;
                        })()}
                      </td>
                      <td dir="ltr" style={{ textAlign: "right" }}>{c.due_date ? gdate(c.due_date) : "—"}{overdue ? " ⚠️" : ""}</td>
                      <td>{c.hebrew_due || "—"}</td>
                      <td>
                        <span style={{ color: "#fff", borderRadius: 999, padding: "0.12rem 0.6rem", fontSize: ".76rem", fontWeight: 700, background: c.status === "cashed" ? BRAND : c.status === "bounced" ? "#c0392b" : "#f59e0b" }}>
                          {c.status === "cashed" ? "נפדה" : c.status === "bounced" ? "חזר" : "ממתין"}
                        </span>
                      </td>
                      <td style={{ color: "#7a8699" }}>{c.notes || "—"}</td>
                      <td className="no-print">
                        <div style={{ display: "flex", gap: 6 }}>
                          {c.status === "pending" && (
                            <>
                              <button onClick={() => markCashed(c)} disabled={chkBusy === c.id} className="btn btn-primary btn-sm">נפדה ✓</button>
                              <button onClick={() => markBounced(c)} disabled={chkBusy === c.id} className="btn btn-danger btn-sm">חזר</button>
                            </>
                          )}
                          <button onClick={() => deleteCheck(c)} disabled={chkBusy === c.id} title="מחק שיק" className="btn btn-danger btn-sm">🗑 מחק</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* מודאל עריכה */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 500, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#f59e0b" }}>עריכת פעולה</h2>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={lbl}>סוג</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>אופן</label>
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} style={inp}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>בחר תאריך</label>
                <DatePicker value={form.greg_date} onChange={setGreg} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "שומר…" : "✓ שמור שינויים"}</button>
              <button onClick={() => setEditing(null)} className="btn btn-soft">ביטול</button>
              <button onClick={remove} disabled={saving} className="btn btn-danger" style={{ marginInlineStart: "auto" }}>מחק</button>
            </div>
          </div>
        </div>
      )}

      {/* מודאל הוספת פעולה — החבר ידוע אוטומטית */}
      {addTxn && (
        <div onClick={e => { if (e.target === e.currentTarget) setAddTxn(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 500, padding: "1.75rem", direction: "rtl", animation: "modalIn 0.18s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: BRAND }}>הוספת פעולה</h2>
              <button onClick={() => setAddTxn(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9aa5b5" }}>✕</button>
            </div>
            <div style={{ background: "#f4faf8", borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem", fontSize: ".9rem", border: "1px solid #d7e9e2" }}>
              <span style={{ color: "#7a8699" }}>חבר: </span><strong style={{ color: BRAND }}>{member.name}</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={lbl}>סוג</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TXN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>סכום ₪</label>
                <input type="number" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>אופן</label>
                <select value={addForm.method} onChange={e => setAddForm(f => ({ ...f, method: e.target.value, thirdPartyName: "", thirdPartyMemberId: "", thirdPartyLinkType: "" }))} style={inp}>
                  <option value="">—</option>
                  {TXN_METHODS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {addForm.method === "העברה לצד ג" && (
                <div style={{ gridColumn: "1/-1", background: "#f8f9ff", border: "1.5px solid #d0d8f0", borderRadius: 12, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div style={{ fontSize: ".82rem", fontWeight: 700, color: "#3a4a8c", marginBottom: -4 }}>🔀 פרטי העברה לצד ג׳</div>
                  <div>
                    <label style={lbl}>שם / מטרה (אופציונלי)</label>
                    <input
                      value={addForm.thirdPartyName}
                      onChange={e => setAddForm(f => ({ ...f, thirdPartyName: e.target.value }))}
                      style={inp} placeholder="לדוג׳: סמי כהן, שכ״ד, קנייה..."
                    />
                  </div>
                  <div>
                    <label style={lbl}>שיוך לחבר בגמ״ח (אופציונלי)</label>
                    <select
                      value={addForm.thirdPartyMemberId}
                      onChange={e => setAddForm(f => ({ ...f, thirdPartyMemberId: e.target.value, thirdPartyLinkType: "" }))}
                      style={inp}>
                      <option value="">— ללא שיוך לחבר —</option>
                      {allMembers.filter(m => m.id !== member.id).map(m => (
                        <option key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  {addForm.thirdPartyMemberId && (
                    <div>
                      <label style={lbl}>סוג שיוך לחבר</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[{ val: "loan", label: "💸 הלוואה לחבר" }, { val: "repayment", label: "✅ החזר מחבר" }].map(opt => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setAddForm(f => ({ ...f, thirdPartyLinkType: opt.val }))}
                            style={{ flex: 1, padding: "0.45rem 0.5rem", border: `2px solid ${addForm.thirdPartyLinkType === opt.val ? BRAND : "#d0d8f0"}`, borderRadius: 8, background: addForm.thirdPartyLinkType === opt.val ? BRAND : "#fff", color: addForm.thirdPartyLinkType === opt.val ? "#fff" : "#4a5568", fontWeight: 700, fontSize: ".82rem", cursor: "pointer" }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {addForm.thirdPartyLinkType && (
                        <div style={{ fontSize: ".78rem", color: "#7a8699", marginTop: 5 }}>
                          {addForm.thirdPartyLinkType === "loan"
                            ? `תיווצר משיכה (הלוואה) בכרטסת ${allMembers.find(m => m.id === addForm.thirdPartyMemberId)?.name}`
                            : `תיווצר הפקדה (החזר) בכרטסת ${allMembers.find(m => m.id === addForm.thirdPartyMemberId)?.name}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {addForm.type === "משיכה" && (
                <>
                  {(member.savings_balance ?? 0) > 0 ? (
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={lbl}>סיווג המשיכה</label>
                      <div style={{ fontSize: ".78rem", background: "#f0faf6", border: "1px solid #c6e9d8", borderRadius: 7, padding: "0.35rem 0.6rem", marginBottom: 6, color: BRAND }}>
                        יתרת פיקדון לחבר זה: <strong>{ils(member.savings_balance)}</strong> — בחר האם משיכת פיקדון או הלוואה:
                      </div>
                      <select
                        value={addForm.subtype || "refund"}
                        onChange={e => setAddForm(f => ({ ...f, subtype: e.target.value, repay: e.target.value === "refund" ? "" : f.repay }))}
                        style={inp}>
                        <option value="refund">משיכת פיקדון (החזר חיסכון)</option>
                        <option value="loan">הלוואה חדשה</option>
                      </select>
                    </div>
                  ) : (
                    <div style={{ gridColumn: "1/-1" }}>
                      <div style={{ fontSize: ".78rem", background: "#fef9e7", border: "1px solid #f0d060", borderRadius: 7, padding: "0.4rem 0.7rem", color: "#7a6010" }}>
                        אין יתרת פיקדון — הסיווג אוטומטי: <strong>הלוואה</strong>
                      </div>
                    </div>
                  )}
                  {(addForm.subtype === "loan" || (!addForm.subtype && (member.savings_balance ?? 0) <= 0)) && (
                    <div>
                      <label style={lbl}>אופן החזר ההלוואה</label>
                      <select value={addForm.repay} onChange={e => setAddForm(f => ({ ...f, repay: e.target.value }))} style={inp}>
                        <option value="">— טרם נקבע —</option>
                        <option value="שיקים">שיקים (הזנה מיד)</option>
                        <option value="מזומן">מזומן</option>
                        <option value="העברה">העברה בנקאית</option>
                        <option value="אחר">אחר</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              <div>
                <label style={lbl}>בחר תאריך</label>
                <DatePicker value={addForm.greg_date} onChange={setAddGreg} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>הערות</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
              <button onClick={saveAdd} disabled={savingAdd} className="btn btn-primary">{savingAdd ? "שומר…" : "✓ הוסף פעולה"}</button>
              <button onClick={() => setAddTxn(false)} className="btn btn-soft">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* פופאפ הצלחה ליצירת/עדכון התחברות — נסגר באיטיות כלפי פנים */}
      {loginPopup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(2px)", opacity: loginPopupClosing ? 0 : 1, transition: "opacity .55s ease" }}>
          <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 24px 70px rgba(0,0,0,.25)", width: "100%", maxWidth: 380, padding: "1.8rem", direction: "rtl", textAlign: "center", transform: loginPopupClosing ? "scale(.55)" : "scale(1)", opacity: loginPopupClosing ? 0 : 1, transition: "transform .6s cubic-bezier(.4,0,.2,1), opacity .6s ease" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#e8f5f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <CheckCircle2 size={34} color={BRAND} />
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: BRAND }}>{loginPopup}</div>
          </div>
        </div>
      )}

      {/* טוסט שחזור מחיקה */}
      {undoSnap && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 2000, background: "#1a1a2e", color: "#fff", borderRadius: 12, padding: "0.75rem 1.2rem", boxShadow: "0 8px 32px rgba(0,0,0,.35)", display: "flex", alignItems: "center", gap: 14, direction: "rtl", animation: "modalIn 0.2s ease" }}>
          <span style={{ fontSize: ".9rem" }}>{undoSnap.label}</span>
          <button onClick={restoreDeleted} className="btn btn-primary btn-sm">↩ שחזר</button>
          <button onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoSnap(null); }} style={{ background: "none", border: "none", color: "#9aa5b5", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}>✕</button>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { padding: "0.5rem 0.75rem", border: "1.5px solid #dce1e8", borderRadius: 8, fontSize: ".9rem", width: "100%", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: ".78rem", color: "#7a8699", fontWeight: 600, marginBottom: 4, display: "block" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #eef0f4" }}>
      <span style={{ color: "#7a8699" }}>{label}</span>
      <span dir="auto" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
