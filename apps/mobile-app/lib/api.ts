import { createMyturnApi } from "@myturn/api-client";
import { API_BASE_URL } from "@/constants/config";
import { clearSession, getStoredToken } from "./auth-storage";

let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export const api = createMyturnApi({
  baseUrl: API_BASE_URL || "http://localhost:3001/api",
  getAccessToken: getStoredToken,
  onUnauthorized: () => {
    void clearSession();
    onUnauthorized?.();
  },
});
