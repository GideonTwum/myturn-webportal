import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { LockKeyhole } from "lucide-react-native";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { InlineHint } from "@/components/icons/InlineHint";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { setOtpSession } from "@/lib/onboarding-storage";
import { normalizePhoneForApi } from "@/lib/phone";
import { useDemoOptional } from "@/providers/DemoProvider";
import { useAuth } from "@/providers/AuthProvider";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";
import { APP_BRAND, APP_DISPLAY_NAME } from "@/constants/app-brand";

export default function PhoneScreen() {
  const router = useRouter();
  const demo = useDemoOptional();
  const { requestOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setError(null);
    setDebugCode(null);
    if (IS_MOCK_UI && demo) {
      demo.updatePhone(phone);
      router.push({ pathname: "/(onboarding)/otp", params: { phone } });
      return;
    }
    setLoading(true);
    try {
      const canonical = normalizePhoneForApi(phone);
      const res = await requestOtp(phone);
      if (res.debugCode) setDebugCode(res.debugCode);
      await setOtpSession(canonical, res.debugCode);
      router.push({ pathname: "/(onboarding)/otp", params: { phone: canonical } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PremiumScreen header={<GlassHeader showBack onBack={() => router.back()} />}>
      <View style={styles.progress}>
        <View style={[styles.dot, styles.dotOn]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <IconCircle icon={LockKeyhole} size={56} iconSize="xl" style={styles.iconWrap} />
      <Text style={styles.h1}>Welcome to {APP_DISPLAY_NAME}</Text>
      <Text style={styles.sub}>Join our premium savings community. Your growth journey starts here.</Text>

      <PremiumCard>
        <Text style={styles.label}>PHONE NUMBER</Text>
        <View style={styles.inputRow}>
          <View style={styles.flag}>
            <Text style={styles.flagText}>+233</Text>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="024 000 0000"
            placeholderTextColor={tokens.colors.outline + "88"}
            editable={!loading}
          />
        </View>
        <InlineHint>We'll send a secure OTP to verify your number.</InlineHint>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {debugCode ? (
          <Text style={styles.debug}>Staging OTP: {debugCode}</Text>
        ) : null}
        <GradientButton
          label={loading ? "Sending…" : "Send Code"}
          onPress={sendCode}
          style={{ marginTop: 16 }}
          disabled={loading}
        />
        {loading ? <ActivityIndicator style={{ marginTop: 12 }} color={tokens.colors.primary} /> : null}
      </PremiumCard>
      <Text style={styles.footer}>Secure encryption powered by {APP_BRAND}</Text>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", gap: 6, marginBottom: 24 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: tokens.colors.outlineVariant + "55" },
  dotOn: { backgroundColor: tokens.colors.primary },
  iconWrap: { alignSelf: "flex-start", marginBottom: 16 },
  h1: { fontFamily: fonts.display, fontSize: 28, color: tokens.colors.onSurface },
  sub: {
    fontFamily: fonts.body,
    fontSize: 17,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 24,
    maxWidth: 320,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: tokens.colors.primary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  flag: { paddingRight: 10, borderRightWidth: 1, borderRightColor: tokens.colors.outlineVariant },
  flagText: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.onSurface },
  input: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    paddingVertical: 16,
    paddingLeft: 12,
    color: tokens.colors.onSurface,
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: tokens.colors.error, marginTop: 8 },
  debug: { fontFamily: fonts.label, fontSize: 12, color: tokens.colors.tertiary, marginTop: 8 },
  footer: {
    textAlign: "center",
    marginTop: 24,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    opacity: 0.6,
  },
});
