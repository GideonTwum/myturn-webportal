import { StyleSheet } from "react-native";
import { Plus } from "lucide-react-native";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { ScalePressable } from "./motion";
import { tokens } from "@/constants/tokens";

type Props = { onPress?: () => void };

export function FloatingActionButton({ onPress }: Props) {
  return (
    <ScalePressable onPress={onPress} style={styles.fab}>
      <PremiumIcon icon={Plus} size="xl" color={tokens.colors.onPrimary} strokeWidth={2} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
