import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/constants/theme";

export function StagingBanner({ message }: { message?: string }) {
  if (!__DEV__) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Testing mode</Text>
      <Text style={styles.body}>
        {message ??
          "Trust checks are relaxed — walk through each step; Ghana Card auto-approves on submit."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  title: { fontWeight: "800", color: colors.text, marginBottom: 4 },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
