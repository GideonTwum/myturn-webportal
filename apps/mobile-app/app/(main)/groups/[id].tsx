import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CheckCircle2, HelpCircle, PartyPopper, ShieldCheck, Users } from "lucide-react-native";
import {
  GlassHeader,
  GradientButton,
  GhanaCardGateModal,
  HealthScoreRing,
  PremiumCard,
  PremiumScreen,
} from "@/components/premium";
import { FeatureRow } from "@/components/icons/FeatureRow";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs, healthScoreFromProgress } from "@/lib/format-money";
import { ghanaCardStatusLabel, needsGhanaCardForContribute } from "@/lib/ghana-card-status";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  useMemberGroup,
  useMemberGroupMembers,
  useTrustProfile,
} from "@/hooks/useMemberQueries";
import { mockMarketGroup, mockMembers } from "@/mock-data";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id, celebrate } = useLocalSearchParams<{ id: string; celebrate?: string }>();
  const groupId = String(id ?? "");
  const showCelebrate = celebrate === "1";
  const [ghanaGateOpen, setGhanaGateOpen] = useState(false);

  const { isAuthenticated } = useRequireAuth();

  useEffect(() => {
    if (!isAuthenticated && !IS_MOCK_UI) {
      router.replace("/(main)/groups");
    }
  }, [isAuthenticated, router]);

  const { data: apiGroup, isLoading, isError } = useMemberGroup(
    groupId,
    isAuthenticated && !IS_MOCK_UI,
  );
  const membersQuery = useMemberGroupMembers(groupId, isAuthenticated && !IS_MOCK_UI);
  const trustQuery = useTrustProfile(isAuthenticated && !IS_MOCK_UI);

  const ghanaStatus = ghanaCardStatusLabel(
    trustQuery.data?.ghanaCardVerificationStatus ?? null,
  );
  const mustVerifyGhana = needsGhanaCardForContribute(
    trustQuery.data?.ghanaCardVerificationStatus,
    trustQuery.data?.unlocks.ghanaCardVerified,
  );

  const group = IS_MOCK_UI
    ? mockMarketGroup
    : apiGroup
      ? {
          name: apiGroup.groupName,
          healthScore: healthScoreFromProgress(apiGroup.paidDayCount, apiGroup.expectedDayCount),
          yourTurnPosition: apiGroup.turnOrder,
          payoutLabel: apiGroup.payoutPositionLabel,
          contributionAmount: apiGroup.contributionAmount,
          paidDays: apiGroup.paidDayCount,
          expectedDays: apiGroup.expectedDayCount,
          remainingDays: apiGroup.remainingDays,
          contributionStatus: apiGroup.contributionStatus,
          contributionId: apiGroup.contributionId,
          canContribute: apiGroup.contributionId != null,
        }
      : null;

  const latestPayoutNotif = useMemo(() => {
    if (!showCelebrate || IS_MOCK_UI) return null;
    return {
      title: "It's Your Turn!!",
      body: `Congratulations on your payout from ${apiGroup?.groupName ?? "your group"}.`,
    };
  }, [showCelebrate, apiGroup?.groupName]);

  function openPayment() {
    if (!group || IS_MOCK_UI) {
      router.push("/payment");
      return;
    }
    if (!apiGroup?.contributionId) return;
    if (mustVerifyGhana) {
      setGhanaGateOpen(true);
      return;
    }
    router.push({
      pathname: "/payment",
      params: {
        contributionId: apiGroup.contributionId,
        amount: apiGroup.contributionAmount,
        groupName: apiGroup.groupName,
      },
    });
  }

  if (!IS_MOCK_UI && isLoading) {
    return (
      <PremiumScreen header={<GlassHeader showBack title="Loading…" />}>
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: 40 }} />
      </PremiumScreen>
    );
  }

  if (!IS_MOCK_UI && (isError || !group)) {
    return (
      <PremiumScreen header={<GlassHeader showBack title="Group" />}>
        <Text style={styles.error}>Could not load group details.</Text>
      </PremiumScreen>
    );
  }

  const g = group!;
  const roster = IS_MOCK_UI ? mockMembers : (membersQuery.data?.members ?? []);
  const summary = membersQuery.data?.summary;

  return (
    <PremiumScreen
      header={<GlassHeader showBack title={g.name} />}
      footer={
        <View style={styles.footer}>
          <GradientButton
            label={
              !IS_MOCK_UI && apiGroup?.contributionStatus === "PAID"
                ? "Contribution up to date"
                : mustVerifyGhana && !IS_MOCK_UI
                  ? "Verify Ghana Card to contribute"
                  : "Contribute via MoMo"
            }
            onPress={openPayment}
            disabled={
              !IS_MOCK_UI &&
              (!apiGroup?.contributionId || apiGroup.contributionStatus === "PAID")
            }
          />
          <Text style={styles.secure}>
            {IS_MOCK_UI
              ? "UI demo"
              : `Ghana Card · ${ghanaStatus} · Staging mock MoMo`}
          </Text>
        </View>
      }
    >
      {!IS_MOCK_UI && apiGroup?.reserveDefaultCoverPrompt?.fullyCovered ? (
        <PremiumCard variant="flat" style={styles.reservePrompt} animate={false}>
          <View style={styles.reservePromptRow}>
            <PremiumIcon icon={HelpCircle} size="md" color={tokens.colors.primary} />
            <Text style={styles.reservePromptText}>
              {apiGroup.reserveDefaultCoverPrompt.message}
            </Text>
          </View>
        </PremiumCard>
      ) : null}

      {latestPayoutNotif ? (
        <PremiumCard style={styles.celebrate} animate={false}>
          <View style={styles.celebrateRow}>
            <PremiumIcon icon={PartyPopper} size="lg" color={tokens.colors.onTertiaryContainer} />
            <View style={{ flex: 1 }}>
              <Text style={styles.celebrateTitle}>{latestPayoutNotif.title}</Text>
              <Text style={styles.celebrateBody}>{latestPayoutNotif.body}</Text>
            </View>
          </View>
        </PremiumCard>
      ) : null}

      <PremiumCard style={{ padding: 0, overflow: "hidden" }}>
        <View style={styles.hero}>
          <View style={styles.chipRow}>
            <PremiumIcon icon={CheckCircle2} size="sm" color={tokens.colors.onPrimaryContainer} />
            <Text style={styles.chip}>Verified Circle</Text>
          </View>
          <Text style={styles.turn}>
            {IS_MOCK_UI
              ? `Your Turn: Cycle ${mockMarketGroup.yourTurnPosition}`
              : `Turn ${"yourTurnPosition" in g ? g.yourTurnPosition : apiGroup?.turnOrder} · ${"payoutLabel" in g ? g.payoutLabel : apiGroup?.payoutPositionLabel}`}
          </Text>
          <Text style={styles.payout}>
            Contribution · {formatGhs("contributionAmount" in g ? g.contributionAmount : apiGroup!.contributionAmount)}
          </Text>
          {!IS_MOCK_UI && apiGroup ? (
            <Text style={styles.progress}>
              Paid {apiGroup.paidDayCount}/{apiGroup.expectedDayCount} days · {apiGroup.remainingDays} remaining
            </Text>
          ) : null}
          <HealthScoreRing score={g.healthScore} size={80} />
        </View>
      </PremiumCard>

      {!IS_MOCK_UI && summary ? (
        <View style={styles.summaryRow}>
          <PremiumCard variant="flat" style={styles.summaryCard} animate={false}>
            <Text style={styles.summaryValue}>{summary.paid}</Text>
            <Text style={styles.summaryLabel}>Paid</Text>
          </PremiumCard>
          <PremiumCard variant="flat" style={styles.summaryCard} animate={false}>
            <Text style={styles.summaryValue}>{summary.pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </PremiumCard>
          <PremiumCard variant="flat" style={styles.summaryCard} animate={false}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Members</Text>
          </PremiumCard>
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <PremiumIcon icon={Users} size="sm" color={tokens.colors.onSurface} />
        <Text style={styles.section}>Contribution status</Text>
      </View>
      {membersQuery.isLoading && !IS_MOCK_UI ? (
        <ActivityIndicator color={tokens.colors.primary} />
      ) : null}
      {(IS_MOCK_UI ? mockMembers : roster).map((m) => {
        const name = "name" in m ? m.name : m.displayName;
        const status = "status" in m ? m.status : m.paymentStatus.toLowerCase();
        const paid = status === "paid" || status === "PAID";
        const overdue = status === "overdue" || status === "OVERDUE";
        return (
          <PremiumCard key={"id" in m ? m.id : m.userId} variant="flat" style={styles.member} animate={false}>
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{name[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {name}
                  {"isYou" in m && m.isYou ? " (You)" : ""}
                </Text>
                <Text style={styles.memberDetail}>
                  {IS_MOCK_UI ? ("detail" in m ? m.detail : "") : `Cycle ${membersQuery.data?.currentCycle ?? "—"}`}
                </Text>
                {!IS_MOCK_UI && "paidDayCount" in m ? (
                  <Text style={styles.memberProgress}>
                    {m.paidDayCount}/{m.expectedDayCount}
                  </Text>
                ) : null}
              </View>
              <View style={styles.statusCol}>
                <View
                  style={[
                    styles.status,
                    paid ? styles.statusPaid : overdue ? styles.statusOverdue : styles.statusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      paid
                        ? styles.statusTextPaid
                        : overdue
                          ? styles.statusTextOverdue
                          : styles.statusTextPending,
                    ]}
                  >
                    {paid ? "Paid" : overdue ? "Overdue" : "Pending"}
                  </Text>
                </View>
              </View>
            </View>
          </PremiumCard>
        );
      })}

      <ScrollView>
        <Text style={styles.section}>Your standing</Text>
        <PremiumCard variant="flat">
          <Text style={styles.standing}>Cycle standing · {apiGroup?.cycleStanding ?? "—"}</Text>
          <Text style={styles.standing}>Status · {apiGroup?.contributionStatus ?? "—"}</Text>
          <Text style={styles.standing}>Group status · {apiGroup?.groupStatus}</Text>
        </PremiumCard>
      </ScrollView>

      <PremiumCard variant="flat">
        <FeatureRow
          icon={ShieldCheck}
          title="Capital Protection"
          body="Contributions are tracked by the MyTurn ledger — backend is the source of truth."
        />
      </PremiumCard>

      <GhanaCardGateModal
        visible={ghanaGateOpen}
        statusLabel={ghanaStatus}
        onClose={() => setGhanaGateOpen(false)}
        onVerify={() => {
          setGhanaGateOpen(false);
          router.push("/(onboarding)/ghana-card");
        }}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.body, fontSize: 15, color: tokens.colors.error, marginTop: 24 },
  footer: {
    padding: tokens.spacing.mobile,
    paddingBottom: 100,
    backgroundColor: tokens.colors.surface + "EE",
  },
  secure: {
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  reservePrompt: { marginBottom: 12 },
  reservePromptRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  reservePromptText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
    lineHeight: 20,
  },
  celebrate: {
    marginBottom: 12,
    backgroundColor: tokens.colors.tertiaryContainer,
    borderColor: tokens.colors.tertiary,
  },
  celebrateRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  celebrateTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: tokens.colors.onTertiaryContainer,
  },
  celebrateBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onTertiaryContainer,
    marginTop: 4,
  },
  hero: {
    backgroundColor: tokens.colors.primaryContainer,
    padding: 20,
    alignItems: "center",
  },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { fontFamily: fonts.label, fontSize: 12, color: tokens.colors.onPrimaryContainer },
  turn: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: tokens.colors.onPrimaryContainer,
    marginTop: 8,
    textAlign: "center",
  },
  payout: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onPrimaryContainer, opacity: 0.9 },
  progress: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: tokens.colors.onPrimaryContainer,
    marginTop: 6,
    textAlign: "center",
  },
  summaryRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 12 },
  summaryValue: { fontFamily: fonts.display, fontSize: 22, color: tokens.colors.primary },
  summaryLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  section: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: tokens.colors.onSurface,
  },
  standing: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onSurfaceVariant, marginBottom: 6 },
  member: { marginBottom: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.secondaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitial: { fontFamily: fonts.label, fontSize: 16, color: tokens.colors.onSecondaryFixed },
  memberName: { fontFamily: fonts.label, fontSize: 15, color: tokens.colors.onSurface },
  memberDetail: { fontFamily: fonts.bodyMedium, fontSize: 12, color: tokens.colors.onSurfaceVariant },
  memberProgress: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: tokens.colors.primary,
    marginTop: 2,
  },
  statusCol: { alignItems: "flex-end" },
  status: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: tokens.radius.pill },
  statusPaid: { backgroundColor: tokens.colors.primaryFixedDim + "33" },
  statusPending: { backgroundColor: tokens.colors.surfaceContainer },
  statusOverdue: { backgroundColor: tokens.colors.errorContainer },
  statusText: { fontFamily: fonts.label, fontSize: 12 },
  statusTextPaid: { color: tokens.colors.primary },
  statusTextPending: { color: tokens.colors.onSurfaceVariant },
  statusTextOverdue: { color: tokens.colors.error },
});
