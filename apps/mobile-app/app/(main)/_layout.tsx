import { Stack } from "expo-router";
import { View } from "react-native";
import { PremiumBottomNav } from "@/components/premium";
import { tokens } from "@/constants/tokens";

export default function MainLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <Stack screenOptions={{ headerShown: false }} />
      <PremiumBottomNav />
    </View>
  );
}
