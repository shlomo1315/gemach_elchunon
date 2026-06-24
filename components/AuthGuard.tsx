"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Sidebar from "./Sidebar";
import MemberPortal from "./MemberPortal";

type Theme = "light" | "dark";
type AuthCtx = { user: User | null; logout: () => void; theme: Theme; toggleTheme: () => void };
export const AuthContext = createContext<AuthCtx>({ user: null, logout: () => {}, theme: "light", toggleTheme: () => {} });
export const useAuth = () => useContext(AuthContext);

const BRAND = "#1e6f5c";
const BRAND_DARK = "#16513f";

function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err || !data.user) { setError("אימייל או סיסמה שגויים"); return; }
    onLogin(data.user);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.7rem 1rem",
    border: "1.5px solid #dce1e8", borderRadius: 10,
    fontSize: "1rem", boxSizing: "border-box",
    direction: "ltr", outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1.25rem",
      background: `radial-gradient(1200px 600px at 70% -10%, #2a8a72 0%, transparent 60%), linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 55%, #259f6a 100%)`,
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, padding: "2.75rem 2.5rem",
        width: "100%", maxWidth: 420,
        boxShadow: "0 30px 90px rgba(0,0,0,.35)",
        direction: "rtl",
        animation: "fadeUp .4s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 64, height: 64, margin: "0 auto 1rem", borderRadius: 18,
            background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-.04em",
            boxShadow: "0 10px 24px rgba(30,111,92,.35)",
          }}>חא</div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: BRAND_DARK }}>
            גמ״ח חסדי אהרן
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: ".88rem", color: "#7a8699" }}>
            התחברות למערכת הניהול
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: ".82rem", fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>כתובת מייל</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="user@example.com" required autoFocus />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontSize: ".82rem", fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="••••••••" required />
          </div>

          {error && (
            <div style={{ background: "#fde8e8", color: "#c0392b", borderRadius: 8, padding: "0.6rem 0.9rem", fontSize: ".85rem", marginBottom: "1rem", textAlign: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="ui-btn" style={{
            width: "100%", padding: "0.8rem",
            background: loading ? "#9aa5b5" : `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 100%)`,
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: "1rem", fontWeight: 700,
            boxShadow: loading ? "none" : "0 8px 22px rgba(30,111,92,.3)",
          }}>
            {loading ? "מתחבר…" : "כניסה למערכת"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SplashCard({ user, onDone }: { user: User; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "משתמש";

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), 2200);
    const t2 = setTimeout(onDone, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.5s ease",
      pointerEvents: "none",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 20,
        padding: "2.5rem 3rem",
        boxShadow: "0 24px 80px rgba(0,0,0,.25)",
        textAlign: "center",
        direction: "rtl",
        minWidth: 320,
        animation: "modalIn 0.25s ease",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎉</div>
        <div style={{ fontSize: "1.3rem", fontWeight: 800, color: BRAND_DARK, marginBottom: "0.4rem" }}>
          שלום, {name}!
        </div>
        <div style={{ fontSize: "1rem", color: "#4a5568", lineHeight: 1.6 }}>
          ברוכים הבאים<br />
          לתוכנת ניהול גמ״ח חסדי אהרן
        </div>
        <div style={{ marginTop: "1.25rem", height: 4, background: "#eef0f4", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: BRAND, borderRadius: 2, animation: "splashBar 2.2s linear forwards" }} />
        </div>
      </div>
    </div>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [showSplash, setShowSplash] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("gemach_theme") : null;
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("gemach_theme", theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "light" ? "dark" : "light"));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // זיהוי תפקיד: אם המייל של המשתמש משויך לחבר → פורטל חבר (קריאה בלבד), אחרת מנהל
  useEffect(() => {
    let cancelled = false;
    if (!user?.email) { setMemberId(null); setRoleResolved(true); return; }
    setRoleResolved(false);
    (async () => {
      try {
        const { data } = await supabase
          .from("members")
          .select("id")
          .ilike("email", user.email!)
          .maybeSingle();
        if (!cancelled) setMemberId(data?.id ?? null);
      } catch {
        if (!cancelled) setMemberId(null);
      } finally {
        if (!cancelled) setRoleResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setMemberId(null);
  }

  function handleLogin(u: User) {
    setUser(u);
    setShowSplash(true);
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f7fb" }}>
        <div style={{ color: BRAND, fontSize: "1rem", fontWeight: 600 }}>טוען…</div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;

  // המתנה לזיהוי תפקיד לפני הצגת ממשק
  if (!roleResolved) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f7fb" }}>
        <div style={{ color: BRAND, fontSize: "1rem", fontWeight: 600 }}>טוען…</div>
      </div>
    );
  }

  // חבר רגיל → פורטל אישי לצפייה בלבד
  if (memberId) {
    return (
      <AuthContext.Provider value={{ user, logout, theme, toggleTheme }}>
        <MemberPortal memberId={memberId} logout={logout} />
      </AuthContext.Provider>
    );
  }

  // מנהל → המערכת המלאה
  return (
    <AuthContext.Provider value={{ user, logout, theme, toggleTheme }}>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", filter: showSplash ? "blur(5px)" : "none", transition: "filter 0.4s" }}>
        <Sidebar />
        <main className="app-main" style={{ flex: 1, padding: "1.5rem", overflowX: "auto", overflowY: "auto" }}>
          {children}
        </main>
      </div>
      {showSplash && <SplashCard user={user} onDone={() => setShowSplash(false)} />}
    </AuthContext.Provider>
  );
}
