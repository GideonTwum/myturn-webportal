import { StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { GradientButton } from "./GradientButton";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function VerificationBanner({
  title = "Verify to Unlock",
  body = "Verify your Ghana Card to unlock participation and payouts in this circle.",
  actionLabel = "Start Verification",
  onAction,
}: Props) {
  return (
    <View style={styles.banner}>
      <PremiumIcon icon={ShieldCheck} size="xl" color={tokens.colors.onSecondaryContainer} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <GradientButton label={actionLabel} onPress={onAction} style={{ marginTop: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: tokens.colors.secondaryContainer,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
  },
  copy: { gap: 4, marginTop: 8 },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700",
    color: tokens.colors.onSecondaryContainer,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: tokens.colors.onSecondaryContainer,
    opacity: 0.9,
  },
});
