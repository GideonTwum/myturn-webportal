import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from "react-native";
import { ScalePressable } from "./motion";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
};

export function GradientButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  if (variant === "ghost") {
    return (
      <ScalePressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.ghost, style]}
      >
        <Text style={styles.ghostText}>{label}</Text>
      </ScalePressable>
    );
  }

  const colors: [string, string] =
    variant === "secondary"
      ? [tokens.colors.secondaryContainer, tokens.colors.secondaryFixed]
      : [tokens.colors.primary, tokens.colors.primaryContainer];

  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.wrap, style, disabled && styles.disabled]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        {loading ? (
          <ActivityIndicator color={tokens.colors.onPrimary} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: tokens.radius.pill, overflow: "hidden" },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: tokens.colors.onPrimary,
    fontWeight: "700",
  },
  disabled: { opacity: 0.5 },
  ghost: { paddingVertical: 12, alignItems: "center" },
  ghostText: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: tokens.colors.primary,
  },
});
