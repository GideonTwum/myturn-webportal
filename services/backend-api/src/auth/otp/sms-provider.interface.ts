export type SmsSendResult = {
  delivered: boolean;
  provider: string;
  providerRef?: string;
};

export interface SmsProvider {
  readonly name: string;
  sendOtp(phoneDigits: string, code: string): Promise<SmsSendResult>;
}

/** Local/staging — logs OTP (never use in production without explicit flag). */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";

  constructor(private log: (msg: string) => void) {}

  async sendOtp(phoneDigits: string, code: string): Promise<SmsSendResult> {
    this.log(`[SMS:console] OTP to ${phoneDigits}: ${code}`);
    return { delivered: true, provider: this.name };
  }
}

/** Placeholder for Hubtel MoMo/SMS integration. */
export class HubtelSmsProvider implements SmsProvider {
  readonly name = "hubtel";
  async sendOtp(): Promise<SmsSendResult> {
    throw new Error("Hubtel SMS not configured. Set HUBTEL_* credentials.");
  }
}

/** Placeholder for Arkesel SMS. */
export class ArkeselSmsProvider implements SmsProvider {
  readonly name = "arkesel";
  async sendOtp(): Promise<SmsSendResult> {
    throw new Error("Arkesel SMS not configured. Set ARKESEL_* credentials.");
  }
}

export function createSmsProvider(log: (msg: string) => void): SmsProvider {
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "console";
  if (provider === "hubtel") return new HubtelSmsProvider();
  if (provider === "arkesel") return new ArkeselSmsProvider();
  return new ConsoleSmsProvider(log);
}
