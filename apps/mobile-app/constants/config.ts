import Constants from "expo-constants";
import { normalizeApiBaseUrl } from "@myturn/api-client";

/** Expo Go / dev client reports the machine running Metro (e.g. 192.168.1.5:8081). */
function getDevMachineHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  if (!hostUri) return null;
  const withoutProtocol = hostUri.replace(/^https?:\/\//, "");
  const host = withoutProtocol.split(":")[0]?.trim();
  return host && host !== "localhost" && host !== "127.0.0.1" ? host : null;
}

function resolveApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
  const isLocalhost =
    !raw ||
    /localhost|127\.0\.0\.1/i.test(raw);

  if (__DEV__ && isLocalhost) {
    const lanHost = getDevMachineHost();
    if (lanHost) {
      return `http://${lanHost}:3001/api`;
    }
  }

  if (raw) {
    return normalizeApiBaseUrl(raw);
  }

  return __DEV__ ? "http://localhost:3001/api" : "";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const AUTH_TOKEN_KEY = "myturn_access_token";
export const AUTH_USER_KEY = "myturn_user";
