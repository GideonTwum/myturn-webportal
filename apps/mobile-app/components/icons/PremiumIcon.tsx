import { useEffect, useRef, type ComponentType } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import type { LucideProps } from "lucide-react-native";
import { iconSizes, iconStroke, type IconSizeKey } from "@/constants/icon-sizes";

export type LucideIconComponent = ComponentType<LucideProps>;

type Props = {
  icon: LucideIconComponent;
  size?: IconSizeKey | number;
  color?: string;
  strokeWidth?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  /** Subtle fade-in on mount (Expo Go safe). */
  animateIn?: boolean;
};

export function PremiumIcon({
  icon: Icon,
  size = "md",
  color,
  strokeWidth = iconStroke.default,
  opacity = 1,
  style,
  animateIn = false,
}: Props) {
  const dim = typeof size === "number" ? size : iconSizes[size];
  const fade = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(animateIn ? 0.92 : 1)).current;

  useEffect(() => {
    if (!animateIn) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [animateIn, fade, scale]);

  return (
    <Animated.View style={[{ opacity: fade, transform: [{ scale }] }, style]}>
      <Icon size={dim} color={color} strokeWidth={strokeWidth} opacity={opacity} />
    </Animated.View>
  );
}
