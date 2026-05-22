import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/constants/tokens";

type Props = {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra scroll padding when floating tab bar is visible (main tabs). */
  tabBar?: boolean;
  noPad?: boolean;
  style?: ViewStyle;
};

const TAB_BAR_SCROLL_PAD = 100;

export function PremiumScreen({ children, header, footer, tabBar, noPad, style }: Props) {
  const insets = useSafeAreaInsets();
  const scrollBottom = footer
    ? 120
    : tabBar
      ? insets.bottom + TAB_BAR_SCROLL_PAD
      : insets.bottom + 24;

  return (
    <View style={[styles.root, { paddingBottom: footer ? 0 : insets.bottom }, style]}>
      {header}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          !noPad && { paddingHorizontal: tokens.spacing.mobile },
          { paddingBottom: scrollBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingTop: 8 },
});
