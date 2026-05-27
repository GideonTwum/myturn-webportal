import { isApiErrorBody, isApiSuccess, type ApiEnvelope } from "./types";

export type TokenProvider = () => string | null | Promise<string | null>;

export type ApiClientConfig = {
  baseUrl: string;
  getAccessToken?: TokenProvider;
  onUnauthorized?: () => void;
};

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const noTrailingSlash = trimmed.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(noTrailingSlash)) {
    return noTrailingSlash;
  }
  return `https://${noTrailingSlash.replace(/^\/+/, "")}`;
}

function parseNestMessage(body: unknown): string {
  if (isApiErrorBody(body)) return body.message;
  if (typeof body === "object" && body !== null) {
    const j = body as { message?: string | string[] };
    if (typeof j.message === "string") return j.message;
    if (Array.isArray(j.message)) return j.message.join(", ");
  }
  return "Request failed";
}

export function createApiClient(config: ApiClientConfig) {
  const baseUrl = normalizeApiBaseUrl(config.baseUrl);
  if (!baseUrl) {
    throw new Error("API base URL is required");
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
    options?: { unwrapEnvelope?: boolean },
  ): Promise<T> {
    const unwrap = options?.unwrapEnvelope ?? path.startsWith("/member");
    const token = config.getAccessToken
      ? await config.getAccessToken()
      : null;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    };
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new ApiClientError(
        `Network error — could not reach the API at ${baseUrl}`,
        0,
        "NETWORK_ERROR",
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      if (res.status === 401 && token && config.onUnauthorized) {
        config.onUnauthorized();
      }
      const message = parseNestMessage(body);
      const code =
        isApiErrorBody(body) && body.code ? body.code : undefined;
      throw new ApiClientError(message, res.status, code);
    }

    if (unwrap && isApiSuccess<T>(body)) {
      return body.data;
    }

    if (unwrap && isApiErrorBody(body)) {
      throw new ApiClientError(body.message, body.statusCode ?? res.status, body.code);
    }

    return body as T;
  }

  return {
    baseUrl,
    request,
    get<T>(path: string, unwrap = path.startsWith("/member")) {
      return request<T>(path, { method: "GET" }, { unwrapEnvelope: unwrap });
    },
    post<T>(path: string, body?: unknown, unwrap = path.startsWith("/member")) {
      return request<T>(
        path,
        {
          method: "POST",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        { unwrapEnvelope: unwrap },
      );
    },
    patch<T>(path: string, body?: unknown, unwrap = path.startsWith("/member")) {
      return request<T>(
        path,
        {
          method: "PATCH",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        { unwrapEnvelope: unwrap },
      );
    },
    delete<T>(path: string, unwrap = path.startsWith("/member")) {
      return request<T>(path, { method: "DELETE" }, { unwrapEnvelope: unwrap });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Unwrap legacy or enveloped JSON for gradual migration. */
export function unwrapEnvelope<T>(body: ApiEnvelope<T> | T): T {
  if (isApiSuccess<T>(body)) return body.data;
  return body as T;
}
