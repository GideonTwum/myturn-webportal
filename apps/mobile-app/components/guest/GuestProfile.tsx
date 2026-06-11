import { StyleSheet, Text, View } from "react-native";
import { HelpCircle } from "lucide-react-native";
import Constants from "expo-constants";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { API_BASE_URL } from "@/constants/config";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { APP_DISPLAY_NAME } from "@/constants/app-brand";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  onLogin: () => void;
  onSignUp: () => void;
  onHowItWorks?: () => void;
};

export function GuestProfile({ onLogin, onSignUp, onHowItWorks }: Props) {
  const version = Constants.expoConfig?.version ?? "dev";

  return (
    <PremiumScreen tabBar header={<GlassHeader />}>
      <Text style={styles.title}>Welcome to MyTurn</Text>
      <Text style={styles.sub}>
        Log in or create an account to manage your groups, wallet, and payouts.
      </Text>

      <View style={styles.actions}>
        <GradientButton label="Log in" onPress={onLogin} />
        <GradientButton
          label="Sign up"
          variant="secondary"
          onPress={onSignUp}
          style={{ marginTop: 10 }}
        />
      </View>

      {onHowItWorks ? (
        <PremiumCard variant="flat" style={{ marginTop: 20 }}>
          <Text style={styles.cardTitle}>How MyTurn works</Text>
          <Text style={styles.cardBody}>
            Join a group, contribute on schedule, receive your turn payout, and withdraw
            securely to MoMo.
          </Text>
          <GradientButton
            label="Learn more"
            variant="ghost"
            onPress={onHowItWorks}
            style={{ marginTop: 12 }}
          />
        </PremiumCard>
      ) : null}

      <PremiumCard variant="flat" style={{ marginTop: 12 }}>
        <View style={styles.supportRow}>
          <HelpCircle size={18} color={tokens.colors.primary} />
          <Text style={styles.supportText}>Support: contact your group admin or MyTurn HQ</Text>
        </View>
        <Text style={styles.meta}>
          {APP_DISPLAY_NAME} · v{version}
          {!IS_MOCK_UI && API_BASE_URL ? ` · ${API_BASE_URL.replace(/^https?:\/\//, "")}` : ""}
        </Text>
      </PremiumCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: tokens.colors.onSurface,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 22,
  },
  actions: { marginTop: 4 },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: tokens.colors.onSurface,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 20,
  },
  supportRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  supportText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.onSurface,
    flex: 1,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 12,
  },
});
