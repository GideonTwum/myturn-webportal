export const RESERVE_FULL_COVER_TITLE = "Contribution covered by reserve";

export const RESERVE_PARTIAL_COVER_TITLE = "Contribution partly covered";

export const RESERVE_DEFAULT_COVER_WALLET_PROMPT =
  "Your reserve was used to cover a missed contribution. Keep contributing on time to unlock the rest of your reserve.";

export function reserveFullCoverNotificationBody(groupName: string): string {
  return `Your missed contribution in ${groupName} was covered using your Contribution Guarantee Reserve. Your participation is active again. Please continue contributing on time to stay eligible. Repeated defaults may lead to further restrictions.`;
}

export function reservePartialCoverNotificationBody(groupName: string): string {
  return `Part of your missed contribution in ${groupName} was covered using your Contribution Guarantee Reserve. Please settle the remaining balance to restore full access.`;
}
