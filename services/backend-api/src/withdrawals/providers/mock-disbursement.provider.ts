import type {
  DisbursementProvider,
  DisbursementTransferInput,
  DisbursementTransferResult,
  DisbursementVerifyResult,
  DisbursementWebhookPayload,
} from "./disbursement-provider.interface";

/** Local/staging — simulates MoMo disbursement without real money movement. */
export class MockDisbursementProvider implements DisbursementProvider {
  readonly name = "mock-disbursement";

  async requestTransfer(
    input: DisbursementTransferInput,
  ): Promise<DisbursementTransferResult> {
    return {
      provider: this.name,
      providerRef: `disb-mock-${input.externalRef}`,
      status: "PENDING",
      raw: { simulated: true, hint: "Auto-settled by API in mock mode" },
    };
  }

  async verifyTransfer(providerRef: string): Promise<DisbursementVerifyResult> {
    if (providerRef.startsWith("disb-mock-")) {
      return { status: "COMPLETED", raw: { mock: true } };
    }
    return { status: "PENDING", raw: { mock: true } };
  }

  async parseWebhook(
    payload: DisbursementWebhookPayload,
  ): Promise<DisbursementVerifyResult | null> {
    const ref = String(
      payload.providerRef ?? payload.externalRef ?? payload.body.externalId ?? "",
    );
    if (!ref.startsWith("disb-mock-")) return null;
    const status = String(payload.body.status ?? "SUCCESSFUL").toUpperCase();
    if (status === "FAILED") {
      return { status: "FAILED", failureReason: "Mock disbursement failed" };
    }
    return { status: "COMPLETED", raw: payload.body };
  }
}
