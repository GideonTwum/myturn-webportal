import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { IS_MOCK_UI } from "@/constants/app-mode";

export const memberKeys = {
  wallet: ["member", "wallet"] as const,
  walletActivity: ["member", "wallet", "activity"] as const,
  withdrawals: ["member", "withdrawals"] as const,
};

export function useMemberWallet(enabled = true) {
  return useQuery({
    queryKey: memberKeys.wallet,
    queryFn: () => api.wallet.memberSummary(),
    enabled: enabled && !IS_MOCK_UI,
  });
}

export function useMemberWalletActivity(enabled = true) {
  return useQuery({
    queryKey: memberKeys.walletActivity,
    queryFn: () => api.wallet.memberActivity(),
    enabled: enabled && !IS_MOCK_UI,
  });
}

export function useMemberWithdrawals(enabled = true) {
  return useQuery({
    queryKey: memberKeys.withdrawals,
    queryFn: () => api.wallet.memberListWithdrawals(),
    enabled: enabled && !IS_MOCK_UI,
  });
}

export function useCreateMemberWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { amount: string; momoNumber: string }) =>
      api.wallet.memberCreateWithdrawal(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: memberKeys.wallet });
      void qc.invalidateQueries({ queryKey: memberKeys.withdrawals });
      void qc.invalidateQueries({ queryKey: memberKeys.walletActivity });
    },
  });
}
