import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mockInviteGroup, mockUser, type MockGroup, type MockUser } from "@/mock-data";

export type OnboardingStep =
  | "splash"
  | "invite"
  | "phone"
  | "otp"
  | "group-preview"
  | "ghana-card"
  | "verification-pending"
  | "main";

type DemoState = {
  user: MockUser;
  group: MockGroup;
  onboardingComplete: boolean;
  ghanaCardVerified: boolean;
  pendingInviteCode: string | null;
  setPendingInviteCode: (code: string | null) => void;
  completeOnboarding: () => void;
  setGhanaCardVerified: (v: boolean) => void;
  updatePhone: (phone: string) => void;
};

const DemoContext = createContext<DemoState | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser>(mockUser);
  const [group] = useState<MockGroup>(mockInviteGroup);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [ghanaCardVerified, setGhanaCardVerified] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>("DEMO2024");

  const completeOnboarding = useCallback(() => setOnboardingComplete(true), []);

  const updatePhone = useCallback((phone: string) => {
    const digits = phone.replace(/\D/g, "").slice(-2);
    setUser((u) => ({
      ...u,
      phone,
      phoneMasked: `+233 ••• ••${digits}`,
    }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      group,
      onboardingComplete,
      ghanaCardVerified,
      pendingInviteCode,
      setPendingInviteCode,
      completeOnboarding,
      setGhanaCardVerified,
      updatePhone,
    }),
    [user, group, onboardingComplete, ghanaCardVerified, pendingInviteCode, completeOnboarding, updatePhone],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** Returns null when DemoProvider is not mounted (connected mode). */
export function useDemoOptional() {
  return useContext(DemoContext);
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
