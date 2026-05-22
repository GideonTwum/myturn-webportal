import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  EmptyState,
  GlassHeader,
  HealthScoreRing,
  PremiumCard,
  PremiumScreen,
} from "@/components/premium";
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
    <PremiumScreen tabBar header={<GlassHeader title="MyTurn" />}>
      {isLoading && !IS_MOCK_UI ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: 24 }} />
      ) : null}
      {groups.length === 0 ? (
        <EmptyState
          title="Start your journey today"
          body="Join your first group to start saving together."
          primaryLabel="Explore Groups"
          secondaryLabel="Enter Group Code"
          onPrimary={() => router.push("/invite/DEMO2024")}
        />
      ) : (
        groups.map((g) => (
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
        ))
      )}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: fonts.display, fontSize: 18, color: tokens.colors.onSurface },
  meta: { fontFamily: fonts.body, fontSize: 13, color: tokens.colors.onSurfaceVariant, marginTop: 4 },
});
