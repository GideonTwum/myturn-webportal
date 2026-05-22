/** UI-only mock data when true. Connected staging is the default. */
export const IS_MOCK_UI = process.env.EXPO_PUBLIC_MOCK_UI === "true";

export const IS_CONNECTED_DEMO = !IS_MOCK_UI;

export type DeploymentTier = "local" | "staging" | "production";

export function getDeploymentTier(): DeploymentTier {
  const t = process.env.EXPO_PUBLIC_DEPLOYMENT_TIER?.trim().toLowerCase();
  if (t === "local" || t === "staging" || t === "production") return t;
  return __DEV__ ? "local" : "production";
}

export const DEPLOYMENT_TIER = getDeploymentTier();
