import { Logger } from "@nestjs/common";

export type OtpEvent =
  | "otp.request"
  | "otp.request.failure"
  | "otp.request.denied"
  | "otp.verify.attempt"
  | "otp.verify.success"
  | "otp.verify.failure"
  | "otp.verify.locked";

const metrics = {
  deliveries: 0,
  deliveryFailures: 0,
  requests: 0,
  verifications: 0,
};

export function getOtpMetrics() {
  return { ...metrics };
}

export function recordOtpDelivery(success: boolean) {
  if (success) metrics.deliveries += 1;
  else metrics.deliveryFailures += 1;
}

export function recordOtpRequest() {
  metrics.requests += 1;
}

export function recordOtpVerification() {
  metrics.verifications += 1;
}

export function logOtpEvent(
  logger: Logger,
  event: OtpEvent,
  meta: Record<string, string | number | boolean | undefined>,
): void {
  logger.log(
    JSON.stringify({
      domain: "otp",
      event,
      ...meta,
      ts: new Date().toISOString(),
    }),
  );
}
