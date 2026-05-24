import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const tier = process.env.EXPO_PUBLIC_DEPLOYMENT_TIER?.trim() ?? "local";
  const isStaging = tier === "staging" || tier === "local";

  return {
    ...config,
    name: "MyTurn Susu",
    slug: "myturn-mobile",
    version: config.version ?? "0.1.0",
    scheme: "myturn",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#006948",
    },
    android: {
      package: isStaging ? "com.myturn.susu.staging" : "com.myturn.susu",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#006948",
      },
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: isStaging
        ? "com.myturn.susu.staging"
        : "com.myturn.susu",
    },
    plugins: ["expo-router", "expo-secure-store", "expo-asset", "expo-font"],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ...config.extra,
      deploymentTier: tier,
      eas: {
        projectId: "973e31f8-d950-44b7-8e42-3c587e2e7d61",
      },
    },
  };
};
