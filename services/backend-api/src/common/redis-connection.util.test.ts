import { describe, expect, it } from "vitest";
import { normalizeRedisUrl } from "./redis-connection.util";

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
