import type { ApiClient } from "./client";

export type TrustProfile = {
  memberAuthorizationLevel: string;
  ghanaCardVerificationStatus: string;
  ghanaCardMasked: string | null;
  verificationSubmittedAt: string | null;
  verificationApprovedAt: string | null;
  verificationRejectedAt: string | null;
  verificationRejectionReason: string | null;
  trust: {
    completedGroupsCount: number;
    missedContributionCount: number;
    contributionStreak: number;
    trustScore: number;
  };
  unlocks: {
    phoneVerified: boolean;
    ghanaCardVerified: boolean;
    canViewGroups: boolean;
    canContribute: boolean;
    canReceivePayouts: boolean;
  };
  onboardingSteps: Array<{ id: string; label: string; complete: boolean }>;
  /** True when API relaxes trust gates for testing (non-production by default). */
  stagingRelaxTrust?: boolean;
};

export type InvitePreview = {
  inviteCode: string;
  name: string;
  description: string | null;
  contributionAmount: string;
  payoutMode: string;
  frequency: string;
  adminName: string;
  groupStartDate: string | null;
  nextCycleStartEstimate: string | null;
  payoutPositionPreview: string;
  groupSize: number;
  currentMembers: number;
  availableSlots: number;
  daysPerCycle?: number;
  requiredDepositAmount?: string;
  depositHelp?: string;
  daysPerCycleHelp?: string;
};

export type PaymentRequestDto = {
  id: string;
  contributionId: string;
  groupId: string;
  amount: string;
  status: string;
  externalRef: string;
  expiresAt: string;
  approvedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  message?: string;
  mockApproveHint?: string;
  receipt?: { title: string; amount: string; reference: string };
};

export function createVerificationApi(client: ApiClient) {
  return {
    trustStatus() {
      return client.get<TrustProfile>("/member/verification/status", true);
    },
    submitGhanaCard(body: {
      ghanaCardNumber: string;
      selfieAssetKey?: string;
      cardImageAssetKey?: string;
    }) {
      return client.post<TrustProfile>(
        "/member/verification/ghana-card",
        body,
        true,
      );
    },
    invitePreview(inviteCode: string) {
      return client.get<InvitePreview>(
        `/groups/invite/${encodeURIComponent(inviteCode)}`,
        false,
      );
    },
    joinGroup(body: {
      inviteCode: string;
      fullName: string;
      phone: string;
      email?: string;
      password?: string;
    }) {
      return client.post<{ message: string; access_token: string; user: unknown }>(
        "/groups/join",
        body,
        false,
      );
    },
    initiatePayment(contributionId: string) {
      return client.post<PaymentRequestDto>(
        `/member/payment-requests/contributions/${contributionId}/initiate`,
        undefined,
        true,
      );
    },
    getPaymentRequest(id: string) {
      return client.get<PaymentRequestDto>(`/member/payment-requests/${id}`, true);
    },
    mockApprovePayment(id: string) {
      return client.post<PaymentRequestDto>(
        `/member/payment-requests/${id}/mock-approve`,
        undefined,
        true,
      );
    },
  };
}
