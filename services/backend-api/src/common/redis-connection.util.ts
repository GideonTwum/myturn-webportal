import Redis from "ioredis";

/**
 * Railway private Redis (redis.railway.internal) requires dual-stack DNS for ioredis.
 * @see https://docs.railway.com/guides/redis
 */
export function normalizeRedisUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("family=")) return trimmed;
  if (trimmed.includes("railway.internal")) {
    return trimmed.includes("?") ? `${trimmed}&family=0` : `${trimmed}?family=0`;
  }
  return trimmed;
}

/** ioredis auto-connects by default — never call connect() if already connecting/ready. */
export function isRedisActive(client: Redis): boolean {
  const status = client.status;
  return (
    status === "connecting" ||
    status === "connect" ||
    status === "ready" ||
    status === "reconnecting"
  );
}

export function createHealthCheckRedisClient(url: string): Redis {
  return new Redis(normalizeRedisUrl(url), {
    maxRetriesPerRequest: 1,
    connectTimeout: 10_000,
  });
}

/** Ping only — ioredis connects on first command when needed; do not call connect(). */
export async function pingRedisClient(
  client: Redis,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const pong = await client.ping();
    return { ok: pong === "PONG" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function closeRedisClient(client: Redis): Promise<void> {
  if (!isRedisActive(client) && client.status !== "wait") {
    client.disconnect();
    return;
  }
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

export async function pingRedis(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = createHealthCheckRedisClient(url);
  try {
    return await pingRedisClient(client);
  } finally {
    await closeRedisClient(client);
  }
}
