import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Rocket } from "lucide-react-native";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { notificationIconMap } from "@/components/icons/maps";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { notificationsToFeed } from "@/lib/activity-mapper";
import { useMemberNotifications } from "@/hooks/useMemberQueries";
import { mockNotifications } from "@/mock-data";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function NotificationsScreen() {
  const router = useRouter();
  const { data, isLoading } = useMemberNotifications(!IS_MOCK_UI);
  const items = IS_MOCK_UI
    ? mockNotifications
    : notificationsToFeed(data?.notifications ?? []);

  return (
    <PremiumScreen header={<GlassHeader showBack title="Notifications" onBack={() => router.back()} />}>
      <Text style={styles.sub}>Stay updated with your circle movements and payout schedules.</Text>
      {isLoading && !IS_MOCK_UI ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginBottom: 16 }} />
      ) : null}
      {items.length === 0 && !isLoading ? (
        <Text style={styles.empty}>No notifications yet — activity will appear after payments.</Text>
      ) : null}
      {items.map((n) => {
        const Icon = notificationIconMap[n.category];
        return (
          <PremiumCard key={n.id} style={styles.card} animate={false}>
            <View style={styles.row}>
              <IconCircle icon={Icon} iconSize="lg" color={tokens.colors.primary} />
              <View style={{ flex: 1 }}>
                <View style={styles.top}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.time}>{n.time}</Text>
                </View>
                <Text style={styles.body}>{n.body}</Text>
                {n.actionLabel ? (
                  <Pressable style={styles.action} onPress={() => router.push("/(main)/groups")}>
                    <Text style={styles.actionText}>{n.actionLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </PremiumCard>
        );
      })}
      {IS_MOCK_UI ? (
        <PremiumCard style={styles.promo} animate={false}>
          <View style={styles.promoHead}>
            <IconCircle
              icon={Rocket}
              size={40}
              iconSize="md"
              color={tokens.colors.onPrimary}
              backgroundColor="rgba(255,255,255,0.15)"
            />
            <Text style={styles.promoTitle}>New Circle Alert!</Text>
          </View>
          <Text style={styles.promoBody}>
            A high-yield Executive circle just opened in your region.
          </Text>
          <GradientButton label="Explore Circles" variant="ghost" />
        </PremiumCard>
      ) : null}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.body, fontSize: 15, color: tokens.colors.onSurfaceVariant, marginBottom: 16 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onSurfaceVariant, marginBottom: 16 },
  card: { marginBottom: 12 },
  row: { flexDirection: "row", gap: 12 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.onSurface, flex: 1 },
  time: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 20,
  },
  action: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
  },
  actionText: { fontFamily: fonts.label, fontSize: 12, color: tokens.colors.onPrimary },
  promo: {
    marginTop: 16,
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  promoHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  promoTitle: { fontFamily: fonts.display, fontSize: 20, color: tokens.colors.onPrimary },
  promoBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onPrimary,
    opacity: 0.9,
    marginVertical: 8,
  },
});
