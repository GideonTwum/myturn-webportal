import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GradientButton } from "@/components/premium";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignUp: () => void;
};

export function AuthPromptModal({ visible, onClose, onLogin, onSignUp }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Please log in or sign up to continue.</Text>
          <Text style={styles.body}>
            Create a MyTurn account or sign in with your phone number to access this feature.
          </Text>
          <GradientButton label="Log in" onPress={onLogin} />
          <GradientButton
            label="Sign up"
            variant="secondary"
            onPress={onSignUp}
            style={{ marginTop: 10 }}
          />
          <Pressable onPress={onClose} style={styles.cancelHit}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.xl,
    padding: 24,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: tokens.colors.onSurface,
    marginBottom: 8,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 20,
  },
  cancelHit: { marginTop: 16, alignItems: "center" },
  cancel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
  },
});
