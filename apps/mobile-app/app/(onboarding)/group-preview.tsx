import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Lock, User } from "lucide-react-native";
import {
  GlassHeader,
  GradientButton,
  HealthScoreRing,
  PremiumCard,
  PremiumScreen,
  VerificationBanner,
} from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs, healthScoreFromProgress } from "@/lib/format-money";
import { useMemberGroups, useTrustProfile } from "@/hooks/useMemberQueries";
import { useDemoOptional } from "@/providers/DemoProvider";
import { mockActiveGroup } from "@/mock-data";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function GroupPreviewScreen() {
  const router = useRouter();
  const demo = useDemoOptional();
  const trustQuery = useTrustProfile(!IS_MOCK_UI);
  const groupsQuery = useMemberGroups(!IS_MOCK_UI);

  const apiGroup = groupsQuery.data?.memberships[0];
  const ghanaVerified =
    IS_MOCK_UI && demo
      ? demo.ghanaCardVerified
      : Boolean(trustQuery.data?.unlocks.ghanaCardVerified);
  const canContribute = trustQuery.data?.unlocks.canContribute ?? IS_MOCK_UI;

  const group = IS_MOCK_UI
    ? mockActiveGroup
    : apiGroup
      ? {
          name: apiGroup.groupName,
          description: "Your active savings circle on MyTurn.",
          totalPayout: parseFloat(apiGroup.contributionAmount) * apiGroup.memberSlots,
          contributionAmount: parseFloat(apiGroup.contributionAmount),
          memberCount: apiGroup.turnOrder,
          memberSlots: apiGroup.memberSlots,
          healthScore: healthScoreFromProgress(apiGroup.paidDayCount, apiGroup.expectedDayCount),
          adminName: "Circle Admin",
          adminCycles: apiGroup.currentCycle,
          nextPayoutDate: `${apiGroup.remainingDays} days`,
        }
      : mockActiveGroup;

  if (!IS_MOCK_UI && groupsQuery.isLoading) {
    return (
      <PremiumScreen header={<GlassHeader showBack />}>
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: 40 }} />
      </PremiumScreen>
    );
  }

  return (
    <PremiumScreen header={<GlassHeader showBack />}>
      {!ghanaVerified ? (
        <VerificationBanner onAction={() => router.push("/(onboarding)/ghana-card")} />
      ) : null}

      <PremiumCard style={{ marginTop: 16 }}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chip}>Active Circle</Text>
            <Text style={styles.name}>{group.name}</Text>
            <Text style={styles.desc}>{group.description}</Text>
          </View>
          <HealthScoreRing score={group.healthScore} />
        </View>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>CONTRIBUTION</Text>
            <Text style={[styles.cellValue, { color: tokens.colors.secondary }]}>
              {formatGhs(group.contributionAmount)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>MEMBERS</Text>
            <Text style={styles.cellValue}>
              {group.memberCount} / {group.memberSlots}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>CYCLE</Text>
            <Text style={styles.cellValue}>{apiGroup?.currentCycle ?? "—"}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>REMAINING</Text>
            <Text style={styles.cellValue}>{apiGroup?.remainingDays ?? group.nextPayoutDate}</Text>
          </View>
        </View>
      </PremiumCard>

      <Text style={styles.section}>Circle Leadership</Text>
      <PremiumCard variant="flat">
        <View style={styles.adminRow}>
          <PremiumIcon icon={User} size="md" color={tokens.colors.primary} />
          <Text style={styles.admin}>{group.adminName}</Text>
        </View>
        <View style={styles.adminMetaRow}>
          <PremiumIcon icon={CheckCircle2} size="xs" color={tokens.colors.primary} />
          <Text style={styles.adminMeta}>Verified admin · staging</Text>
        </View>
      </PremiumCard>

      {!ghanaVerified && !trustQuery.data?.stagingRelaxTrust ? (
        <View style={styles.locked}>
          <Text style={styles.section}>Payout Schedule</Text>
          <View style={styles.lockOverlay}>
            <Text style={styles.lockTitle}>Schedule Locked</Text>
            <Text style={styles.lockBody}>Verify your ID to see exactly when it will be your turn.</Text>
          </View>
        </View>
      ) : null}

      <GradientButton
        label={
          apiGroup || IS_MOCK_UI
            ? ghanaVerified || canContribute
              ? "Go to home"
              : "Continue — Ghana Card"
            : "Join a group"
        }
        onPress={() => {
          if (apiGroup && (ghanaVerified || canContribute)) {
            router.replace("/(main)/home");
          } else if (ghanaVerified) {
            router.push("/(onboarding)/join");
          } else {
            router.push("/(onboarding)/ghana-card");
          }
        }}
        style={{ marginTop: 20 }}
      />
      {!apiGroup && !IS_MOCK_UI ? (
        <GradientButton
          label="Join with invite code"
          variant="ghost"
          onPress={() => router.push("/(onboarding)/join")}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  chip: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: tokens.colors.onTertiaryFixed,
    backgroundColor: tokens.colors.tertiaryFixed,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
  },
  name: { fontFamily: fonts.display, fontSize: 22, color: tokens.colors.onSurface },
  desc: { fontFamily: fonts.body, fontSize: 13, color: tokens.colors.onSurfaceVariant, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: {
    width: "48%",
    backgroundColor: tokens.colors.surfaceContainerLow,
    padding: 12,
    borderRadius: 12,
  },
  cellLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: tokens.colors.onSurfaceVariant },
  cellValue: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: tokens.colors.onSurface },
  section: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: tokens.colors.onSurface,
    marginTop: 20,
    marginBottom: 10,
  },
  adminRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  admin: { fontFamily: fonts.label, fontSize: 16, color: tokens.colors.onSurface },
  adminMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  adminMeta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: tokens.colors.onSurfaceVariant },
  locked: { position: "relative", marginTop: 8 },
  lockOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 24,
    gap: 8,
  },
  lockTitle: { fontFamily: fonts.display, fontSize: 16, color: tokens.colors.onSurface },
  lockBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 220,
  },
});
