import { Logger } from "@nestjs/common";

export type OtpEvent =
  | "otp.request"
  | "otp.request.denied"
  | "otp.verify.attempt"
  | "otp.verify.success"
  | "otp.verify.failure"
  | "otp.verify.locked";

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
