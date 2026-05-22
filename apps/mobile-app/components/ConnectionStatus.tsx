import { Pressable, StyleSheet, Text, View } from "react-native";
import { RefreshCw, WifiOff } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { useApiHealth } from "@/hooks/useApiHealth";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

/** Shown when API is unreachable — retry refreshes health + member data. */
export function ConnectionStatus() {
  const health = useApiHealth();
  const qc = useQueryClient();

  if (IS_MOCK_UI || !health.isError) return null;

  return (
    <View style={styles.wrap}>
      <PremiumIcon icon={WifiOff} size="sm" color={tokens.colors.onErrorContainer} />
      <Text style={styles.text}>Cannot reach API. Check network and EXPO_PUBLIC_API_URL.</Text>
      <Pressable
        onPress={() => {
          void health.refetch();
          void qc.invalidateQueries();
        }}
        style={styles.retry}
      >
        <PremiumIcon icon={RefreshCw} size="sm" color={tokens.colors.primary} />
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    backgroundColor: tokens.colors.errorContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    color: tokens.colors.onErrorContainer,
  },
  retry: { flexDirection: "row", alignItems: "center", gap: 4 },
  retryText: {
    fontFamily: fonts.label,
    fontSize: 11,
    color: tokens.colors.primary,
  },
});
