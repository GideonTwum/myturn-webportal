import * as SecureStore from "expo-secure-store";

const PENDING_INVITE_KEY = "myturn_pending_invite";

export async function getPendingInviteCode(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_INVITE_KEY);
}

export async function setPendingInviteCode(code: string | null) {
  if (!code) {
    await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
    return;
  }
  await SecureStore.setItemAsync(PENDING_INVITE_KEY, code.trim().toUpperCase());
}
