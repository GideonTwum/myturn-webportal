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
      return client.patch<{ ok: boolean }>(
        `/member/notifications/${id}/read`,
        undefined,
        true,
      );
    },
    delete(id: string) {
      return client.delete<{ ok: boolean }>(
        `/member/notifications/${id}`,
        true,
      );
    },
    clearAll() {
      return client.delete<{ deleted: number }>(
        "/member/notifications/clear-all",
        true,
      );
    },
    registerDevice(body: {
      token: string;
      platform: "ios" | "android" | "web";
    }) {
      return client.post<unknown>("/member/devices/register", body, true);
    },
  };
}
