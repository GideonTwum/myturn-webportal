import { StyleSheet, Text, View } from "react-native";
import { Shield, Users, Wallet } from "lucide-react-native";
import { FeatureRow } from "@/components/icons/FeatureRow";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  onLogin: () => void;
  onSignUp: () => void;
};

const STEPS = [
  "Join a trusted savings group",
  "Contribute on schedule",
  "Receive your payout when it's your turn",
  "Withdraw to MoMo",
];

const WHY = [
  { icon: Users, text: "Transparent groups" },
  { icon: Wallet, text: "Wallet-based payouts" },
  { icon: Shield, text: "Contribution Guarantee Reserve" },
  { icon: Wallet, text: "MoMo withdrawals" },
];

export function GuestHome({ onLogin, onSignUp }: Props) {
  return (
    <PremiumScreen tabBar header={<GlassHeader />}>
      <Text style={styles.title}>MyTurn Susu</Text>
      <Text style={styles.subtitle}>
        Save together. Receive your turn. Withdraw securely.
      </Text>

      <PremiumCard style={{ marginTop: 8 }}>
        <Text style={styles.sectionTitle}>How MyTurn works</Text>
        {STEPS.map((step, i) => (
          <Text key={step} style={styles.step}>
            {i + 1}. {step}
          </Text>
        ))}
      </PremiumCard>

      <PremiumCard variant="flat" style={{ marginTop: 12 }}>
        <Text style={styles.sectionTitle}>Why MyTurn?</Text>
        {WHY.map((item) => (
          <FeatureRow
            key={item.text}
            icon={item.icon}
            title={item.text}
            body=""
          />
        ))}
      </PremiumCard>

      <View style={styles.actions}>
        <GradientButton label="Log in" onPress={onLogin} />
        <GradientButton
          label="Sign up"
          variant="secondary"
          onPress={onSignUp}
          style={{ marginTop: 10 }}
        />
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.displayExtra,
    fontSize: 32,
    color: tokens.colors.onSurface,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 22,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: tokens.colors.onSurface,
    marginBottom: 12,
  },
  step: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurface,
    lineHeight: 22,
    marginBottom: 6,
  },
  actions: { marginTop: 24 },
});
