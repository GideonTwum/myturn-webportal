import { Stack } from "expo-router";
import { tokens } from "@/constants/tokens";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.colors.background },
        animation: "slide_from_right",
      }}
    />
  );
}
