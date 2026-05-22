import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** Expo Go–safe fade-in (no Reanimated / Worklets). */
export function FadeInView({ children, delay = 0, style }: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

type ScalePressableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScalePressable({ children, style, ...props }: ScalePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        props.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

type ShimmerBarProps = { width?: number | `${number}%`; height?: number; style?: ViewStyle };

export function ShimmerBar({ width = "100%", height = 8, style }: ShimmerBarProps) {
  const x = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  const translateX = x.interpolate({
    inputRange: [-1, 1],
    outputRange: [-120, 120],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: "rgba(255,255,255,0.25)",
          borderRadius: 999,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: 80,
          height: "100%",
          backgroundColor: "rgba(255,255,255,0.45)",
          transform: [{ translateX }],
        }}
      />
    </Animated.View>
  );
}
