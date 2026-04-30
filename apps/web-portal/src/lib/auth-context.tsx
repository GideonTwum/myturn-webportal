"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { UserRole } from "@myturn/shared";
import {
  apiFetch,
  clearSession,
  getStoredToken,
  setSession,
} from "./api";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Store session from join or member phone login (temporary web member flow). */
  applyMemberSession: (accessToken: string, user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("myturn_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        clearSession();
      }
    }
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{
      access_token: string;
      user: AuthUser;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(res.access_token, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const applyMemberSession = useCallback(
    (accessToken: string, nextUser: AuthUser) => {
      setSession(accessToken, JSON.stringify(nextUser));
      setUser(nextUser);
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      applyMemberSession,
      logout,
    }),
    [user, ready, login, applyMemberSession, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useRequireAuth(redirectTo = "/login") {
  const { user, ready } = useAuth();
  useEffect(() => {
    if (!ready) return;
    if (!getStoredToken() || !user) {
      window.location.href = redirectTo;
    }
  }, [ready, user, redirectTo]);
  return { user, ready };
}
