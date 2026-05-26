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
