import { StyleSheet, Text, View } from "react-native";
import { AlertTriangle, FlaskConical, Shield } from "lucide-react-native";
import {
  DEPLOYMENT_TIER,
  IS_MOCK_UI,
  type DeploymentTier,
} from "@/constants/app-mode";
import { API_BASE_URL } from "@/constants/config";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { useApiHealth } from "@/hooks/useApiHealth";

const TIER_LABEL: Record<DeploymentTier, string> = {
  local: "LOCAL",
  staging: "STAGING",
  production: "PRODUCTION",
};

export function DemoBanner() {
  const health = useApiHealth();

  if (IS_MOCK_UI) {
    return (
      <View style={[styles.bar, styles.mock]}>
        <PremiumIcon icon={FlaskConical} size="sm" color={tokens.colors.onSecondaryContainer} />
        <Text style={[styles.text, styles.mockText]}>
          MOCK · UI-only demo · no live API or payments
        </Text>
      </View>
    );
  }

  const tier = DEPLOYMENT_TIER;
  const offline = health.isError || health.data?.status === undefined;
  const isProd = tier === "production";

  return (
    <View style={[styles.bar, isProd ? styles.production : styles.staging]}>
      <PremiumIcon
        icon={isProd ? Shield : FlaskConical}
        size="sm"
        color={isProd ? tokens.colors.onPrimary : tokens.colors.onTertiaryFixed}
      />
      <Text style={[styles.text, isProd ? styles.productionText : styles.stagingText]}>
        {TIER_LABEL[tier]}
        {isProd ? " · live financial API" : " · MoMo simulated via backend"}
        {offline ? " · API offline" : health.isSuccess ? " · API ok" : ""}
      </Text>
      {offline && (
        <PremiumIcon icon={AlertTriangle} size="sm" color={tokens.colors.error} />
      )}
    </View>
  );
}

export function getEnvironmentMetaForDiagnostics() {
  return {
    tier: DEPLOYMENT_TIER,
    mockUi: IS_MOCK_UI,
    apiBaseUrl: API_BASE_URL,
  };
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  staging: {
    backgroundColor: tokens.colors.tertiaryFixed + "CC",
  },
  production: {
    backgroundColor: tokens.colors.primary + "E6",
  },
  mock: {
    backgroundColor: tokens.colors.secondaryContainer,
  },
  text: {
    flex: 1,
    fontFamily: fonts.label,
    fontSize: 11,
  },
  stagingText: {
    color: tokens.colors.onTertiaryFixed,
  },
  productionText: {
    color: tokens.colors.onPrimary,
  },
  mockText: {
    color: tokens.colors.onSecondaryContainer,
  },
});
