import { createMyturnApi, type MyturnApi } from "@myturn/api-client";
import { clearSession, getApiBase, getStoredToken } from "./api";

let cached: MyturnApi | null = null;

export function getMyturnApi(): MyturnApi {
  if (!cached) {
    const baseUrl = getApiBase();
    if (!baseUrl) {
      throw new Error(
        "API URL is not configured. Set NEXT_PUBLIC_API_URL (e.g. https://your-api.com/api).",
      );
    }
    cached = createMyturnApi({
      baseUrl,
      getAccessToken: () => getStoredToken(),
      onUnauthorized: () => {
        clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      },
    });
  }
  return cached;
}
