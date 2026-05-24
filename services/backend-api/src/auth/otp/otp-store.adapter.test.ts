import { describe, expect, it } from "vitest";
import {
  InMemoryOtpStoreAdapter,
  type OtpRecord,
} from "./otp-store.adapter";

describe("InMemoryOtpStoreAdapter", () => {
  const store = new InMemoryOtpStoreAdapter();
  const phone = "240000001";

  it("stores and retrieves OTP record", async () => {
    const record: OtpRecord = {
      code: "123456",
      expiresAt: Date.now() + 60_000,
      attempts: 0,
    };
    await store.set(phone, record);
    const got = await store.get(phone);
    expect(got?.code).toBe("123456");
  });

  it("deletes OTP after verify", async () => {
    await store.set(phone, {
      code: "999999",
      expiresAt: Date.now() + 60_000,
      attempts: 1,
    });
    await store.delete(phone);
    expect(await store.get(phone)).toBeNull();
  });

  it("tracks attempt increments", async () => {
    const key = "240000002";
    await store.set(key, {
      code: "111111",
      expiresAt: Date.now() + 60_000,
      attempts: 0,
    });
    const entry = (await store.get(key))!;
    entry.attempts += 1;
    await store.set(key, entry);
    expect((await store.get(key))?.attempts).toBe(1);
  });
});
