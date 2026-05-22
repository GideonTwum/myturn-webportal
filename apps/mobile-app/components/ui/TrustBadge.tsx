import { StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Circle } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { colors } from "@/constants/theme";

type Props = {
  label: string;
  verified?: boolean;
};

export function TrustBadge({ label, verified = true }: Props) {
  return (
    <View style={[styles.badge, verified ? styles.ok : styles.pending]}>
      <PremiumIcon
        icon={verified ? CheckCircle2 : Circle}
        size="xs"
        color={verified ? colors.success : colors.textMuted}
      />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  ok: { backgroundColor: colors.greenLight },
  pending: { backgroundColor: colors.yellowSoft },
  text: { fontSize: 13, fontWeight: "600", color: colors.text },
});
