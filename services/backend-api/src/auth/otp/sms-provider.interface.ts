import { ArkeselSmsProvider } from "./arkesel-sms.provider";

export type SmsSendResult = {
  delivered: boolean;
  provider: string;
  providerRef?: string;
};

export interface SmsProvider {
  readonly name: string;
  sendOtp(phoneDigits: string, code: string): Promise<SmsSendResult>;
  getHealthState?(): "ok" | "error" | "unconfigured";
}

/** Local/staging — logs OTP (never use in production without explicit flag). */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  private state: "ok" | "unconfigured" = "ok";

  constructor(private log: (msg: string) => void) {}

  getHealthState() {
    return this.state;
  }

  async sendOtp(phoneDigits: string, code: string): Promise<SmsSendResult> {
    this.log(`[SMS:console] OTP to ${phoneDigits}: ${code}`);
    return { delivered: true, provider: this.name };
  }
}

export function createSmsProvider(log: (msg: string) => void): SmsProvider {
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "console";
  if (provider === "arkesel") return new ArkeselSmsProvider();
  return new ConsoleSmsProvider(log);
}
