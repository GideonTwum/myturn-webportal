import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { ONBOARDING_FLOW, type OnboardingStepId } from "@/constants/onboarding-flow";
import { useTrustProfile } from "@/hooks/useMemberQueries";
import { useAuth } from "@/providers/AuthProvider";

type Props = {
  /** Highlights the step you're on in the flow. */
  currentStepId: OnboardingStepId;
};

export function OnboardingProgress({ currentStepId }: Props) {
  const { token } = useAuth();
  const trust = useTrustProfile(Boolean(token));
  const trustSteps = trust.data?.onboardingSteps;
  const currentIndex = ONBOARDING_FLOW.findIndex((s) => s.id === currentStepId);

  const steps = ONBOARDING_FLOW.map((step, index) => {
    const fromApi = trustSteps?.find((t: { id: string }) => t.id === step.id);
    const complete =
      fromApi?.complete ??
      (currentIndex >= 0 && index < currentIndex);
    return {
      id: step.id,
      label: step.label,
      complete,
      current: step.id === currentStepId,
    };
  });

  return <ProgressSteps steps={steps} />;
}
