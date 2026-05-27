import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput } from "react-native";
import { UserPlus } from "lucide-react-native";
import { resolveAccessToken } from "@myturn/api-client";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { getPendingInviteCode } from "@/lib/invite-storage";
import { normalizeInviteCode } from "@/lib/invite-code";
import { normalizePhoneForApi } from "@/lib/phone";
import { useJoinGroup } from "@/hooks/useMemberQueries";
import { useDemoOptional } from "@/providers/DemoProvider";
import { useAuth } from "@/providers/AuthProvider";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function JoinGroupScreen() {
  const router = useRouter();
  const demo = useDemoOptional();
  const { user, applySession, refreshProfile } = useAuth();
  const joinMutation = useJoinGroup();
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const code = await getPendingInviteCode();
      if (code) setInviteCode(code);
    })();
    if (user?.firstName) {
      setFullName(`${user.firstName} ${user.lastName ?? ""}`.trim());
    } else if (demo) {
      setFullName(`${demo.user.firstName} ${demo.user.lastName}`);
    }
  }, [user, demo]);

  async function confirmJoin() {
    setError(null);
    if (IS_MOCK_UI && demo) {
      demo.completeOnboarding();
      router.replace("/(main)/home");
      return;
    }
    const phone = user?.phone ?? "";
    if (!inviteCode || !fullName.trim() || !phone) {
      setError("Missing invite code or profile. Sign in again.");
      return;
    }
    try {
      const res = await joinMutation.mutateAsync({
        inviteCode: normalizeInviteCode(inviteCode),
        fullName: fullName.trim(),
        phone: normalizePhoneForApi(phone),
      });
      if (res.access_token && res.user) {
        await applySession(resolveAccessToken(res), res.user as Parameters<typeof applySession>[1]);
      }
      await refreshProfile();
      router.replace("/(main)/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join group");
    }
  }

  return (
    <PremiumScreen header={<GlassHeader showBack />}>
      <IconCircle icon={UserPlus} size={56} iconSize="xl" style={{ marginBottom: 16 }} />
      <Text style={styles.h1}>Join your group</Text>
      <Text style={styles.sub}>One last step to reserve your turn.</Text>
      <PremiumCard>
        <Text style={styles.label}>Invite code</Text>
        <TextInput
          style={styles.input}
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          placeholder="DEMO2024"
          placeholderTextColor={tokens.colors.outline + "99"}
        />
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          placeholderTextColor={tokens.colors.outline + "99"}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GradientButton
          label={joinMutation.isPending ? "Joining…" : "Confirm join"}
          onPress={confirmJoin}
          style={{ marginTop: 16 }}
          disabled={joinMutation.isPending}
        />
        {joinMutation.isPending ? (
          <ActivityIndicator style={{ marginTop: 12 }} color={tokens.colors.primary} />
        ) : null}
      </PremiumCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 26, color: tokens.colors.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 15, color: tokens.colors.onSurfaceVariant, marginBottom: 20 },
  label: { fontFamily: fonts.label, fontSize: 13, color: tokens.colors.onSurfaceVariant, marginTop: 8 },
  input: {
    fontFamily: fonts.body,
    fontSize: 17,
    padding: 14,
    marginTop: 8,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceContainerLow,
    color: tokens.colors.onSurface,
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: tokens.colors.error, marginTop: 8 },
});
