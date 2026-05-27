import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { UserPlus } from "lucide-react-native";
import {
  EmptyState,
  GlassHeader,
  GradientButton,
  HealthScoreRing,
  PremiumCard,
  PremiumScreen,
} from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs, healthScoreFromProgress } from "@/lib/format-money";
import { useMemberGroups } from "@/hooks/useMemberQueries";
import { mockActiveGroup, mockInviteGroup } from "@/mock-data";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function GroupsScreen() {
  const router = useRouter();
  const { data, isLoading } = useMemberGroups(!IS_MOCK_UI);

  const mockGroups = [mockActiveGroup, mockInviteGroup];
  const apiGroups = data?.memberships ?? [];
  const goToJoin = () => {
    if (IS_MOCK_UI) {
      router.push("/invite/DEMO2024");
      return;
    }
    router.push("/invite");
  };

  const groups = IS_MOCK_UI
    ? mockGroups.map((g) => ({
        id: g.id,
        name: g.name,
        contributionAmount: g.contributionAmount,
        memberCount: g.memberCount,
        memberSlots: g.memberSlots,
        healthScore: g.healthScore,
      }))
    : apiGroups.map((m) => ({
        id: m.groupId,
        name: m.groupName,
        contributionAmount: parseFloat(m.contributionAmount),
        memberCount: m.turnOrder,
        memberSlots: m.memberSlots,
        healthScore: healthScoreFromProgress(m.paidDayCount, m.expectedDayCount),
      }));

  return (
    <PremiumScreen tabBar header={<GlassHeader />}>
      {isLoading && !IS_MOCK_UI ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: 24 }} />
      ) : null}
      {groups.length === 0 ? (
        <EmptyState
          title="Start your journey today"
          body="Join your first group to start saving together."
          primaryLabel="Explore Groups"
          secondaryLabel="Enter Group Code"
          onPrimary={goToJoin}
          onSecondary={goToJoin}
        />
      ) : (
        <>
          {groups.map((g) => (
            <Pressable key={g.id} onPress={() => router.push(`/(main)/groups/${g.id}`)}>
              <PremiumCard style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{g.name}</Text>
                    <Text style={styles.meta}>
                      {formatGhs(g.contributionAmount)} · turn {g.memberCount}/{g.memberSlots}
                    </Text>
                  </View>
                  <HealthScoreRing score={g.healthScore} size={56} label="" />
                </View>
              </PremiumCard>
            </Pressable>
          ))}
          <Pressable onPress={goToJoin} style={styles.joinCard}>
            <PremiumCard variant="flat" style={styles.joinCardInner}>
              <View style={styles.joinRow}>
                <View style={styles.joinIcon}>
                  <PremiumIcon icon={UserPlus} size="md" color={tokens.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.joinTitle}>Join another group</Text>
                  <Text style={styles.joinSub}>Enter an invite code from your admin</Text>
                </View>
              </View>
              <GradientButton
                label="Enter invite code"
                variant="secondary"
                onPress={goToJoin}
                style={{ marginTop: 14 }}
              />
            </PremiumCard>
          </Pressable>
        </>
      )}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: fonts.display, fontSize: 18, color: tokens.colors.onSurface },
  meta: { fontFamily: fonts.body, fontSize: 13, color: tokens.colors.onSurfaceVariant, marginTop: 4 },
  joinCard: { marginTop: 8 },
  joinCardInner: { borderStyle: "dashed", borderWidth: 1, borderColor: tokens.colors.outline + "55" },
  joinRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  joinIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.primaryFixedDim + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  joinTitle: { fontFamily: fonts.display, fontSize: 17, color: tokens.colors.onSurface },
  joinSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 2,
  },
});
