import { StyleSheet, Text, View } from "react-native";
import { PremiumIcon, type LucideIconComponent } from "./PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  icon: LucideIconComponent;
  title: string;
  body: string;
  iconColor?: string;
};

export function FeatureRow({ icon, title, body, iconColor = tokens.colors.primary }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <PremiumIcon icon={icon} size="md" color={iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.colors.primaryFixed + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  title: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.onSurface, marginBottom: 4 },
  body: { fontFamily: fonts.bodyMedium, fontSize: 13, color: tokens.colors.onSurfaceVariant, lineHeight: 18 },
});
