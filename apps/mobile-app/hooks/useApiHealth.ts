import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/constants/config";
import { IS_MOCK_UI } from "@/constants/app-mode";

export type ApiHealth = {
  status: string;
  environment?: string;
  apiBaseUrl?: string;
  checks?: { database?: string };
};

export function useApiHealth() {
  return useQuery({
    queryKey: ["platform", "health"],
    queryFn: async (): Promise<ApiHealth> => {
      const base = API_BASE_URL.replace(/\/+$/, "");
      const res = await fetch(`${base}/health`);
      if (!res.ok) throw new Error(`Health check failed (${res.status})`);
      return res.json() as Promise<ApiHealth>;
    },
    enabled: !IS_MOCK_UI && Boolean(API_BASE_URL),
    staleTime: 60_000,
    retry: 2,
    refetchInterval: 120_000,
  });
}
