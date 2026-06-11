import { StyleSheet, Text, View } from "react-native";
import { UserPlus } from "lucide-react-native";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  onJoin: () => void;
};

export function GuestGroups({ onJoin }: Props) {
  return (
    <PremiumScreen tabBar header={<GlassHeader />}>
      <IconCircle icon={UserPlus} size={56} iconSize="xl" style={{ marginBottom: 16 }} />
      <Text style={styles.title}>Join a savings group</Text>
      <Text style={styles.body}>
        Enter an invite code from your group admin to join a MyTurn group.
      </Text>
      <PremiumCard>
        <Text style={styles.hint}>
          Groups are invite-only. Your admin shares a code from the MyTurn dashboard.
        </Text>
        <GradientButton
          label="Log in or sign up to join"
          onPress={onJoin}
          style={{ marginTop: 16 }}
        />
      </PremiumCard>
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
    marginBottom: 20,
    lineHeight: 22,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
    lineHeight: 20,
  },
});
