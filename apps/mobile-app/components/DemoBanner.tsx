import { StyleSheet, Text, View } from "react-native";
import { FlaskConical } from "lucide-react-native";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";
import { PremiumIcon } from "@/components/icons/PremiumIcon";

export function DemoBanner() {
  if (!IS_MOCK_UI) {
    return (
      <View style={styles.staging}>
        <PremiumIcon icon={FlaskConical} size="sm" color={tokens.colors.onTertiaryFixed} />
        <Text style={styles.stagingText}>
          Staging demo · MoMo payments are simulated via the backend
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.mock}>
      <PremiumIcon icon={FlaskConical} size="sm" color={tokens.colors.onSecondaryContainer} />
      <Text style={styles.mockText}>UI-only demo · no live API or payments</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  staging: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tokens.colors.tertiaryFixed + "CC",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stagingText: {
    flex: 1,
    fontFamily: fonts.label,
    fontSize: 11,
    color: tokens.colors.onTertiaryFixed,
  },
  mock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tokens.colors.secondaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mockText: {
    flex: 1,
    fontFamily: fonts.label,
    fontSize: 11,
    color: tokens.colors.onSecondaryContainer,
  },
});
