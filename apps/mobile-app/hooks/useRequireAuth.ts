import { type Href, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { setAuthRedirect } from "@/lib/auth-intent";
import { useAuth } from "@/providers/AuthProvider";

export type AuthMode = "login" | "signup";

export function useIsAuthenticated(): boolean {
  const { token } = useAuth();
  return IS_MOCK_UI || Boolean(token);
}

export function useRequireAuth() {
  const router = useRouter();
  const { token } = useAuth();
  const isAuthenticated = IS_MOCK_UI || Boolean(token);
  const [promptVisible, setPromptVisible] = useState(false);
  const redirectRef = useRef<string | undefined>(undefined);

  const closePrompt = useCallback(() => setPromptVisible(false), []);

  const startAuth = useCallback(
    async (mode: AuthMode, redirectTo?: string) => {
      setPromptVisible(false);
      if (redirectTo) await setAuthRedirect(redirectTo);
      router.push({
        pathname: "/(onboarding)/phone",
        params: {
          mode,
          ...(redirectTo ? { redirectTo } : {}),
        },
      } as Href);
    },
    [router],
  );

  const promptAuth = useCallback((redirectTo?: string) => {
    redirectRef.current = redirectTo;
    setPromptVisible(true);
  }, []);

  /** Returns true if the action may proceed; otherwise opens the auth prompt. */
  const requireAuth = useCallback(
    (redirectTo?: string): boolean => {
      if (isAuthenticated) return true;
      promptAuth(redirectTo);
      return false;
    },
    [isAuthenticated, promptAuth],
  );

  const onLogin = useCallback(
    () => void startAuth("login", redirectRef.current),
    [startAuth],
  );

  const onSignUp = useCallback(
    () => void startAuth("signup", redirectRef.current),
    [startAuth],
  );

  return {
    isAuthenticated,
    promptVisible,
    closePrompt,
    promptAuth,
    requireAuth,
    startAuth,
    onLogin,
    onSignUp,
  };
}
