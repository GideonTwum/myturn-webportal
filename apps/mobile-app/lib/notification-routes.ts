import type { NotificationMetadata, NotificationRow } from "@myturn/api-client";

export type NotificationRoute =
  | { pathname: "/(main)/groups/[id]"; params: { id: string; celebrate?: string } }
  | { pathname: "/payment"; params: { contributionId: string; amount?: string; groupName?: string } }
  | { pathname: "/(onboarding)/ghana-card" }
  | { pathname: "/(onboarding)/verification-pending" }
  | { pathname: "/notifications" };

function metaOf(n: NotificationRow): NotificationMetadata {
  return (n.metadata ?? {}) as NotificationMetadata;
}

export function resolveNotificationRoute(n: NotificationRow): NotificationRoute {
  const type = n.type.toUpperCase();
  const meta = metaOf(n);

  if (
    (type.includes("VERIFY") || type.includes("TRUST") || type.includes("GHANA")) &&
    !meta.groupId
  ) {
    if (type.includes("PENDING")) {
      return { pathname: "/(onboarding)/verification-pending" };
    }
    return { pathname: "/(onboarding)/ghana-card" };
  }

  if (type.includes("PAYOUT") && meta.groupId) {
    return {
      pathname: "/(main)/groups/[id]",
      params: { id: meta.groupId, celebrate: "1" },
    };
  }

  if (
    (type.includes("PAYMENT") || type.includes("CONTRIBUTION")) &&
    meta.contributionId
  ) {
    return {
      pathname: "/payment",
      params: {
        contributionId: meta.contributionId,
        groupName: undefined,
        amount: meta.amount,
      },
    };
  }

  if (meta.groupId) {
    return { pathname: "/(main)/groups/[id]", params: { id: meta.groupId } };
  }

  return { pathname: "/notifications" };
}

export function shouldShowViewAction(n: NotificationRow): boolean {
  const type = n.type.toUpperCase();
  return (
    type.includes("PAYOUT") ||
    type.includes("PAYMENT") ||
    type.includes("CONTRIBUTION") ||
    type.includes("GROUP") ||
    type.includes("VERIFY") ||
    type.includes("TRUST") ||
    Boolean(metaOf(n).groupId)
  );
}
