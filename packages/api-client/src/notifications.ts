import type { ApiClient } from "./client";
import type { MemberNotificationsResponse } from "./types";

export function createNotificationsApi(client: ApiClient) {
  return {
    list() {
      return client.get<MemberNotificationsResponse>(
        "/member/notifications",
        true,
      );
    },
    markRead(id: string) {
      return client.patch<unknown>(`/notifications/${id}/read`, undefined, false);
    },
    registerDevice(body: {
      token: string;
      platform: "ios" | "android" | "web";
    }) {
      return client.post<unknown>("/member/devices/register", body, true);
    },
  };
}
