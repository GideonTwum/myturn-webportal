import { StyleSheet, Text, View } from "react-native";
import { CheckCircle2, type LucideIcon } from "lucide-react-native";
import { PremiumIcon } from "./PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  children: string;
  icon?: LucideIcon;
  color?: string;
};

export function InlineHint({ children, icon = CheckCircle2, color = tokens.colors.primary }: Props) {
  return (
    <View style={styles.row}>
      <PremiumIcon icon={icon} size="sm" color={color} />
      <Text style={[styles.text, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontFamily: fonts.body, fontSize: 14, flex: 1 },
});
