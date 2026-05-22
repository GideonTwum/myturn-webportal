import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, ShieldCheck } from "lucide-react-native";
import {
  GlassHeader,
  GradientButton,
  OtpInputRow,
  PremiumCard,
  PremiumScreen,
} from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { FadeInView } from "@/components/premium/motion";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { useMemberGroups } from "@/hooks/useMemberQueries";
import {
  clearOtpSession,
  getOtpDebugCode,
  getOtpPhone,
  setOtpSession,
} from "@/lib/onboarding-storage";
import { maskPhone, normalizePhoneForApi } from "@/lib/phone";
import { useDemoOptional } from "@/providers/DemoProvider";
import { useAuth } from "@/providers/AuthProvider";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

function paramString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default function OtpScreen() {
  const router = useRouter();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string | string[] }>();
  const demo = useDemoOptional();
  const { signInWithOtp, requestOtp } = useAuth();
  const groupsQuery = useMemberGroups(!IS_MOCK_UI);
  const [phone, setPhone] = useState(paramString(phoneParam));
  const [stagingCode, setStagingCode] = useState<string | null>(null);
  const phoneMasked = demo?.user.phoneMasked ?? maskPhone(phone);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(59);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (IS_MOCK_UI) return;
    (async () => {
      const stored = await getOtpPhone();
      const debug = await getOtpDebugCode();
      if (stored) setPhone(stored);
      else if (phoneParam) setPhone(paramString(phoneParam));
      if (debug) setStagingCode(debug);
    })();
  }, [phoneParam]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function verify() {
    const otp = code.replace(/\s/g, "").trim();
    if (otp.length < 6) return;
    setError(null);
    if (IS_MOCK_UI) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        router.replace("/(onboarding)/group-preview");
      }, 1600);
      return;
    }
    const canonical = phone ? normalizePhoneForApi(phone) : "";
    if (!canonical) {
      setError("Phone number missing — go back and send code again.");
      return;
    }
    setLoading(true);
    try {
      await signInWithOtp(canonical, otp);
      await clearOtpSession();
      setSuccess(true);
      const memberships = (await groupsQuery.refetch()).data?.memberships ?? [];
      setTimeout(() => {
        setSuccess(false);
        if (memberships.length > 0) {
          router.replace("/(main)/home");
        } else {
          router.replace("/(onboarding)/group-preview");
        }
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (seconds > 0 || IS_MOCK_UI || !phone) return;
    setError(null);
    try {
      const canonical = normalizePhoneForApi(phone);
      const res = await requestOtp(canonical);
      if (res.debugCode) {
        setStagingCode(res.debugCode);
        await setOtpSession(canonical, res.debugCode);
      }
      setSeconds(59);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend");
    }
  }

  return (
    <PremiumScreen header={<GlassHeader showBack onBack={() => router.back()} />}>
      <IconCircle icon={ShieldCheck} size={64} iconSize="xxl" style={styles.iconWrap} />
      <Text style={styles.h1}>Verify your account</Text>
      <Text style={styles.sub}>
        We've sent a 6-digit code to <Text style={styles.bold}>{phoneMasked}</Text>
      </Text>

      <PremiumCard>
        <OtpInputRow value={code} onChange={setCode} />
        {stagingCode && !IS_MOCK_UI ? (
          <Text style={styles.staging}>Staging code: {stagingCode}</Text>
        ) : null}
        <Pressable onPress={resend}>
          <Text style={styles.resend}>
            {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, "0")}` : "Resend New Code"}
          </Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GradientButton
          label={loading ? "Verifying…" : "Verify & Continue"}
          onPress={verify}
          style={{ marginTop: 16 }}
          disabled={loading}
        />
        {loading ? <ActivityIndicator style={{ marginTop: 12 }} color={tokens.colors.primary} /> : null}
      </PremiumCard>

      <Modal visible={success} transparent animationType="fade">
        <View style={styles.overlay}>
          <FadeInView style={styles.successCard}>
            <PremiumIcon icon={CheckCircle2} size="display" color={tokens.colors.primary} />
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successBody}>Your identity has been verified. Welcome to the circle.</Text>
          </FadeInView>
        </View>
      </Modal>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignSelf: "center", marginBottom: 16 },
  h1: {
    fontFamily: fonts.display,
    fontSize: 26,
    textAlign: "center",
    color: tokens.colors.onSurface,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 24,
  },
  bold: { fontFamily: fonts.label, color: tokens.colors.onSurface },
  staging: {
    textAlign: "center",
    marginTop: 12,
    fontFamily: fonts.label,
    fontSize: 14,
    color: tokens.colors.tertiary,
  },
  resend: {
    textAlign: "center",
    marginTop: 16,
    fontFamily: fonts.label,
    fontSize: 14,
    color: tokens.colors.primary,
  },
  error: { textAlign: "center", marginTop: 8, fontFamily: fonts.bodyMedium, fontSize: 13, color: tokens.colors.error },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(249,249,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    gap: 8,
  },
  successTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: tokens.colors.onSurface,
  },
  successBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: tokens.colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 4,
  },
});
