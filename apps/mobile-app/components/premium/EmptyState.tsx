import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { emptyStateIcons } from "@/components/icons/maps";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { GradientButton } from "./GradientButton";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  title: string;
  body: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

export function EmptyState({
  title,
  body,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: Props) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 1500, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.grid, { transform: [{ translateY: float }] }]}>
        {emptyStateIcons.map((Icon, i) => (
          <View key={i} style={[styles.tile, i % 2 === 1 && styles.tileAlt]}>
            <PremiumIcon
              icon={Icon}
              size="xxl"
              color={tokens.colors.primary}
              opacity={0.85}
              animateIn
            />
          </View>
        ))}
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {primaryLabel ? (
        <GradientButton label={primaryLabel} onPress={onPrimary} style={{ marginTop: 20, width: "100%" }} />
      ) : null}
      {secondaryLabel ? (
        <GradientButton
          label={secondaryLabel}
          variant="ghost"
          onPress={onSecondary}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 32 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 200,
    gap: 12,
    marginBottom: 24,
    justifyContent: "center",
  },
  tile: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: tokens.colors.primaryFixedDim + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  tileAlt: { backgroundColor: tokens.colors.secondaryFixed + "55" },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: tokens.colors.onSurface,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 320,
  },
});
