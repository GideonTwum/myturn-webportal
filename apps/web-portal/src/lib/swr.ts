import useSWR, { useSWRConfig } from "swr";
import { getMyturnApi } from "./myturn-api";

export { useSWR, useSWRConfig };

/** Default polling interval for HQ/Admin live dashboards (ms). */
export const LIVE_POLL_MS = 20_000;

export async function swrFetcher<T>(url: string): Promise<T> {
  return getMyturnApi().client.get<T>(url, false);
}
