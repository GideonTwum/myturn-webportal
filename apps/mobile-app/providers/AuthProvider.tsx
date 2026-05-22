import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSegments } from "expo-router";
import type { AuthUser, OtpRequestResponse } from "@myturn/api-client";
import { resolveAccessToken } from "@myturn/api-client";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { api } from "@/lib/api";
import { normalizePhoneForApi } from "@/lib/phone";
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  setSession,
} from "@/lib/auth-storage";
import { setUnauthorizedHandler } from "@/lib/api";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  applySession: (accessToken: string, authUser: AuthUser) => Promise<void>;
  requestOtp: (phone: string) => Promise<OtpRequestResponse>;
  signInWithOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const signOut = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
    router.replace("/(onboarding)/phone");
  }, [router]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      router.replace("/(onboarding)/phone");
    });
  }, [router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [t, u] = await Promise.all([getStoredToken(), getStoredUser()]);
      if (!mounted) return;
      setToken(t);
      setUser(u);
      setIsLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading || IS_MOCK_UI) return;
    const root = segments[0];
    const publicRoutes = ["invite", "(onboarding)", "index", "payment", "notifications"];
    const inPublic = publicRoutes.includes(String(root));
    if (!token && !inPublic) {
      router.replace("/(onboarding)/phone");
    }
  }, [token, segments, isLoading, router]);

  const applySession = useCallback(async (accessToken: string, authUser: AuthUser) => {
    await setSession(accessToken, authUser);
    setToken(accessToken);
    setUser(authUser);
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const canonical = normalizePhoneForApi(phone);
    return api.auth.otpRequest(canonical);
  }, []);

  const signInWithOtp = useCallback(
    async (phone: string, code: string) => {
      const canonical = normalizePhoneForApi(phone);
      const res = await api.auth.otpVerify(canonical, code.replace(/\s/g, "").trim());
      const accessToken = resolveAccessToken(res);
      await applySession(accessToken, { ...res.user, phone: canonical });
      try {
        const [me, trust] = await Promise.all([
          api.auth.memberMe(),
          api.verification.trustStatus(),
        ]);
        const merged = { ...me, canContribute: trust.unlocks.canContribute };
        await setSession(accessToken, merged);
        setUser(merged);
      } catch {
        /* profile enrichment optional */
      }
    },
    [applySession],
  );

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const me = await api.auth.memberMe();
    const trust = await api.verification.trustStatus();
    await setSession(token, { ...me, ...trust, canContribute: trust.unlocks.canContribute });
    setUser({ ...me, canContribute: trust.unlocks.canContribute });
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      applySession,
      requestOtp,
      signInWithOtp,
      signOut,
      refreshProfile,
    }),
    [token, user, isLoading, applySession, requestOtp, signInWithOtp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
