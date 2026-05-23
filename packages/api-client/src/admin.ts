import type { ApiClient } from "./client";

/** Admin + HQ HTTP surface (non-member envelope). */
export function createAdminApi(client: ApiClient) {
  return {
    listMyGroups() {
      return client.get<unknown[]>("/groups/mine", false);
    },
    getGroup(groupId: string) {
      return client.get<unknown>(`/groups/${groupId}`, false);
    },
    createGroup(body: Record<string, unknown>) {
      return client.post<unknown>("/groups", body, false);
    },
    patchGroup(groupId: string, body: Record<string, unknown>) {
      return client.patch<unknown>(`/groups/${groupId}`, body, false);
    },
    activateGroup(groupId: string) {
      return client.post<unknown>(`/groups/${groupId}/activate`, undefined, false);
    },
    adminOverview() {
      return client.get<unknown>("/admin/overview", false);
    },
    hqOverview() {
      return client.get<unknown>("/hq/overview", false);
    },
    listAdminRequests() {
      return client.get<unknown[]>("/admin-requests", false);
    },
    patchAdminRequest(id: string, body: Record<string, unknown>) {
      return client.patch<unknown>(`/admin-requests/${id}`, body, false);
    },
    listTransactions() {
      return client.get<unknown[]>("/transactions", false);
    },
    listSettings() {
      return client.get<unknown[]>("/settings", false);
    },
    updateSettings(body: Record<string, unknown>) {
      return client.request<unknown>(
        "/settings",
        { method: "PUT", body: JSON.stringify(body) },
        { unwrapEnvelope: false },
      );
    },
    mockContributionPayment(body: Record<string, unknown>) {
      return client.post<unknown>("/payments/mock/contribution-payment", body, false);
    },
    mockFinalizeCycle(body: Record<string, unknown>) {
      return client.post<unknown>("/payouts/mock/finalize-cycle", body, false);
    },
    payoutReadiness(groupId: string) {
      return client.get<unknown>(`/groups/${groupId}/payout-readiness`, false);
    },
    listContributions(groupId: string) {
      return client.get<unknown[]>(`/contributions?groupId=${encodeURIComponent(groupId)}`, false);
    },
    listPayouts(groupId: string) {
      return client.get<unknown[]>(`/payouts?groupId=${encodeURIComponent(groupId)}`, false);
    },
    listEarnings() {
      return client.get<unknown[]>("/admin-earnings", false);
    },
    listHqGroups() {
      return client.get<unknown[]>("/groups", false);
    },
    listHqUsers() {
      return client.get<unknown[]>("/users", false);
    },
  };
}
