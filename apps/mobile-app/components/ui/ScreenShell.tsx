import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, spacing } from "@/constants/theme";
import { APP_BRAND } from "@/constants/app-brand";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ScreenShell({ title, subtitle, children }: Props) {
  return (
    <View style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.brand}>{APP_BRAND}</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  header: { marginBottom: spacing.lg },
  brand: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.green,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
});
