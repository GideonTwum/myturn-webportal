import { StyleSheet, View, type ViewStyle } from "react-native";
import { PremiumIcon, type LucideIconComponent } from "./PremiumIcon";
import { tokens } from "@/constants/tokens";
import type { IconSizeKey } from "@/constants/icon-sizes";

type Props = {
  icon: LucideIconComponent;
  size?: number;
  iconSize?: IconSizeKey | number;
  color?: string;
  backgroundColor?: string;
  highlight?: boolean;
  style?: ViewStyle;
};

export function IconCircle({
  icon,
  size = 48,
  iconSize = "lg",
  color = tokens.colors.primary,
  backgroundColor,
  highlight,
  style,
}: Props) {
  const bg =
    backgroundColor ??
    (highlight ? "rgba(255,255,255,0.2)" : tokens.colors.primaryContainer + "22");

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      <PremiumIcon icon={icon} size={iconSize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
});
