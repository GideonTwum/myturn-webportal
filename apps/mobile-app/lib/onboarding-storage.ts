import * as SecureStore from "expo-secure-store";

const OTP_PHONE_KEY = "myturn_otp_phone";
const OTP_DEBUG_CODE_KEY = "myturn_otp_debug_code";

export async function setOtpSession(phone: string, debugCode?: string) {
  await SecureStore.setItemAsync(OTP_PHONE_KEY, phone);
  if (debugCode) {
    await SecureStore.setItemAsync(OTP_DEBUG_CODE_KEY, debugCode);
  } else {
    await SecureStore.deleteItemAsync(OTP_DEBUG_CODE_KEY);
  }
}

export async function getOtpPhone(): Promise<string | null> {
  return SecureStore.getItemAsync(OTP_PHONE_KEY);
}

export async function getOtpDebugCode(): Promise<string | null> {
  return SecureStore.getItemAsync(OTP_DEBUG_CODE_KEY);
}

export async function clearOtpSession() {
  await SecureStore.deleteItemAsync(OTP_PHONE_KEY);
  await SecureStore.deleteItemAsync(OTP_DEBUG_CODE_KEY);
}
