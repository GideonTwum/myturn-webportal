import { StyleSheet, Text, View } from "react-native";
import { ShieldAlert } from "lucide-react-native";
import { DEPLOYMENT_TIER, IS_MOCK_UI } from "@/constants/app-mode";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  /** Short context line under the main warning */
  context?: string;
};

/** Visible staging safety notice — no real money. */
export function StagingSafetyNotice({ context }: Props) {
  if (IS_MOCK_UI || DEPLOYMENT_TIER === "production") return null;

  return (
    <View style={styles.box}>
      <PremiumIcon icon={ShieldAlert} size="sm" color={tokens.colors.error} />
      <View style={styles.copy}>
        <Text style={styles.title}>Staging — no real money</Text>
        <Text style={styles.body}>
          {context ??
            "Payments are simulated for testing. Your MoMo wallet will not be charged."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: tokens.colors.errorContainer + "55",
    borderRadius: tokens.radius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.colors.error + "33",
  },
  copy: { flex: 1, gap: 4 },
  title: {
    fontFamily: fonts.label,
    fontSize: 13,
    color: tokens.colors.error,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    lineHeight: 17,
  },
});
