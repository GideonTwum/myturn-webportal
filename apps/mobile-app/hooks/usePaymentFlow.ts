import { useCallback, useState } from "react";
import {
  useInitiatePayment,
  useMockApprovePayment,
  usePaymentRequest,
} from "@/hooks/useMemberQueries";

export function usePaymentFlow(contributionId: string | undefined) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [mockApproveAvailable, setMockApproveAvailable] = useState(false);
  const initiate = useInitiatePayment();
  const approve = useMockApprovePayment();
  const poll = usePaymentRequest(requestId, Boolean(requestId));

  const startPayment = useCallback(async () => {
    if (!contributionId) throw new Error("Missing contribution");
    const req = await initiate.mutateAsync(contributionId);
    setRequestId(req.id);
    setMockApproveAvailable(
      Boolean(
        (req as { mockApproveHint?: string }).mockApproveHint?.trim(),
      ),
    );
    return req;
  }, [contributionId, initiate]);

  const approvePayment = useCallback(async () => {
    if (!requestId) throw new Error("No payment request");
    return approve.mutateAsync(requestId);
  }, [approve, requestId]);

  const status = poll.data?.status?.toUpperCase() ?? null;
  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED";
  const isFailed =
    status === "EXPIRED" || status === "FAILED" || Boolean(poll.data?.failureReason);

  return {
    requestId,
    mockApproveAvailable,
    paymentRequest: poll.data,
    startPayment,
    approvePayment,
    isStarting: initiate.isPending,
    isApproving: approve.isPending,
    isPending,
    isApproved,
    isFailed,
    error: initiate.error ?? approve.error ?? poll.error,
    startError: initiate.error,
    approveError: approve.error,
  };
}
