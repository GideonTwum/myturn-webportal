import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Calendar, ShieldCheck, TrendingUp, Users } from "lucide-react-native";
import {
  GlassHeader,
  GradientButton,
  HealthScoreRing,
  PayoutTimeline,
  PremiumCard,
  PremiumScreen,
  TrustBadge,
} from "@/components/premium";
import { FeatureRow } from "@/components/icons/FeatureRow";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs, healthScoreFromProgress } from "@/lib/format-money";
import { paramString, normalizeInviteCode } from "@/lib/invite-code";
import { setPendingInviteCode } from "@/lib/invite-storage";
import { useInvitePreview } from "@/hooks/useMemberQueries";
import { API_BASE_URL } from "@/constants/config";
import { useDemoOptional } from "@/providers/DemoProvider";
import { useAuth } from "@/providers/AuthProvider";
import { mockInviteGroup, type PayoutSlot } from "@/mock-data";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function InviteLandingScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const demo = useDemoOptional();
  const { token } = useAuth();
  const inviteCode = normalizeInviteCode(
    paramString(code) || demo?.group.inviteCode || "DEMO2024",
  );
  const previewQuery = useInvitePreview(inviteCode, !IS_MOCK_UI);
  const preview = previewQuery.data;
  const apiError =
    previewQuery.error instanceof Error
      ? previewQuery.error.message
      : previewQuery.isError
        ? "Could not load invite"
        : null;

  const group = IS_MOCK_UI && demo
    ? demo.group
    : preview
      ? {
          name: preview.name,
          description: preview.description ?? "Join this verified savings circle.",
          contributionAmount: parseFloat(preview.contributionAmount),
          contributionLabel: preview.frequency,
          totalPayout:
            parseFloat(preview.contributionAmount) * (preview.groupSize || preview.currentMembers || 12),
          payoutMode: preview.payoutMode,
          memberCount: preview.currentMembers,
          memberSlots: preview.groupSize,
          healthScore: healthScoreFromProgress(preview.currentMembers, preview.groupSize),
          adminName: preview.adminName,
          yourTurnPosition: parseInt(preview.payoutPositionPreview, 10) || preview.currentMembers + 1,
          payoutTimeline: [] as PayoutSlot[],
        }
      : mockInviteGroup;

  async function continueJoin() {
    await setPendingInviteCode(inviteCode);
    if (IS_MOCK_UI && demo) {
      demo.setPendingInviteCode(inviteCode);
      router.push("/(onboarding)/phone");
      return;
    }
    if (token) {
      router.push("/(onboarding)/join");
      return;
    }
    router.push("/(onboarding)/phone");
  }

  return (
    <PremiumScreen
      header={
        <GlassHeader
          closeAction={() => router.replace("/(main)/home")}
        />
      }
      footer={
        <View style={styles.footer}>
          <GradientButton
            label={token ? "Continue to join" : "Continue to Join"}
            onPress={continueJoin}
          />
        </View>
      }
    >
      {previewQuery.isLoading && !IS_MOCK_UI ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 24 }} />
      ) : null}
      {previewQuery.isError && !IS_MOCK_UI ? (
        <Text style={styles.error}>Could not load invite. Check the code and API connection.</Text>
      ) : null}

      <View style={styles.badge}>
        <TrustBadge label="Exclusive Invitation" verified />
      </View>
      <Text style={styles.h1}>You've been invited to join a Susu Circle</Text>
      <Text style={styles.sub}>{group.description}</Text>

      <PremiumCard style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.admin}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {group.adminName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.groupName}>{group.name}</Text>
              <TrustBadge label="Admin Verified" verified variant="chip" />
            </View>
          </View>
          <HealthScoreRing score={group.healthScore} label="SCORE" />
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Contribution</Text>
            <Text style={styles.statValue}>{formatGhs(group.contributionAmount)}</Text>
            <Text style={styles.statHint}>{group.contributionLabel}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Circle size</Text>
            <Text style={[styles.statValue, { color: tokens.colors.primary }]}>
              {group.memberCount}/{group.memberSlots}
            </Text>
            <Text style={styles.statHint}>members</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <PremiumIcon icon={Users} size="sm" color={tokens.colors.onSurfaceVariant} />
          <Text style={styles.meta}>{group.memberCount} members</Text>
          <Text style={styles.metaDot}>·</Text>
          <PremiumIcon icon={Calendar} size="sm" color={tokens.colors.onSurfaceVariant} />
          <Text style={styles.meta}>{group.payoutMode}</Text>
        </View>
      </PremiumCard>

      <Text style={styles.section}>Payout Position Preview</Text>
      <PremiumCard variant="flat">
        <Text style={styles.previewCopy}>
          If you join today, you'll be the{" "}
          <Text style={styles.bold}>{group.yourTurnPosition}th member</Text> in the payout order.
        </Text>
        {group.payoutTimeline.length > 0 ? (
          <PayoutTimeline slots={group.payoutTimeline} />
        ) : (
          <Text style={styles.previewHint}>{preview?.payoutPositionPreview ?? "Position assigned on join"}</Text>
        )}
      </PremiumCard>

      <PremiumCard variant="flat" style={{ marginTop: 12 }}>
        <FeatureRow
          icon={ShieldCheck}
          title="Secure Smart-Lock"
          body="Funds are held in escrow-style protection for guaranteed payouts."
        />
      </PremiumCard>
      <PremiumCard variant="flat" style={{ marginTop: 12 }}>
        <FeatureRow
          icon={TrendingUp}
          title="Community track record"
          body={`${group.adminName}'s circle — verified on MyTurn Susu staging.`}
        />
      </PremiumCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  footer: {
    padding: tokens.spacing.mobile,
    paddingBottom: 24,
    backgroundColor: tokens.colors.surface + "CC",
  },
  error: { fontFamily: fonts.label, fontSize: 15, color: tokens.colors.error, marginBottom: 8 },
  errorHint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 18,
  },
  badge: { marginBottom: 12 },
  h1: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: tokens.colors.onSurface,
    marginBottom: 8,
  },
  sub: { fontFamily: fonts.body, fontSize: 16, color: tokens.colors.onSurfaceVariant, marginBottom: 20 },
  hero: { marginBottom: 24 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  admin: { flexDirection: "row", gap: 12, flex: 1 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokens.colors.primary,
  },
  avatarText: { fontFamily: fonts.label, color: tokens.colors.onPrimary, fontSize: 18 },
  groupName: { fontFamily: fonts.display, fontSize: 20, color: tokens.colors.onSurface },
  stats: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    padding: 12,
    borderRadius: tokens.radius.md,
  },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
  statValue: { fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: tokens.colors.onSurface },
  statHint: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  meta: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onSurfaceVariant },
  metaDot: { color: tokens.colors.onSurfaceVariant, opacity: 0.5 },
  section: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: tokens.colors.onSurface,
    marginBottom: 12,
  },
  previewCopy: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: tokens.colors.onSurfaceVariant,
    marginBottom: 12,
  },
  previewHint: { fontFamily: fonts.bodyMedium, fontSize: 13, color: tokens.colors.onSurfaceVariant },
  bold: { fontFamily: fonts.label, color: tokens.colors.onSurface },
});
