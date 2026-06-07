export * from "./types";
export * from "./envelope";
export * from "./client";
export * from "./auth";
export * from "./groups";
export * from "./payments";
export * from "./payouts";
export * from "./notifications";
export * from "./verification";
export * from "./admin";
export * from "./wallet";

import { createApiClient, type ApiClientConfig } from "./client";
import { createAuthApi } from "./auth";
import { createGroupsApi } from "./groups";
import { createPaymentsApi } from "./payments";
import { createPayoutsApi } from "./payouts";
import { createNotificationsApi } from "./notifications";
import { createVerificationApi } from "./verification";
import { createAdminApi } from "./admin";
import { createWalletApi } from "./wallet";

export function createMyturnApi(config: ApiClientConfig) {
  const client = createApiClient(config);
  return {
    client,
    auth: createAuthApi(client),
    groups: createGroupsApi(client),
    payments: createPaymentsApi(client),
    payouts: createPayoutsApi(client),
    notifications: createNotificationsApi(client),
    verification: createVerificationApi(client),
    admin: createAdminApi(client),
    wallet: createWalletApi(client),
  };
}

export type MyturnApi = ReturnType<typeof createMyturnApi>;
