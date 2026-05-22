import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { CreditCard, Lock, User } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import {
  GlassHeader,
  GradientButton,
  PremiumCard,
  PremiumScreen,
  ProgressTracker,
} from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { useSubmitGhanaCard, useTrustProfile } from "@/hooks/useMemberQueries";
import { useDemoOptional } from "@/providers/DemoProvider";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function GhanaCardScreen() {
  const router = useRouter();
  const demo = useDemoOptional();
  const trustQuery = useTrustProfile(!IS_MOCK_UI);
  const submit = useSubmitGhanaCard();
  const [id, setId] = useState("GHA-000000000-0");
  const [error, setError] = useState<string | null>(null);

  const steps =
    trustQuery.data?.onboardingSteps ??
    [
      { id: "1", label: "Card ID", complete: false },
      { id: "2", label: "Selfie", complete: false },
      { id: "3", label: "Review", complete: false },
    ];
  const currentStep = steps.findIndex((s) => !s.complete) + 1 || 1;

  async function onSubmit() {
    setError(null);
    if (IS_MOCK_UI && demo) {
      demo.setGhanaCardVerified(true);
      router.replace("/(onboarding)/verification-pending");
      return;
    }
    try {
      await submit.mutateAsync({ ghanaCardNumber: id.trim() });
      router.replace("/(onboarding)/verification-pending");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    }
  }

  return (
    <PremiumScreen header={<GlassHeader showBack title="MyTurn" />}>
      <ProgressTracker steps={steps} currentStep={currentStep} />

      <PremiumCard>
        <View style={styles.titleRow}>
          <PremiumIcon icon={CreditCard} size="md" color={tokens.colors.primary} />
          <Text style={styles.cardTitle}>Ghana Card Details</Text>
        </View>
        <Text style={styles.cardSub}>Enter your official NIA identification number</Text>
        <Text style={styles.label}>Card ID Number</Text>
        <TextInput
          style={styles.input}
          value={id}
          onChangeText={setId}
          autoCapitalize="characters"
          placeholder="GHA-000000000-0"
          placeholderTextColor={tokens.colors.outline + "99"}
          editable={!submit.isPending}
        />
        <View style={styles.lockRow}>
          <PremiumIcon icon={Lock} size="sm" color={tokens.colors.onSurfaceVariant} />
          <Text style={styles.lockNote}>
            Your data is encrypted and shared only for verification. We never store full card details on device.
          </Text>
        </View>
      </PremiumCard>

      <PremiumCard variant="flat" style={{ marginTop: 16 }}>
        <Text style={styles.selfieTitle}>Selfie Verification</Text>
        <Text style={styles.selfieSub}>Take a clear photo to confirm your identity.</Text>
        <View style={styles.selfieRing}>
          <IconCircle
            icon={User}
            size={96}
            iconSize="hero"
            color={tokens.colors.primary}
            backgroundColor="transparent"
          />
        </View>
        <GradientButton label="Take Photo (optional staging)" variant="ghost" />
        <Text style={styles.tip}>Face forward · Well lit · Remove glasses if possible</Text>
      </PremiumCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {trustQuery.data?.stagingRelaxTrust ? (
        <Text style={styles.relax}>Staging: trust gates relaxed for demo testing.</Text>
      ) : null}

      <GradientButton
        label={submit.isPending ? "Submitting…" : "Submit for review"}
        onPress={onSubmit}
        style={{ marginTop: 24 }}
        disabled={submit.isPending}
      />
      {submit.isPending ? <ActivityIndicator style={{ marginTop: 12 }} color={tokens.colors.primary} /> : null}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontFamily: fonts.display, fontSize: 20, color: tokens.colors.onSurface },
  cardSub: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onSurfaceVariant, marginVertical: 8 },
  label: { fontFamily: fonts.label, fontSize: 13, color: tokens.colors.onSurfaceVariant, marginTop: 8 },
  input: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 1,
    padding: 16,
    marginTop: 8,
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    borderColor: tokens.colors.outlineVariant,
    backgroundColor: tokens.colors.surfaceContainerLow,
    color: tokens.colors.onSurface,
  },
  lockRow: { flexDirection: "row", gap: 8, marginTop: 16, alignItems: "flex-start" },
  lockNote: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  selfieTitle: { fontFamily: fonts.display, fontSize: 18, color: tokens.colors.onSurface },
  selfieSub: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onSurfaceVariant, marginVertical: 8 },
  selfieRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: tokens.colors.primary + "44",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  tip: { fontFamily: fonts.bodyMedium, fontSize: 12, color: tokens.colors.onSurfaceVariant, marginTop: 12, textAlign: "center" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: tokens.colors.error, marginTop: 12 },
  relax: { fontFamily: fonts.label, fontSize: 12, color: tokens.colors.tertiary, marginTop: 8 },
});
