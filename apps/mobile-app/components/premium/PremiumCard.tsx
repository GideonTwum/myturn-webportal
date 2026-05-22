import { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { FadeInView } from "./motion";
import { tokens } from "@/constants/tokens";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  variant?: "elevated" | "flat" | "glass";
  animate?: boolean;
};

export function PremiumCard({ children, style, variant = "elevated", animate = true }: Props) {
  const inner = (
    <View
      style={[
        styles.base,
        variant === "elevated" && styles.elevated,
        variant === "glass" && styles.glass,
        variant === "flat" && styles.flat,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!animate) return inner;
  return <FadeInView>{inner}</FadeInView>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.md,
  },
  elevated: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  flat: {
    backgroundColor: tokens.colors.surfaceContainerLow,
  },
  glass: {
    backgroundColor: "rgba(255,255,255,0.82)",
  },
});
