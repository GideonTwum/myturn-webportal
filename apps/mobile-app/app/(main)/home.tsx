import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Calendar, TrendingUp, Users } from "lucide-react-native";
import {
  ActivityCard,
  ContributionProgress,
  GlassHeader,
  GradientButton,
  PremiumCard,
  PremiumScreen,
  TrustBadge,
} from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { ScalePressable } from "@/components/premium/motion";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { notificationsToActivity } from "@/lib/activity-mapper";
import { formatGhs, healthScoreFromProgress } from "@/lib/format-money";
import {
  useMemberGroups,
  useMemberNotifications,
  useTrustProfile,
} from "@/hooks/useMemberQueries";
import { mockActivities } from "@/mock-data";
import { useDemoOptional } from "@/providers/DemoProvider";
import { useAuth } from "@/providers/AuthProvider";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function HomeScreen() {
  const router = useRouter();
  const demo = useDemoOptional();
  const { user: authUser, token } = useAuth();
  const trustQuery = useTrustProfile(Boolean(token) && !IS_MOCK_UI);
  const groupsQuery = useMemberGroups(Boolean(token) && !IS_MOCK_UI);
  const notificationsQuery = useMemberNotifications(Boolean(token) && !IS_MOCK_UI);

  const primaryGroup = groupsQuery.data?.memberships[0];
  const unread = (notificationsQuery.data?.notifications ?? []).filter((n) => !n.read).length;

  const displayUser = IS_MOCK_UI && demo
    ? demo.user
    : {
        firstName: authUser?.firstName ?? "Member",
        lastName: authUser?.lastName ?? "",
        contributionStreak: {
          current: trustQuery.data?.trust.contributionStreak ?? 0,
          total: Math.max(trustQuery.data?.trust.contributionStreak ?? 0, 10),
        },
      };

  const activities = IS_MOCK_UI
    ? mockActivities.slice(0, 2)
    : notificationsToActivity(notificationsQuery.data?.notifications ?? []).slice(0, 2);

  const healthScore = primaryGroup
    ? healthScoreFromProgress(primaryGroup.paidDayCount, primaryGroup.expectedDayCount)
    : 98;

  function contribute() {
    if (IS_MOCK_UI) {
      router.push("/payment");
      return;
    }
    if (!primaryGroup?.contributionId) {
      router.push("/(main)/groups");
      return;
    }
    router.push({
      pathname: "/payment",
      params: {
        contributionId: primaryGroup.contributionId,
        amount: primaryGroup.contributionAmount,
        groupName: primaryGroup.groupName,
      },
    });
  }

  return (
    <PremiumScreen
      tabBar
      header={
        <GlassHeader
          title="MyTurn"
          right={
            <ScalePressable onPress={() => router.push("/notifications")} style={styles.bellBtn}>
              <PremiumIcon icon={Bell} size="lg" color={tokens.colors.onSurface} />
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              ) : null}
            </ScalePressable>
          }
        />
      }
    >
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayUser.firstName[0]}</Text>
        </View>
        <View>
          <Text style={styles.name}>
            {displayUser.firstName} {displayUser.lastName}
          </Text>
          <TrustBadge
            label={
              trustQuery.data?.unlocks.ghanaCardVerified || IS_MOCK_UI
                ? "Verified Member"
                : "Verification in progress"
            }
            verified={Boolean(trustQuery.data?.unlocks.ghanaCardVerified) || IS_MOCK_UI}
            variant="chip"
          />
        </View>
      </View>

      <PremiumCard animate={false} style={{ padding: 0, overflow: "hidden" }}>
        <LinearGradient
          colors={[tokens.colors.primary, tokens.colors.primaryContainer]}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>
            {primaryGroup ? primaryGroup.groupName : "Your next milestone"}
          </Text>
          <Text style={styles.heroDays}>
            {primaryGroup
              ? `${primaryGroup.remainingDays} days left in cycle`
              : "Join a circle"}
          </Text>
          <View style={styles.heroChip}>
            <PremiumIcon icon={Calendar} size="sm" color={tokens.colors.onPrimary} />
            <Text style={styles.heroChipText}>
              {primaryGroup?.payoutPositionLabel ?? "Complete onboarding to contribute"}
            </Text>
          </View>
          <View style={styles.heroFooter}>
            <View>
              <Text style={styles.heroMeta}>Contribution</Text>
              <Text style={styles.heroAmount}>
                {primaryGroup ? formatGhs(primaryGroup.contributionAmount) : "—"}
              </Text>
            </View>
            <View style={styles.heroBar}>
              <View
                style={[
                  styles.heroBarFill,
                  {
                    width: primaryGroup
                      ? `${Math.min(100, (primaryGroup.paidDayCount / Math.max(1, primaryGroup.expectedDayCount)) * 100)}%`
                      : "20%",
                  },
                ]}
              />
            </View>
          </View>
        </LinearGradient>
      </PremiumCard>

      <View style={styles.statsRow}>
        <PremiumCard style={styles.statCard}>
          <ContributionProgress
            current={displayUser.contributionStreak.current}
            total={displayUser.contributionStreak.total}
          />
        </PremiumCard>
        <PremiumCard style={styles.statCard}>
          <PremiumIcon icon={Users} size="lg" color={tokens.colors.tertiary} />
          <Text style={styles.healthPct}>{healthScore}%</Text>
          <Text style={styles.healthLabel}>Contribution progress</Text>
          <View style={styles.healthTrack}>
            <View style={[styles.healthFill, { width: `${healthScore}%` }]} />
          </View>
          <View style={styles.healthMetaRow}>
            <PremiumIcon icon={TrendingUp} size="xs" color={tokens.colors.tertiary} />
            <Text style={styles.healthMeta}>Backend-synced</Text>
          </View>
        </PremiumCard>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.section}>Community Activity</Text>
        <Pressable onPress={() => router.push("/(main)/activity")}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>
      {notificationsQuery.isLoading && !IS_MOCK_UI ? (
        <ActivityIndicator color={tokens.colors.primary} />
      ) : (
        activities.map((item, i) => <ActivityCard key={item.id} item={item} index={i} />)
      )}

      <GradientButton label="Contribute via MoMo" onPress={contribute} style={{ marginTop: 8 }} />
      <Text style={styles.ctaHint}>
        {IS_MOCK_UI
          ? "UI-only demo"
          : trustQuery.data?.unlocks.canContribute
            ? "Payments recorded on backend · dashboards sync ~15s"
            : "Complete Ghana Card verification to contribute"}
      </Text>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: fonts.label, fontSize: 9, color: "#fff" },
  profileRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokens.colors.primary,
  },
  avatarText: { fontFamily: fonts.label, color: tokens.colors.onPrimary, fontSize: 18 },
  name: { fontFamily: fonts.label, fontSize: 15, color: tokens.colors.onSurface },
  hero: { padding: 20 },
  heroLabel: { fontFamily: fonts.label, fontSize: 13, color: tokens.colors.primaryFixed, opacity: 0.9 },
  heroDays: {
    fontFamily: fonts.displayExtra,
    fontSize: 28,
    color: tokens.colors.onPrimary,
    marginVertical: 8,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.12)",
    padding: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  heroChipText: { fontFamily: fonts.label, fontSize: 12, color: tokens.colors.onPrimary },
  heroFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20 },
  heroMeta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: "rgba(255,255,255,0.8)" },
  heroAmount: { fontFamily: fonts.display, fontSize: 22, color: tokens.colors.onPrimary },
  heroBar: {
    width: 96,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  heroBarFill: { height: "100%", backgroundColor: tokens.colors.secondaryContainer },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statCard: { flex: 1 },
  healthPct: { fontFamily: fonts.display, fontSize: 28, color: tokens.colors.tertiary, marginTop: 4 },
  healthLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
  healthTrack: {
    height: 6,
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: 3,
    marginTop: 8,
    overflow: "hidden",
  },
  healthFill: { height: "100%", backgroundColor: tokens.colors.tertiary },
  healthMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  healthMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: tokens.colors.tertiary,
  },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, marginBottom: 8 },
  section: { fontFamily: fonts.display, fontSize: 20, color: tokens.colors.onSurface },
  link: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.primary },
  ctaHint: {
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 12,
    paddingHorizontal: 24,
  },
});
