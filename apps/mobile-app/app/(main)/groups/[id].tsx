import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, ShieldCheck } from "lucide-react-native";
import {
  GlassHeader,
  GradientButton,
  HealthScoreRing,
  PremiumCard,
  PremiumScreen,
} from "@/components/premium";
import { FeatureRow } from "@/components/icons/FeatureRow";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs, healthScoreFromProgress } from "@/lib/format-money";
import { useMemberGroup } from "@/hooks/useMemberQueries";
import { mockMarketGroup, mockMembers } from "@/mock-data";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id ?? "");
  const { data: apiGroup, isLoading, isError } = useMemberGroup(groupId, !IS_MOCK_UI);

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

  function openPayment() {
    if (!group || IS_MOCK_UI) {
      router.push("/payment");
      return;
    }
    if (!apiGroup?.contributionId) return;
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

  return (
    <PremiumScreen
      header={<GlassHeader showBack title={g.name} />}
      footer={
        <View style={styles.footer}>
          <GradientButton
            label={
              !IS_MOCK_UI && apiGroup?.contributionStatus === "PAID"
                ? "Contribution up to date"
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
              : "Staging · mock MoMo recorded on backend"}
          </Text>
        </View>
      }
    >
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

      {IS_MOCK_UI ? (
        <>
          <Text style={styles.section}>Member Activity</Text>
          {mockMembers.map((m) => (
            <PremiumCard key={m.id} variant="flat" style={styles.member} animate={false}>
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>{m.initials ?? m.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberDetail}>{m.detail}</Text>
                </View>
                <View
                  style={[
                    styles.status,
                    m.status === "paid" ? styles.statusPaid : styles.statusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      m.status === "paid" ? styles.statusTextPaid : styles.statusTextPending,
                    ]}
                  >
                    {m.status === "paid" ? "Paid" : "Pending"}
                  </Text>
                </View>
              </View>
            </PremiumCard>
          ))}
        </>
      ) : (
        <ScrollView>
          <Text style={styles.section}>Your standing</Text>
          <PremiumCard variant="flat">
            <Text style={styles.standing}>Cycle standing · {apiGroup?.cycleStanding}</Text>
            <Text style={styles.standing}>Status · {apiGroup?.contributionStatus ?? "—"}</Text>
            <Text style={styles.standing}>Group status · {apiGroup?.groupStatus}</Text>
          </PremiumCard>
        </ScrollView>
      )}

      <PremiumCard variant="flat">
        <FeatureRow
          icon={ShieldCheck}
          title="Capital Protection"
          body="Contributions are tracked by the MyTurn ledger — backend is the source of truth."
        />
      </PremiumCard>
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
  section: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: tokens.colors.onSurface,
    marginTop: 20,
    marginBottom: 10,
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
  status: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: tokens.radius.pill },
  statusPaid: { backgroundColor: tokens.colors.primaryFixed + "33" },
  statusPending: { backgroundColor: tokens.colors.surfaceContainer },
  statusText: { fontFamily: fonts.label, fontSize: 12 },
  statusTextPaid: { color: tokens.colors.primary },
  statusTextPending: { color: tokens.colors.onSurfaceVariant },
});
