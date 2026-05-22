import { type Href, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Activity, Home, User, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

const tabs: { href: string; label: string; icon: LucideIcon; segment: string }[] = [
  { href: "/(main)/home", label: "Home", icon: Home, segment: "home" },
  { href: "/(main)/groups", label: "Groups", icon: Users, segment: "groups" },
  { href: "/(main)/activity", label: "Activity", icon: Activity, segment: "activity" },
  { href: "/(main)/profile", label: "Profile", icon: User, segment: "profile" },
];

export function PremiumBottomNav() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const active = String(segments[segments.length - 1] ?? "home");

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const isActive =
            tab.segment === "groups"
              ? active === "groups" || active === "[id]"
              : active === tab.segment;
          return (
            <TabItem
              key={tab.href}
              tab={tab}
              isActive={isActive}
              onPress={() => router.push(tab.href as Href)}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  tab,
  isActive,
  onPress,
}: {
  tab: (typeof tabs)[number];
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1 : 0.92,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [isActive, scale]);

  return (
    <Pressable onPress={onPress} style={styles.tabHit}>
      <Animated.View style={[styles.tab, isActive && styles.tabActive, { transform: [{ scale }] }]}>
        <PremiumIcon
          icon={tab.icon}
          size="md"
          color={isActive ? tokens.colors.onPrimaryContainer : tokens.colors.onSurfaceVariant}
          strokeWidth={isActive ? 2 : 1.75}
        />
        <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
        {isActive ? <View style={styles.indicator} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
  },
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.radius.xl,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tabHit: { flex: 1, alignItems: "center" },
  tab: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.lg,
    minWidth: 64,
    gap: 2,
  },
  tabActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.secondaryContainer,
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: tokens.colors.onSurfaceVariant,
  },
  labelActive: {
    color: tokens.colors.onPrimaryContainer,
    fontFamily: fonts.label,
  },
});
