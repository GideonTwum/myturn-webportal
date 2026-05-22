import type { ApiClient } from "./client";
import type { MemberPaymentsResponse } from "./types";

export function createPaymentsApi(client: ApiClient) {
  return {
    list() {
      return client.get<MemberPaymentsResponse>("/member/payments", true);
    },
    mockContributionPayment(contributionId: string) {
      return client.post<unknown>(
        "/payments/mock/contribution-payment",
        { contributionId },
        false,
      );
    },
  };
}
