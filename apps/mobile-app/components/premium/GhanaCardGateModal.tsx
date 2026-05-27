import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { GradientButton } from "./GradientButton";
import { IconCircle } from "@/components/icons/IconCircle";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  visible: boolean;
  statusLabel: string;
  onClose: () => void;
  onVerify: () => void;
};

export function GhanaCardGateModal({ visible, statusLabel, onClose, onVerify }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <IconCircle icon={ShieldCheck} size={48} iconSize="lg" color={tokens.colors.primary} />
          <Text style={styles.title}>Verify Ghana Card to contribute</Text>
          <Text style={styles.body}>
            You can join and view groups without verification. Contributions require a verified Ghana
            Card ({statusLabel}).
          </Text>
          <GradientButton label="Verify Ghana Card" onPress={onVerify} style={{ marginTop: 16 }} />
          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text style={styles.dismissText}>Not now</Text>
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
  sheet: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.xl,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: tokens.colors.onSurface,
    textAlign: "center",
    marginTop: 16,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  dismiss: { marginTop: 12, padding: 8 },
  dismissText: { fontFamily: fonts.label, fontSize: 13, color: tokens.colors.onSurfaceVariant },
});
