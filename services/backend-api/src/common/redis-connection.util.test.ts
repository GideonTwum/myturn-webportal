import Redis from "ioredis";
import { describe, expect, it, vi } from "vitest";
import {
  closeRedisClient,
  isRedisActive,
  normalizeRedisUrl,
  pingRedisClient,
} from "./redis-connection.util";

describe("normalizeRedisUrl", () => {
  it("appends family=0 for railway.internal", () => {
    const url = "redis://default:pass@redis.railway.internal:6379";
    expect(normalizeRedisUrl(url)).toBe(`${url}?family=0`);
  });

  it("does not duplicate family param", () => {
    const url = "redis://default:pass@redis.railway.internal:6379?family=0";
    expect(normalizeRedisUrl(url)).toBe(url);
  });

  it("leaves localhost unchanged", () => {
    const url = "redis://127.0.0.1:6379";
    expect(normalizeRedisUrl(url)).toBe(url);
  });
});

describe("isRedisActive", () => {
  it("returns true for connecting and ready", () => {
    expect(isRedisActive({ status: "connecting" } as Redis)).toBe(true);
    expect(isRedisActive({ status: "ready" } as Redis)).toBe(true);
  });

  it("returns false for wait and end", () => {
    expect(isRedisActive({ status: "wait" } as Redis)).toBe(false);
    expect(isRedisActive({ status: "end" } as Redis)).toBe(false);
  });
});

describe("pingRedisClient", () => {
  function mockClient(status: Redis["status"]) {
    const connect = vi.fn();
    const ping = vi.fn().mockResolvedValue("PONG");
    const quit = vi.fn().mockResolvedValue("OK");
    const disconnect = vi.fn();
    const client = { status, connect, ping, quit, disconnect } as unknown as Redis;
    return { client, connect, ping, quit, disconnect };
  }

  it("does not call connect when already connecting", async () => {
    const { client, connect, ping } = mockClient("connecting");
    const result = await pingRedisClient(client);
    expect(result.ok).toBe(true);
    expect(connect).not.toHaveBeenCalled();
    expect(ping).toHaveBeenCalledOnce();
  });

  it("does not call connect when already ready", async () => {
    const { client, connect, ping } = mockClient("ready");
    const result = await pingRedisClient(client);
    expect(result.ok).toBe(true);
    expect(connect).not.toHaveBeenCalled();
    expect(ping).toHaveBeenCalledOnce();
  });

  it("treats PONG as healthy", async () => {
    const { client, connect } = mockClient("ready");
    const result = await pingRedisClient(client);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });

  it("returns error when ping fails", async () => {
    const connect = vi.fn();
    const ping = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const client = {
      status: "ready",
      connect,
      ping,
    } as unknown as Redis;
    const result = await pingRedisClient(client);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
    expect(connect).not.toHaveBeenCalled();
  });
});

describe("closeRedisClient", () => {
  it("uses quit when client is active", async () => {
    const quit = vi.fn().mockResolvedValue("OK");
    const disconnect = vi.fn();
    const client = { status: "ready", quit, disconnect } as unknown as Redis;
    await closeRedisClient(client);
    expect(quit).toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });
});
