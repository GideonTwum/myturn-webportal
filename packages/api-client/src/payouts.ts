import type { ApiClient } from "./client";
import type { MemberPayoutsResponse } from "./types";

export function createPayoutsApi(client: ApiClient) {
  return {
    list() {
      return client.get<MemberPayoutsResponse>("/member/payouts", true);
    },
  };
}
