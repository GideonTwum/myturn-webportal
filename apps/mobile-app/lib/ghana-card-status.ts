export function ghanaCardStatusLabel(status?: string | null): string {
  switch (status) {
    case "VERIFIED":
      return "Verified";
    case "PENDING":
      return "Pending review";
    case "REJECTED":
      return "Not verified";
    default:
      return "Not verified";
  }
}

export function needsGhanaCardForContribute(
  ghanaCardVerificationStatus?: string | null,
  ghanaCardVerifiedUnlock?: boolean,
): boolean {
  if (ghanaCardVerifiedUnlock) return false;
  return ghanaCardVerificationStatus !== "VERIFIED";
}
