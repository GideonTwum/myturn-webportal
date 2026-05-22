import { StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Step = { id: string; label: string; complete: boolean };

type Props = {
  steps: Step[];
  currentStep: number;
  title?: string;
};

export function ProgressTracker({ steps, currentStep, title = "Identity Verification" }: Props) {
  const progress = (currentStep / steps.length) * 100;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.step}>
          Step {currentStep} of {steps.length}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.labels}>
        {steps.map((s, i) => (
          <View key={s.id} style={styles.labelRow}>
            {s.complete ? (
              <PremiumIcon icon={Check} size="xs" color={tokens.colors.primary} />
            ) : null}
            <Text
              style={[
                styles.label,
                s.complete && styles.labelDone,
                i + 1 === currentStep && styles.labelCurrent,
              ]}
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: tokens.spacing.section },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: tokens.colors.onSurface,
  },
  step: {
    fontFamily: fonts.label,
    fontSize: 13,
    color: tokens.colors.primary,
  },
  track: {
    height: 8,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: tokens.colors.primary,
    borderRadius: 4,
  },
  labels: { marginTop: 8, gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: tokens.colors.onSurfaceVariant,
  },
  labelDone: { color: tokens.colors.primary },
  labelCurrent: { fontFamily: fonts.label, color: tokens.colors.onSurface },
});
