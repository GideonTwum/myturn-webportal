import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActivityItem } from "@/mock-data";
import { activityIconMap } from "@/components/icons/maps";
import { IconCircle } from "@/components/icons/IconCircle";
import { FadeInView } from "./motion";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = { item: ActivityItem; index?: number; onPress?: () => void };

export function ActivityCard({ item, index = 0, onPress }: Props) {
  const highlight = item.highlight;
  const Icon = activityIconMap[item.type];

  return (
    <FadeInView delay={index * 80}>
      <Pressable
        onPress={onPress}
        style={[styles.card, highlight && styles.cardHighlight]}
      >
        <IconCircle
          icon={Icon}
          highlight={highlight}
          color={highlight ? tokens.colors.onTertiaryContainer : tokens.colors.primary}
        />
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={[styles.title, highlight && styles.titleLight]}>{item.title}</Text>
            <Text style={[styles.time, highlight && styles.timeLight]}>{item.time}</Text>
          </View>
          <Text style={[styles.desc, highlight && styles.descLight]}>{item.body}</Text>
        </View>
      </Pressable>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    marginBottom: 12,
  },
  cardHighlight: {
    backgroundColor: tokens.colors.tertiaryContainer,
  },
  body: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: tokens.colors.onSurface,
    flex: 1,
  },
  titleLight: { color: tokens.colors.onTertiaryContainer },
  time: { fontFamily: fonts.bodyMedium, fontSize: 11, color: tokens.colors.onSurfaceVariant },
  timeLight: { color: tokens.colors.onTertiaryContainer, opacity: 0.8 },
  desc: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: tokens.colors.onSurfaceVariant,
  },
  descLight: { color: tokens.colors.onTertiaryContainer, opacity: 0.9 },
});
