import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ticket } from "lucide-react-native";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { API_BASE_URL } from "@/constants/config";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { normalizeInviteCode } from "@/lib/invite-code";
import { setPendingInviteCode } from "@/lib/invite-storage";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function EnterInviteCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");

  async function continueWithCode() {
    const normalized = normalizeInviteCode(code);
    if (!normalized) return;
    await setPendingInviteCode(normalized);
    if (IS_MOCK_UI) {
      router.push(`/invite/${normalized}`);
      return;
    }
    router.push(`/invite/${encodeURIComponent(normalized)}`);
  }

  return (
    <PremiumScreen header={<GlassHeader showBack title="Join a circle" />}>
      <IconCircle icon={Ticket} size={56} iconSize="xl" style={{ marginBottom: 16 }} />
      <Text style={styles.h1}>Enter invite code</Text>
      <Text style={styles.sub}>
        Use the code from your admin dashboard (e.g. MT-4ESF). Do not activate the group until
        members have joined.
      </Text>
      <PremiumCard>
        <Text style={styles.label}>INVITE CODE</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="MT-XXXX"
          placeholderTextColor={tokens.colors.outline + "99"}
        />
        <GradientButton label="Continue" onPress={continueWithCode} style={{ marginTop: 16 }} />
      </PremiumCard>
      {!IS_MOCK_UI ? (
        <Text style={styles.apiHint}>API: {API_BASE_URL || "(not set)"}</Text>
      ) : null}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 26, color: tokens.colors.onSurface },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 20,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: tokens.colors.primary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 2,
    padding: 16,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceContainerLow,
    color: tokens.colors.onSurface,
  },
  apiHint: {
    marginTop: 16,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: tokens.colors.onSurfaceVariant,
    textAlign: "center",
  },
});
