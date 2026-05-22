import { StyleSheet, Text, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { colors } from "@/constants/theme";

type Step = { id: string; label: string; complete: boolean; current?: boolean };

type Props = { steps: Step[] };

export function ProgressSteps({ steps }: Props) {
  return (
    <View style={styles.row}>
      {steps.map((s, i) => (
        <View key={s.id} style={styles.item}>
          <View
            style={[
              styles.dot,
              s.complete && styles.dotDone,
              s.current && styles.dotCurrent,
            ]}
          >
            {s.complete ? (
              <PremiumIcon icon={Check} size="xs" color={colors.white} strokeWidth={2.5} />
            ) : s.current ? (
              <PremiumIcon icon={ChevronRight} size="xs" color={colors.white} />
            ) : (
              <Text style={styles.dotNum}>{i + 1}</Text>
            )}
          </View>
          <Text
            style={[
              styles.label,
              s.complete && styles.labelDone,
              s.current && styles.labelCurrent,
            ]}
            numberOfLines={1}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginBottom: 16 },
  item: { flex: 1, alignItems: "center" },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dotDone: { backgroundColor: colors.green },
  dotCurrent: { backgroundColor: colors.greenDark },
  dotNum: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  label: { fontSize: 10, color: colors.textMuted, textAlign: "center" },
  labelDone: { color: colors.text, fontWeight: "600" },
  labelCurrent: { color: colors.text, fontWeight: "700" },
});
