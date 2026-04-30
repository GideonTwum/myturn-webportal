import { apiFetch } from "./api";
import useSWR, { useSWRConfig } from "swr";

export { useSWR, useSWRConfig };

/** Default polling interval for HQ/Admin live dashboards (ms). */
export const LIVE_POLL_MS = 20_000;

export async function swrFetcher<T>(url: string): Promise<T> {
  return apiFetch<T>(url);
}
