import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { IS_MOCK_UI } from "@/constants/app-mode";

export const POLL_NORMAL_MS = 15_000;
export const POLL_PAYMENT_MS = 2_000;

export const memberKeys = {
  me: ["member", "me"] as const,
  groups: ["member", "groups"] as const,
  group: (id: string) => ["member", "group", id] as const,
  groupMembers: (id: string) => ["member", "group-members", id] as const,
  payouts: ["member", "payouts"] as const,
  payments: ["member", "payments"] as const,
  notifications: ["member", "notifications"] as const,
  trust: ["member", "trust"] as const,
  invite: (code: string) => ["invite", code] as const,
  paymentRequest: (id: string) => ["member", "payment-request", id] as const,
};

export function useInvalidateMemberData() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["member"] });
    await qc.invalidateQueries({ queryKey: ["invite"] });
  }, [qc]);
}

const queryDefaults = {
  staleTime: POLL_NORMAL_MS / 2,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

export function useMemberMe(enabled = true) {
  return useQuery({
    queryKey: memberKeys.me,
    queryFn: () => api.auth.memberMe(),
    enabled: enabled && !IS_MOCK_UI,
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useMemberGroups(enabled = true) {
  return useQuery({
    queryKey: memberKeys.groups,
    queryFn: () => api.groups.list(),
    enabled: enabled && !IS_MOCK_UI,
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useMemberGroup(groupId: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.group(groupId),
    queryFn: () => api.groups.get(groupId),
    enabled: enabled && !IS_MOCK_UI && Boolean(groupId),
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useMemberGroupMembers(groupId: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.groupMembers(groupId),
    queryFn: () => api.groups.listMembers(groupId),
    enabled: enabled && !IS_MOCK_UI && Boolean(groupId),
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useMemberPayouts(enabled = true) {
  return useQuery({
    queryKey: memberKeys.payouts,
    queryFn: () => api.payouts.list(),
    enabled: enabled && !IS_MOCK_UI,
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useMemberPayments(enabled = true) {
  return useQuery({
    queryKey: memberKeys.payments,
    queryFn: () => api.payments.list(),
    enabled: enabled && !IS_MOCK_UI,
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useMemberNotifications(enabled = true) {
  return useQuery({
    queryKey: memberKeys.notifications,
    queryFn: () => api.notifications.list(),
    enabled: enabled && !IS_MOCK_UI,
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.delete(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: memberKeys.notifications });
    },
  });
}

export function useClearAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.notifications.clearAll(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: memberKeys.notifications });
    },
  });
}

export function useTrustProfile(enabled = true) {
  return useQuery({
    queryKey: memberKeys.trust,
    queryFn: () => api.verification.trustStatus(),
    enabled: enabled && !IS_MOCK_UI,
    refetchInterval: POLL_NORMAL_MS,
    ...queryDefaults,
  });
}

export function useInvitePreview(inviteCode: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.invite(inviteCode),
    queryFn: () => api.verification.invitePreview(inviteCode),
    enabled: enabled && !IS_MOCK_UI && Boolean(inviteCode),
  });
}

export function usePaymentRequest(requestId: string | null, enabled = true) {
  return useQuery({
    queryKey: memberKeys.paymentRequest(requestId ?? ""),
    queryFn: () => api.verification.getPaymentRequest(requestId!),
    enabled: enabled && !IS_MOCK_UI && Boolean(requestId),
    refetchInterval: (query) => {
      const status = String(query.state.data?.status ?? "").toUpperCase();
      if (status === "PENDING") return POLL_PAYMENT_MS;
      return false;
    },
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => api.auth.otpRequest(phone),
  });
}

export function useSubmitGhanaCard() {
  const invalidate = useInvalidateMemberData();
  return useMutation({
    mutationFn: (body: { ghanaCardNumber: string }) =>
      api.verification.submitGhanaCard(body),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useJoinGroup() {
  const invalidate = useInvalidateMemberData();
  return useMutation({
    mutationFn: (body: {
      inviteCode: string;
      fullName: string;
      phone: string;
    }) => api.verification.joinGroup(body),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: (contributionId: string) =>
      api.verification.initiatePayment(contributionId),
  });
}

export function useMockApprovePayment() {
  const invalidate = useInvalidateMemberData();
  return useMutation({
    mutationFn: (requestId: string) => api.verification.mockApprovePayment(requestId),
    onSuccess: async () => {
      await invalidate();
    },
  });
}
