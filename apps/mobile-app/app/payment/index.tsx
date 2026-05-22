import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, CreditCard, Smartphone } from "lucide-react-native";
import { GlassHeader, GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { IconCircle } from "@/components/icons/IconCircle";
import { FadeInView } from "@/components/premium/motion";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs } from "@/lib/format-money";
import { usePaymentFlow } from "@/hooks/usePaymentFlow";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

type Step = 1 | 2 | 3;

export default function MoMoPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    contributionId?: string;
    amount?: string;
    groupName?: string;
  }>();
  const contributionId = params.contributionId ? String(params.contributionId) : undefined;
  const amount = params.amount ? String(params.amount) : "500";
  const groupName = params.groupName ? String(params.groupName) : "your circle";

  const [step, setStep] = useState<Step>(1);
  const [mockStep, setMockStep] = useState<Step>(1);
  const flow = usePaymentFlow(IS_MOCK_UI ? undefined : contributionId);

  useEffect(() => {
    if (!IS_MOCK_UI && flow.isApproved) {
      setStep(3);
    }
  }, [flow.isApproved]);

  async function confirmPay() {
    if (IS_MOCK_UI) {
      setMockStep(2);
      return;
    }
    if (!contributionId) return;
    try {
      await flow.startPayment();
      setStep(2);
    } catch {
      /* error surfaced below */
    }
  }

  async function simulateApprove() {
    if (IS_MOCK_UI) {
      setMockStep(3);
      return;
    }
    try {
      await flow.approvePayment();
      setStep(3);
    } catch {
      /* error surfaced below */
    }
  }

  const uiStep = IS_MOCK_UI ? mockStep : step;
  const displayAmount = flow.paymentRequest?.amount ?? amount;
  const err =
    flow.startError || flow.approveError
      ? (flow.startError ?? flow.approveError) instanceof Error
        ? (flow.startError ?? flow.approveError)!.message
        : "Payment failed"
      : null;

  return (
    <PremiumScreen
      header={
        <GlassHeader
          showBack
          title="MyTurn"
          onBack={() => {
            if (uiStep <= 1) {
              router.back();
              return;
            }
            if (IS_MOCK_UI) setMockStep((uiStep - 1) as Step);
            else setStep((uiStep - 1) as Step);
          }}
        />
      }
    >
      {uiStep === 1 ? (
        <PremiumCard>
          <IconCircle icon={CreditCard} size={64} iconSize="hero" style={styles.iconCenter} />
          <Text style={styles.h1}>Confirm Payment</Text>
          <Text style={styles.sub}>Contribute to {groupName}.</Text>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amount}>{formatGhs(displayAmount)}</Text>
          </View>
          {!IS_MOCK_UI && !contributionId ? (
            <Text style={styles.error}>Missing contribution — open payment from your group.</Text>
          ) : null}
          <GradientButton
            label={flow.isStarting ? "Starting…" : "Confirm & Pay"}
            onPress={confirmPay}
            disabled={flow.isStarting || (!IS_MOCK_UI && !contributionId)}
          />
        </PremiumCard>
      ) : null}

      {uiStep === 2 ? (
        <PremiumCard>
          <View style={styles.momoLogo}>
            <Text style={styles.momoText}>MoMo</Text>
          </View>
          <Text style={styles.h1}>Check your phone</Text>
          <Text style={styles.sub}>
            A payment prompt was sent to your MoMo number. Enter your PIN to authorize{" "}
            {formatGhs(displayAmount)}.
          </Text>
          <View style={styles.waiting}>
            <IconCircle icon={Smartphone} size={36} iconSize="md" backgroundColor="transparent" />
            <Text style={styles.waitingText}>
              {flow.isPending || flow.isApproving ? "Waiting for authorization…" : "Authorize on your phone"}
            </Text>
          </View>
          {err ? <Text style={styles.error}>{err}</Text> : null}
          <GradientButton
            label={flow.isApproving ? "Approving…" : "Simulate MoMo approval (staging)"}
            onPress={simulateApprove}
            disabled={flow.isApproving}
          />
          {(flow.isStarting || flow.isApproving) && !IS_MOCK_UI ? (
            <ActivityIndicator style={{ marginTop: 12 }} color={tokens.colors.primary} />
          ) : null}
          <Text style={styles.hint}>Staging: backend records payment, ledger, and notifications.</Text>
        </PremiumCard>
      ) : null}

      {uiStep === 3 ? (
        <FadeInView>
          <PremiumCard style={styles.receipt} animate={false}>
            <IconCircle icon={CheckCircle2} size={72} iconSize="display" color={tokens.colors.primary} />
            <Text style={styles.h1}>Payment Confirmed</Text>
            <Text style={styles.sub}>Successfully contributed to {groupName}</Text>
            <View style={styles.receiptLines}>
              <Text style={styles.line}>
                Reference · {flow.paymentRequest?.externalRef ?? "—"}
              </Text>
              <Text style={styles.line}>Amount · {formatGhs(displayAmount)}</Text>
              <Text style={styles.line}>
                Status · {flow.paymentRequest?.status ?? "APPROVED"}
              </Text>
            </View>
            <GradientButton label="Done" onPress={() => router.replace("/(main)/home")} />
          </PremiumCard>
        </FadeInView>
      ) : null}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  iconCenter: { alignSelf: "center", marginBottom: 12 },
  h1: {
    fontFamily: fonts.display,
    fontSize: 24,
    textAlign: "center",
    color: tokens.colors.onSurface,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    color: tokens.colors.onSurfaceVariant,
    marginVertical: 12,
  },
  amountBox: {
    backgroundColor: tokens.colors.surfaceContainerLow,
    padding: 20,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    marginVertical: 16,
  },
  amountLabel: { fontFamily: fonts.label, fontSize: 12, color: tokens.colors.onSurfaceVariant },
  amount: {
    fontFamily: fonts.displayExtra,
    fontSize: 36,
    color: tokens.colors.primary,
    marginTop: 4,
  },
  momoLogo: {
    alignSelf: "center",
    backgroundColor: tokens.colors.secondaryContainer,
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  momoText: { fontFamily: fonts.displayExtra, fontSize: 28, color: tokens.colors.onSecondaryContainer },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: tokens.colors.surfaceContainerLow,
    padding: 14,
    borderRadius: 12,
    marginVertical: 16,
  },
  waitingText: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.onSurfaceVariant },
  hint: {
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 12,
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: tokens.colors.error, textAlign: "center", marginBottom: 8 },
  receipt: { alignItems: "center", gap: 8 },
  receiptLines: {
    width: "100%",
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.colors.outlineVariant,
    paddingTop: 16,
    marginVertical: 16,
    gap: 8,
  },
  line: { fontFamily: fonts.body, fontSize: 14, color: tokens.colors.onSurfaceVariant },
});
