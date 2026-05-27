import { Logger } from "@nestjs/common";
import type { SmsProvider, SmsSendResult } from "./sms-provider.interface";

const DEFAULT_BASE = "https://sms.arkesel.com/api/v2/sms/send";
const TIMEOUT_MS = Number(process.env.ARKESEL_TIMEOUT_MS ?? 12_000);
const MAX_RETRIES = 2;

/** Ghana MSISDN for Arkesel recipients (233XXXXXXXXX). */
export function formatArkeselRecipient(phoneDigits: string): string {
  const d = phoneDigits.replace(/\D/g, "");
  if (d.startsWith("233")) return d;
  if (d.startsWith("0")) return `233${d.slice(1)}`;
  if (d.length === 9) return `233${d}`;
  return d;
}

export type ArkeselSendResponse = {
  status?: string;
  message?: string;
  data?: Array<
    | { recipient?: string; id?: string }
    | { "invalid numbers"?: string[] }
    | Record<string, unknown>
  >;
};

/** Validate Arkesel v2 send response — HTTP 200 can still mean invalid numbers or failure. */
export function parseArkeselSendSuccess(
  body: ArkeselSendResponse | null,
  recipient: string,
): { providerRef?: string } {
  const status = body?.status?.trim().toLowerCase();
  if (status && status !== "success") {
    throw new Error(
      `Arkesel status ${body?.status}: ${body?.message ?? "send failed"}`,
    );
  }
  const rows = body?.data ?? [];
  const invalid: string[] = [];
  let providerRef: string | undefined;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const inv = (row as { "invalid numbers"?: string[] })["invalid numbers"];
    if (Array.isArray(inv)) {
      invalid.push(...inv);
      continue;
    }
    const r = (row as { recipient?: string; id?: string }).recipient?.replace(
      /\D/g,
      "",
    );
    const id = (row as { recipient?: string; id?: string }).id;
    if (r && id && (r === recipient || r.endsWith(recipient.slice(-9)))) {
      providerRef = id;
    }
  }
  if (invalid.length > 0) {
    throw new Error(
      `Arkesel rejected recipient(s): ${invalid.join(", ")}`,
    );
  }
  if (!providerRef && rows.length > 0) {
    const first = rows.find(
      (row) =>
        row &&
        typeof row === "object" &&
        "id" in row &&
        typeof (row as { id?: string }).id === "string",
    ) as { id?: string } | undefined;
    providerRef = first?.id;
  }
  if (!providerRef) {
    throw new Error(
      `Arkesel response missing message id for ${recipient}: ${JSON.stringify(body)?.slice(0, 300)}`,
    );
  }
  return { providerRef };
}

export class ArkeselSmsProvider implements SmsProvider {
  readonly name = "arkesel";
  private readonly logger = new Logger(ArkeselSmsProvider.name);
  private lastHealth: "ok" | "error" | "unconfigured" = "unconfigured";

  getHealthState(): typeof this.lastHealth {
    return this.lastHealth;
  }

  async sendOtp(phoneDigits: string, code: string): Promise<SmsSendResult> {
    const apiKey = process.env.ARKESEL_API_KEY?.trim();
    const senderId = process.env.ARKESEL_SENDER_ID?.trim();
    if (!apiKey || !senderId) {
      this.lastHealth = "unconfigured";
      throw new Error(
        "Arkesel SMS not configured. Set ARKESEL_API_KEY and ARKESEL_SENDER_ID.",
      );
    }

    const baseUrl = (process.env.ARKESEL_BASE_URL?.trim() || DEFAULT_BASE).replace(
      /\/+$/,
      "",
    );
    const recipient = formatArkeselRecipient(phoneDigits);
    const message = `Your MyTurn verification code is ${code}. Valid for 5 minutes. Do not share this code.`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.postSms(baseUrl, apiKey, senderId, recipient, message);
        this.lastHealth = "ok";
        this.logger.log(
          JSON.stringify({
            domain: "sms",
            event: "arkesel.delivered",
            recipient,
            providerRef: result.providerRef,
            attempt,
          }),
        );
        return result;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        this.logger.warn(
          JSON.stringify({
            domain: "sms",
            event: "arkesel.retry",
            attempt,
            message: lastError.message,
          }),
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }

    this.lastHealth = "error";
    this.logger.error(
      JSON.stringify({
        domain: "sms",
        event: "arkesel.failed",
        recipient,
        message: lastError?.message,
      }),
    );
    throw lastError ?? new Error("Arkesel SMS delivery failed");
  }

  private async postSms(
    url: string,
    apiKey: string,
    sender: string,
    recipient: string,
    message: string,
  ): Promise<SmsSendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender,
          message,
          recipients: [recipient],
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      let body: ArkeselSendResponse | null = null;
      try {
        body = text ? (JSON.parse(text) as ArkeselSendResponse) : null;
      } catch {
        body = null;
      }
      if (!res.ok) {
        throw new Error(
          `Arkesel HTTP ${res.status}: ${body?.message ?? text.slice(0, 200)}`,
        );
      }
      const { providerRef } = parseArkeselSendSuccess(body, recipient);
      return {
        delivered: true,
        provider: this.name,
        providerRef,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Ping configured credentials (no SMS sent). */
export async function pingArkesel(): Promise<"ok" | "unconfigured" | "error"> {
  const key = process.env.ARKESEL_API_KEY?.trim();
  const sender = process.env.ARKESEL_SENDER_ID?.trim();
  if (!key || !sender) return "unconfigured";
  const base = (process.env.ARKESEL_BASE_URL?.trim() || DEFAULT_BASE).replace(
    /\/+$/,
    "",
  );
  if (!/^https?:\/\//i.test(base)) return "error";
  return "ok";
}
