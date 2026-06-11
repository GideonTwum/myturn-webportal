import { StyleSheet, Text } from "react-native";
import { Activity } from "lucide-react-native";
import { GlassHeader, GradientButton, PremiumScreen } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  onLogin: () => void;
};

export function GuestActivity({ onLogin }: Props) {
  return (
    <PremiumScreen tabBar header={<GlassHeader />}>
      <IconCircle icon={Activity} size={56} iconSize="xl" style={{ marginBottom: 16 }} />
      <Text style={styles.title}>No activity yet</Text>
      <Text style={styles.body}>
        Your contributions, payouts, reserve releases, and withdrawals will appear here
        after you log in.
      </Text>
      <GradientButton label="Log in" onPress={onLogin} style={{ marginTop: 24 }} />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: tokens.colors.onSurface,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 22,
  },
});
