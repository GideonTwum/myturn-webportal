import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GradientButton } from "./GradientButton";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  onClose: () => void;
};

export function PremiumModal({
  visible,
  title,
  body,
  primaryLabel = "Continue",
  onPrimary,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.card}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
            <GradientButton label={primaryLabel} onPress={onPrimary ?? onClose} />
            <GradientButton label="Close" variant="ghost" onPress={onClose} style={{ marginTop: 8 }} />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(21,28,39,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: 28,
    padding: 24,
    width: "100%",
    maxWidth: 340,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: tokens.colors.onSurface,
    marginBottom: 8,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: tokens.colors.onSurfaceVariant,
    marginBottom: 20,
    lineHeight: 22,
  },
});
