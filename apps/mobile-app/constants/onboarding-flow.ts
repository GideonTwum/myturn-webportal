export const ONBOARDING_FLOW = [
  { id: "phone", label: "Phone verification" },
  { id: "otp", label: "OTP" },
  { id: "groups", label: "View groups" },
  { id: "ghana_card", label: "Ghana Card" },
  { id: "participation", label: "Join & contribute" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_FLOW)[number]["id"];
