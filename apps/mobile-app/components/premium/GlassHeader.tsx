import { useRouter } from "expo-router";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ChevronLeft, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { ScalePressable } from "./motion";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";
import { APP_BRAND } from "@/constants/app-brand";

type Props = {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  brandOnly?: boolean;
  style?: ViewStyle;
  onBack?: () => void;
  /** Close affordance (X) instead of back chevron when both needed — use `right` for custom. */
  closeAction?: () => void;
};

export function GlassHeader({
  title = APP_BRAND,
  showBack,
  right,
  brandOnly,
  style,
  onBack,
  closeAction,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }, style]}>
      <View style={styles.left}>
        {showBack ? (
          <ScalePressable
            onPress={onBack ?? (() => router.back())}
            style={styles.iconBtn}
          >
            <PremiumIcon icon={ChevronLeft} size="lg" color={tokens.colors.onSurface} />
          </ScalePressable>
        ) : null}
        <Text style={styles.brand}>{brandOnly ? APP_BRAND : title}</Text>
      </View>
      {right ??
        (closeAction ? (
          <ScalePressable onPress={closeAction} style={styles.iconBtn}>
            <PremiumIcon icon={X} size="md" color={tokens.colors.onSurfaceVariant} />
          </ScalePressable>
        ) : (
          <View style={{ width: 40 }} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.mobile,
    paddingBottom: 12,
    backgroundColor: tokens.colors.surface + "F2",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  brand: {
    fontFamily: fonts.displayExtra,
    fontSize: 20,
    color: tokens.colors.primary,
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
});
