import { getMtnDisbursementReadiness } from "../../common/provider-readiness";

export async function pingDisbursementProvider(): Promise<
  "ok" | "unconfigured" | "error"
> {
  const readiness = getMtnDisbursementReadiness();
  return readiness.health;
}
