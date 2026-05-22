/**
 * API base URL for browser requests.
 * - Development: falls back to local API if NEXT_PUBLIC_API_URL is unset.
 * - Production: set NEXT_PUBLIC_API_URL in the host (e.g. Vercel) so the client bundle points at your API.
 * Resolving is lazy so `next build` does not throw when the env var is only set at deploy/runtime.
 */
/**
 * Normalize production/staging NEXT_PUBLIC_API_URL.
 * Missing `http://` or `https://` makes browsers resolve the URL as a path on the
 * current site (e.g. vercel.app/backend-api-xxxx... → 404 on the SPA).
 */
function normalizeConfiguredApiBase(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const noTrailingSlash = trimmed.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(noTrailingSlash)) {
    return noTrailingSlash;
  }
  return `https://${noTrailingSlash.replace(/^\/+/, "")}`;
}

export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return normalizeConfiguredApiBase(raw);
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001/api";
  }
  return "";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("myturn_token");
}

export function setSession(token: string, userJson: string) {
  localStorage.setItem("myturn_token", token);
  localStorage.setItem("myturn_user", userJson);
}

export function clearSession() {
  localStorage.removeItem("myturn_token");
  localStorage.removeItem("myturn_user");
}

/** Accept either snake_case or camelCase from the API or intermediaries. */
export function resolveAccessToken(payload: {
  access_token?: string;
  accessToken?: string;
}): string {
  const t = payload.access_token ?? payload.accessToken;
  if (typeof t !== "string" || !t.trim()) {
    throw new Error("Malformed auth response: missing access token.");
  }
  return t.trim();
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    throw new Error(
      "API URL is not configured. Set NEXT_PUBLIC_API_URL (e.g. https://your-api.com/api).",
    );
  }
  const token = getStoredToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    const hint =
      process.env.NODE_ENV === "development"
        ? ` Cannot reach API at ${API_BASE}. Is the backend running?`
        : ` (Request base: ${API_BASE}). Check NEXT_PUBLIC_API_URL on Vercel, CORS_ORIGIN on the API, and open /api/health in the browser.`;
    throw new Error(`Network error — could not reach the API.${hint}`);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
