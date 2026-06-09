import { MockDisbursementProvider } from "./mock-disbursement.provider";
import { MtnMomoDisbursementProvider } from "./mtn-momo-disbursement.provider";
import type { DisbursementProvider } from "./disbursement-provider.interface";

export function createDisbursementProvider(): DisbursementProvider {
  const p = process.env.DISBURSEMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  if (p === "mtn-momo" || p === "mtn") {
    return new MtnMomoDisbursementProvider();
  }
  return new MockDisbursementProvider();
}

export function isMockDisbursementProvider(): boolean {
  const p = process.env.DISBURSEMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  return p === "mock";
}
