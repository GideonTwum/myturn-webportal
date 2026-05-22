/**
 * OTP persistence adapter — in-memory for staging; Redis for production multi-instance.
 * @see docs/OTP_HARDENING_ROADMAP.md
 */

export type OtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number;
};

export interface OtpStoreAdapter {
  set(key: string, record: OtpRecord): Promise<void>;
  get(key: string): Promise<OtpRecord | null>;
  delete(key: string): Promise<void>;
}

export class InMemoryOtpStoreAdapter implements OtpStoreAdapter {
  private store = new Map<string, OtpRecord>();

  async set(key: string, record: OtpRecord): Promise<void> {
    this.store.set(key, record);
  }

  async get(key: string): Promise<OtpRecord | null> {
    return this.store.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

