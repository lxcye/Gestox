"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { setSyncUserId, pullAll } from "@/lib/sync";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REMEMBER_KEY = "gestox_remember_me";
const SESSION_ACTIVE_KEY = "gestox_session_active";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sb = getSupabase();

    // Restore session from Supabase (persisted in localStorage by default)
    sb.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (s) {
        // Check "remember me" — if not remembered and new browser session, sign out
        const remember = localStorage.getItem(REMEMBER_KEY) === "true";
        const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === "1";
        if (!remember && !sessionActive) {
          await sb.auth.signOut();
          setLoading(false);
          return;
        }
        setSession(s);
        setUser(s.user);
        setSyncUserId(s.user.id);
        sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
        await pullAll();
      }
      setLoading(false);
    });

    const { data: listener } = sb.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setSyncUserId(s.user.id);
        sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
        if (event === "SIGNED_IN") await pullAll();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string, rememberMe: boolean) {
    const sb = getSupabase();
    localStorage.setItem(REMEMBER_KEY, String(rememberMe));
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signUp(email: string, password: string) {
    const sb = getSupabase();
    const { error } = await sb.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    const sb = getSupabase();
    sessionStorage.removeItem(SESSION_ACTIVE_KEY);
    await sb.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
