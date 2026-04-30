/**
 * API base URL for browser requests.
 * - Development: falls back to local API if NEXT_PUBLIC_API_URL is unset.
 * - Production: set NEXT_PUBLIC_API_URL in the host (e.g. Vercel) so the client bundle points at your API.
 * Resolving is lazy so `next build` does not throw when the env var is only set at deploy/runtime.
 */
function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
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
        : "";
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
