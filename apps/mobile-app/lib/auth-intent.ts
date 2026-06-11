import * as SecureStore from "expo-secure-store";

const REDIRECT_KEY = "myturn_auth_redirect";

export async function setAuthRedirect(path: string) {
  await SecureStore.setItemAsync(REDIRECT_KEY, path);
}

export async function getAuthRedirect(): Promise<string | null> {
  return SecureStore.getItemAsync(REDIRECT_KEY);
}

export async function clearAuthRedirect() {
  await SecureStore.deleteItemAsync(REDIRECT_KEY);
}
