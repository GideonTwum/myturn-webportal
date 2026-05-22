import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Star } from "lucide-react-native";
import type { PayoutSlot } from "@/mock-data";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = { slots: PayoutSlot[] };

export function PayoutTimeline({ slots }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {slots.map((slot) => {
        const isYou = slot.status === "you";
        const isCurrent = slot.status === "current";
        const isDone = slot.status === "done";
        return (
          <View key={`${slot.position}-${slot.month}`} style={styles.item}>
            <View
              style={[
                styles.dot,
                isYou && styles.dotYou,
                isCurrent && styles.dotCurrent,
                isDone && styles.dotDone,
                slot.status === "upcoming" && styles.dotUpcoming,
              ]}
            >
              {isYou ? (
                <PremiumIcon icon={Star} size="md" color={tokens.colors.onPrimary} strokeWidth={2} />
              ) : (
                <Text
                  style={[
                    styles.dotText,
                    (isYou || isCurrent) && styles.dotTextActive,
                  ]}
                >
                  {slot.position}
                </Text>
              )}
            </View>
            <Text style={[styles.month, isYou && styles.monthYou]}>{slot.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingVertical: 8 },
  item: { alignItems: "center", minWidth: 56 },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  dotYou: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.primaryContainer,
    borderWidth: 0,
  },
  dotCurrent: {
    backgroundColor: tokens.colors.secondaryContainer,
    borderWidth: 2,
    borderColor: tokens.colors.secondary,
  },
  dotDone: { opacity: 0.55 },
  dotUpcoming: { borderStyle: "dashed", borderWidth: 2 },
  dotText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "700",
    color: tokens.colors.onSurfaceVariant,
  },
  dotTextActive: { color: tokens.colors.onPrimary },
  month: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: tokens.colors.onSurfaceVariant,
    textTransform: "uppercase",
  },
  monthYou: { color: tokens.colors.primary, fontWeight: "700" },
});
