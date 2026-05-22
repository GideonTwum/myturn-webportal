/**
 * Cross-app environment constants — keep URLs aligned across mobile, web, and API.
 */

export type DeploymentTier = "local" | "staging" | "production";

export const ENV_KEYS = {
  stagingApiUrl: "STAGING_API_URL",
  stagingWebUrl: "STAGING_WEB_URL",
  publicApiUrl: "PUBLIC_API_URL",
  deploymentTier: "DEPLOYMENT_TIER",
} as const;

export const DEMO_INVITE_CODES = {
  join: "STAGING-DEMO",
  payments: "STAGING-PAY",
} as const;

export const LOCAL_DEFAULTS = {
  apiUrl: "http://localhost:3001/api",
  webUrl: "http://localhost:3000",
  dbUrl: "postgresql://postgres:postgres@127.0.0.1:5433/myturn?schema=public",
} as const;

export function resolveDeploymentTier(
  explicit?: string | null,
  nodeEnv?: string,
): DeploymentTier {
  const t = explicit?.trim().toLowerCase();
  if (t === "production" || t === "staging" || t === "local") return t;
  if (nodeEnv === "production") return "production";
  return "local";
}
