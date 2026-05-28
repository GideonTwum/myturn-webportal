import { StyleSheet, Text, View } from "react-native";
import { Flame } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  current: number;
  total: number;
  label?: string;
};

/** Legacy streak ring — use only in MOCK_UI demo; real cycle progress lives on Home stats. */
export function ContributionProgress({ current, total, label = "Demo streak" }: Props) {
  const pct = Math.min(100, Math.round((current / total) * 100));

  return (
    <View style={styles.wrap}>
      <View style={styles.ring}>
        <Text style={styles.fraction}>
          {current}/{total}
        </Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.metaRow}>
        <PremiumIcon icon={Flame} size="xs" color={tokens.colors.primary} />
        <Text style={styles.meta}>Demo only</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 8,
    borderColor: tokens.colors.primaryFixedDim + "44",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  fraction: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "800",
    color: tokens.colors.primary,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
  },
  barTrack: {
    width: "100%",
    height: 6,
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: 3,
    marginTop: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: tokens.colors.primary,
    borderRadius: 3,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  meta: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: tokens.colors.primary,
  },
});
