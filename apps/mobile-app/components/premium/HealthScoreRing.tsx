import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = { score: number; size?: number; label?: string };

export function HealthScoreRing({ score, size = 72, label = "HEALTH" }: Props) {
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.inner, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }]}>
        <Text style={styles.score}>{score}</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 4,
    borderColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surfaceContainerLow,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "800",
    color: tokens.colors.primary,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 8,
    fontWeight: "700",
    color: tokens.colors.primary,
    letterSpacing: 0.8,
  },
});
