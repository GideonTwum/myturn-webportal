import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Award, Lock } from "lucide-react-native";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen, TrustBadge } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { profileStatIcons } from "@/components/icons/maps";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { useMemberGroups, useMemberPayouts, useTrustProfile } from "@/hooks/useMemberQueries";
import { mockBadges, mockPayoutHistory } from "@/mock-data";
import { useDemoOptional } from "@/providers/DemoProvider";
import { useAuth } from "@/providers/AuthProvider";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function ProfileScreen() {
  const demo = useDemoOptional();
  const { user, signOut, token } = useAuth();
  const trustQuery = useTrustProfile(Boolean(token) && !IS_MOCK_UI);
  const groupsQuery = useMemberGroups(Boolean(token) && !IS_MOCK_UI);
  const payoutsQuery = useMemberPayouts(Boolean(token) && !IS_MOCK_UI);

  const displayUser = IS_MOCK_UI && demo
    ? demo.user
    : {
        firstName: user?.firstName ?? "Member",
        lastName: user?.lastName ?? "",
        trustScore: trustQuery.data?.trust.trustScore ?? 0,
        memberSince: "MyTurn member",
      };

  const pct = Math.min(100, Math.round((displayUser.trustScore / 1000) * 100));
  const statRows = IS_MOCK_UI
    ? [
        { key: "contributions" as const, v: "12", l: "Contributions" },
        { key: "groups" as const, v: "2", l: "Groups Completed" },
        { key: "paidOut" as const, v: "₵4.2k", l: "Total Paid Out" },
        { key: "onTime" as const, v: "100%", l: "On-time Rate" },
      ]
    : [
        {
          key: "contributions" as const,
          v: String(trustQuery.data?.trust.contributionStreak ?? 0),
          l: "Streak",
        },
        {
          key: "groups" as const,
          v: String(groupsQuery.data?.memberships.length ?? 0),
          l: "Active groups",
        },
        {
          key: "paidOut" as const,
          v: String(payoutsQuery.data?.payouts.filter((p) => p.status === "PAID").length ?? 0),
          l: "Payouts received",
        },
        {
          key: "onTime" as const,
          v: `${trustQuery.data?.trust.missedContributionCount ?? 0} missed`,
          l: "Missed",
        },
      ];

  const payoutHistory = IS_MOCK_UI
    ? mockPayoutHistory
    : (payoutsQuery.data?.payouts ?? []).slice(0, 5).map((p) => ({
        id: p.id,
        group: p.groupName,
        amount: p.amount,
        date: p.paidAt ?? "Upcoming",
        status: p.status,
      }));

  return (
    <PremiumScreen tabBar header={<GlassHeader title="MyTurn" />}>
      <PremiumCard>
        <View style={styles.hero}>
          <View style={styles.scoreRing}>
            <Text style={styles.score}>{displayUser.trustScore}</Text>
            <Text style={styles.scoreLabel}>Trust Score</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {displayUser.firstName} {displayUser.lastName}
            </Text>
            <TrustBadge
              label={trustQuery.data?.unlocks.ghanaCardVerified ? "Verified Status" : "Pending verification"}
              verified={Boolean(trustQuery.data?.unlocks.ghanaCardVerified) || IS_MOCK_UI}
            />
            <Text style={styles.since}>{displayUser.memberSince}</Text>
          </View>
        </View>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${pct}%` }]} />
        </View>
      </PremiumCard>

      <View style={styles.grid}>
        {statRows.map((s) => (
          <PremiumCard key={s.l} style={styles.gridCell} animate={false}>
            <PremiumIcon icon={profileStatIcons[s.key]} size="lg" color={tokens.colors.primary} />
            <Text style={styles.gridValue}>{s.v}</Text>
            <Text style={styles.gridLabel}>{s.l}</Text>
          </PremiumCard>
        ))}
      </View>

      <Text style={styles.section}>Payout History</Text>
      {payoutHistory.map((p) => (
        <PremiumCard key={p.id} variant="flat" style={styles.history} animate={false}>
          <View style={styles.historyRow}>
            <Text style={styles.historyGroup}>{p.group}</Text>
            <Text style={styles.historyAmt}>{p.amount}</Text>
          </View>
          <Text style={styles.historyMeta}>
            {p.date}
            {"status" in p && p.status ? ` · ${p.status}` : ""}
          </Text>
        </PremiumCard>
      ))}

      <Text style={styles.section}>Badges</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {mockBadges.map((b) => (
          <PremiumCard key={b.id} style={styles.badge} animate={false}>
            <IconCircle icon={Award} size={40} iconSize="md" />
            <Text style={styles.badgeTitle}>{b.label}</Text>
          </PremiumCard>
        ))}
      </ScrollView>

      {!IS_MOCK_UI ? (
        <GradientButton label="Sign out" variant="ghost" onPress={() => void signOut()} style={{ marginTop: 24 }} />
      ) : null}
      <View style={styles.secure}>
        <PremiumIcon icon={Lock} size="xs" color={tokens.colors.onSurfaceVariant} />
        <Text style={styles.secureText}>Profile data synced from backend</Text>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", gap: 16, alignItems: "center" },
  scoreRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  score: { fontFamily: fonts.displayExtra, fontSize: 22, color: tokens.colors.primary },
  scoreLabel: { fontFamily: fonts.bodyMedium, fontSize: 9, color: tokens.colors.onSurfaceVariant },
  name: { fontFamily: fonts.display, fontSize: 20, color: tokens.colors.onSurface },
  since: { fontFamily: fonts.body, fontSize: 12, color: tokens.colors.onSurfaceVariant, marginTop: 8 },
  scoreTrack: {
    height: 6,
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: 3,
    marginTop: 16,
    overflow: "hidden",
  },
  scoreFill: { height: "100%", backgroundColor: tokens.colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  gridCell: { width: "48%", gap: 6 },
  gridValue: { fontFamily: fonts.display, fontSize: 20, color: tokens.colors.onSurface },
  gridLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
  section: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: tokens.colors.onSurface,
    marginTop: 20,
    marginBottom: 10,
  },
  history: { marginBottom: 8 },
  historyRow: { flexDirection: "row", justifyContent: "space-between" },
  historyGroup: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.onSurface },
  historyAmt: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.primary },
  historyMeta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: tokens.colors.onSurfaceVariant, marginTop: 4 },
  badge: { width: 120, marginRight: 10, alignItems: "center", gap: 8 },
  badgeTitle: { fontFamily: fonts.label, fontSize: 12, textAlign: "center" },
  secure: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 16 },
  secureText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
});
