import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Sparkles, Users } from "lucide-react-native";
import { ActivityCard, GlassHeader, PremiumCard, PremiumScreen } from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { notificationsToActivity } from "@/lib/activity-mapper";
import { useMemberNotifications } from "@/hooks/useMemberQueries";
import { mockActivities } from "@/mock-data";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function ActivityScreen() {
  const { data, isLoading } = useMemberNotifications(!IS_MOCK_UI);
  const activities = IS_MOCK_UI
    ? mockActivities
    : notificationsToActivity(data?.notifications ?? []);

  return (
    <PremiumScreen tabBar header={<GlassHeader title="MyTurn" />}>
      <Text style={styles.h1}>Community Pulse</Text>
      <Text style={styles.sub}>See how your circles are growing together.</Text>
      <View style={styles.stats}>
        <PremiumCard style={styles.stat} variant="flat" animate={false}>
          <PremiumIcon icon={Sparkles} size="lg" color={tokens.colors.primary} />
          <Text style={styles.statLabel}>Updates</Text>
          <Text style={styles.statValue}>{activities.length}</Text>
        </PremiumCard>
        <PremiumCard style={styles.stat} variant="flat" animate={false}>
          <PremiumIcon icon={Users} size="lg" color={tokens.colors.secondary} />
          <Text style={styles.statLabel}>Unread</Text>
          <Text style={styles.statValue}>
            {(data?.notifications ?? []).filter((n) => !n.read).length}
          </Text>
        </PremiumCard>
      </View>
      {isLoading && !IS_MOCK_UI ? (
        <ActivityIndicator color={tokens.colors.primary} />
      ) : activities.length === 0 ? (
        <Text style={styles.empty}>No activity yet. Contribute to see live updates.</Text>
      ) : (
        activities.map((item, i) => <ActivityCard key={item.id} item={item} index={i} />)
      )}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 24, color: tokens.colors.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 15, color: tokens.colors.onSurfaceVariant, marginBottom: 16 },
  stats: { flexDirection: "row", gap: 12, marginBottom: 20 },
  stat: { flex: 1, gap: 8 },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: tokens.colors.onSurfaceVariant },
  statValue: { fontFamily: fonts.display, fontSize: 24, color: tokens.colors.onSurface },
  empty: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onSurfaceVariant },
});
