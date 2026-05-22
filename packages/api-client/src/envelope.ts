import { isApiErrorBody, isApiSuccess, type ApiEnvelope } from "./types";

/** Unwrap `{ success, data }` — shared contract for mobile + future web migration. */
export function unwrapApiEnvelope<T>(body: unknown): T {
  if (isApiSuccess<T>(body)) return body.data;
  if (isApiErrorBody(body)) {
    throw new Error(body.message);
  }
  return body as T;
}

export function isWrappedResponse(body: unknown): body is ApiEnvelope<unknown> {
  return isApiSuccess(body) || isApiErrorBody(body);
}
