import * as SecureStore from "expo-secure-store";

const INVITE_KEY = "myturn_pending_invite";

export async function setPendingInviteCode(code: string) {
  await SecureStore.setItemAsync(INVITE_KEY, code.trim().toUpperCase());
}

export async function getPendingInviteCode(): Promise<string | null> {
  return SecureStore.getItemAsync(INVITE_KEY);
}

export async function clearPendingInviteCode() {
  await SecureStore.deleteItemAsync(INVITE_KEY);
}
