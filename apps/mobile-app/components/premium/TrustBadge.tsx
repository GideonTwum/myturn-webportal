import { StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Circle } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  label: string;
  verified?: boolean;
  variant?: "pill" | "chip";
};

export function TrustBadge({ label, verified = true, variant = "pill" }: Props) {
  return (
    <View style={[styles.badge, verified ? styles.ok : styles.pending, variant === "chip" && styles.chip]}>
      <PremiumIcon
        icon={verified ? CheckCircle2 : Circle}
        size="xs"
        color={verified ? tokens.colors.primary : tokens.colors.onSecondaryContainer}
        style={styles.icon}
      />
      <Text style={[styles.text, verified ? styles.textOk : styles.textPending]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    alignSelf: "flex-start",
    gap: 4,
  },
  chip: { paddingHorizontal: 10, paddingVertical: 4 },
  icon: { marginRight: 2 },
  ok: { backgroundColor: tokens.colors.primaryFixed + "33" },
  pending: { backgroundColor: tokens.colors.secondaryFixed + "66" },
  text: { fontFamily: fonts.label, fontSize: 12 },
  textOk: { color: tokens.colors.primary },
  textPending: { color: tokens.colors.onSecondaryContainer },
});
