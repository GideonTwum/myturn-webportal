import type { ApiClient } from "./client";
import type { AuthSession, MemberMeResponse, OtpRequestResponse } from "./types";

export function resolveAccessToken(payload: {
  access_token?: string;
  accessToken?: string;
}): string {
  const t = payload.access_token ?? payload.accessToken;
  if (typeof t !== "string" || !t.trim()) {
    throw new Error("Malformed auth response: missing access token.");
  }
  return t.trim();
}

export function createAuthApi(client: ApiClient) {
  return {
    login(email: string, password: string) {
      return client.post<AuthSession>("/auth/login", { email, password }, false);
    },
    memberPhone(phone: string) {
      return client.post<AuthSession>("/auth/member-phone", { phone }, false);
    },
    otpRequest(phone: string) {
      return client.post<OtpRequestResponse>(
        "/auth/otp/request",
        { phone },
        true,
      );
    },
    otpVerify(phone: string, code: string) {
      return client.post<AuthSession>(
        "/auth/otp/verify",
        { phone, code },
        true,
      );
    },
    me() {
      return client.get<AuthSession["user"]>("/auth/me", false);
    },
    memberMe() {
      return client.get<MemberMeResponse>("/member/me", true);
    },
  };
}
