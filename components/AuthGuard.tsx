"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Sidebar from "./Sidebar";

type AuthCtx = { user: User | null; logout: () => void };
export const AuthContext = createContext<AuthCtx>({ user: null, logout: () => {} });
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
    border: "1.5px solid #d8dde5", borderRadius: 10,
    fontSize: "1rem", boxSizing: "border-box",
    direction: "ltr", outline: "none",
    transition: "border-color .15s",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 50%, #2ecc71 100%)`,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "2.5rem",
        width: "100%", maxWidth: 420,
        boxShadow: "0 24px 80px rgba(0,0,0,.25)",
        direction: "rtl",
      }}>
        {/* לוגו */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: `linear-gradient(135deg, ${BRAND} 0%, #2ecc71 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem", fontSize: "1.8rem",
          }}>✡</div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: BRAND_DARK }}>
            גמ״ח חסדי אהרן
          </h1>
          <p style={{ margin: "0.3rem 0 0", color: "#9aa5b5", fontSize: ".85rem" }}>
            מערכת ניהול פנימית
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: ".82rem", fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>
              כתובת מייל
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={inp} placeholder="user@example.com" required autoFocus />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontSize: ".82rem", fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>
              סיסמה
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={inp} placeholder="••••••••" required />
          </div>

          {error && (
            <div style={{
              background: "#fde8e8", color: "#c0392b", borderRadius: 8,
              padding: "0.6rem 0.9rem", fontSize: ".85rem", marginBottom: "1rem",
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "0.75rem",
            background: loading ? "#9aa5b5" : `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 100%)`,
            color: "#fff", border: "none", borderRadius: 10,
            fontSize: "1rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            transition: "opacity .15s",
          }}>
            {loading ? "מתחבר…" : "כניסה למערכת"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SplashScreen({ user, onDone }: { user: User; onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "משתמש";

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1800);
    const t2 = setTimeout(onDone, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 60%, #2ecc71 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "1.25rem",
      opacity: fading ? 0 : 1,
      transition: "opacity 0.6s ease",
      pointerEvents: "none",
    }}>
      <div style={{ fontSize: "3rem" }}>✡</div>
      <div style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 800, textAlign: "center", letterSpacing: ".5px" }}>
        גמ״ח חסדי אהרן
      </div>
      <div style={{ color: "rgba(255,255,255,.75)", fontSize: "1rem" }}>
        ברוכים הבאים, <strong style={{ color: "#fff" }}>{name}</strong>
      </div>
      <div style={{ width: 48, height: 4, background: "rgba(255,255,255,.35)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#fff", borderRadius: 2, animation: "splashBar 1.8s linear forwards" }} />
      </div>
    </div>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [showSplash, setShowSplash] = useState(false);

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

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
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

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {showSplash && <SplashScreen user={user} onDone={() => setShowSplash(false)} />}
      <div style={{ display: "flex", minHeight: "100vh", filter: showSplash ? "blur(6px)" : "none", transition: "filter .3s" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "1.5rem", overflowX: "auto" }}>
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
