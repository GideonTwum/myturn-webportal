import { Redirect } from "expo-router";

/** Legacy route group — demo app lives under (main) and (onboarding). */
export default function LegacyAppLayout() {
  return <Redirect href="/(main)/home" />;
}
