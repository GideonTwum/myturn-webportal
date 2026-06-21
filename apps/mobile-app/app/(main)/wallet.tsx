import type { ReserveDetail, WalletActivityResponse } from "@myturn/api-client";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { HelpCircle, Wallet } from "lucide-react-native";
import {
  GlassHeader,
  GradientButton,
  PremiumCard,
  PremiumScreen,
} from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs } from "@/lib/format-money";
import { parseMoneyAmount } from "@/lib/parse-amount";
import {
  enhanceWithdrawalErrorMessage,
  reserveExceedsAvailableMessage,
} from "@/lib/wallet-withdrawal-messages";
import { AuthPromptModal } from "@/components/guest/AuthPromptModal";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  useCreateMemberWithdrawal,
  useMemberWallet,
  useMemberWalletActivity,
  useMemberWithdrawals,
} from "@/hooks/useWalletQueries";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

function SummaryBlock({
  title,
  amount,
  subtitle,
  highlight,
}: {
  title: string;
  amount: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={[styles.summaryAmount, highlight && styles.summaryAmountHighlight]}>
        {amount}
      </Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const {
    isAuthenticated,
    promptVisible,
    closePrompt,
    startAuth,
    onLogin,
    onSignUp,
  } = useRequireAuth();

  const wallet = useMemberWallet(isAuthenticated && !IS_MOCK_UI);
  const activity = useMemberWalletActivity(isAuthenticated && !IS_MOCK_UI);
  const withdrawals = useMemberWithdrawals(isAuthenticated && !IS_MOCK_UI);
  const createWithdrawal = useCreateMemberWithdrawal();
  const [amount, setAmount] = useState("");
  const [momo, setMomo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const w = wallet.data;
  const availableNum = Number(w?.availableBalance ?? 0);
  const reservedNum = Number(w?.reservedBalance ?? 0);
  const hasReserve = reservedNum > 0.005;
  const hasActiveReserves =
    hasReserve ||
    (w?.activeReserveCount ?? 0) > 0 ||
    (w?.reserveDetails?.length ?? 0) > 0;
  const availableLabel = w ? formatGhs(w.availableBalance) : "—";
  const reservedLabel = w ? formatGhs(w.reservedBalance ?? "0") : "—";

  const withdrawPreview = useMemo(() => {
    const requested = parseMoneyAmount(amount);
    if (requested == null) return null;
    if (requested > availableNum) {
      return {
        type: "error" as const,
        text: hasReserve
          ? reserveExceedsAvailableMessage(availableNum, reservedNum)
          : `You can withdraw up to ${formatGhs(availableNum)}.`,
      };
    }
    return {
      type: "ok" as const,
      text: `After this withdrawal, about ${formatGhs(availableNum - requested)} will remain available.`,
    };
  }, [amount, availableNum, reservedNum, hasReserve]);

  if (IS_MOCK_UI) {
    return (
      <PremiumScreen header={<GlassHeader showBack />}>
        <Text style={styles.h1}>Wallet unavailable in demo mode</Text>
      </PremiumScreen>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <PremiumScreen header={<GlassHeader showBack />}>
          <Text style={styles.h1}>MyTurn Wallet</Text>
          <Text style={styles.guestSub}>
            Log in or sign up to view your balance, reserves, and withdrawals.
          </Text>
          <GradientButton
            label="Log in or sign up"
            onPress={() => void startAuth("login", "/(main)/wallet")}
            style={{ marginTop: 20 }}
          />
        </PremiumScreen>
        <AuthPromptModal
          visible={promptVisible}
          onClose={closePrompt}
          onLogin={onLogin}
          onSignUp={onSignUp}
        />
      </>
    );
  }

  async function onWithdraw() {
    setError(null);
    const requested = parseMoneyAmount(amount);
    if (requested == null) {
      setError("Enter a valid withdrawal amount.");
      return;
    }
    if (requested > availableNum) {
      setError(
        hasReserve
          ? reserveExceedsAvailableMessage(availableNum, reservedNum)
          : `You can currently withdraw up to ${formatGhs(availableNum)}.`,
      );
      return;
    }
    try {
      await createWithdrawal.mutateAsync({
        amount: amount.trim(),
        momoNumber: momo.trim(),
      });
      setAmount("");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Withdrawal failed";
      setError(enhanceWithdrawalErrorMessage(raw, availableNum));
    }
  }

  type ActivityItem = WalletActivityResponse["activity"][number];
  const reserves = w?.reserveDetails ?? [];

  return (
    <PremiumScreen header={<GlassHeader showBack />}>
      <Text style={styles.sectionHeading}>Wallet summary</Text>
      <PremiumCard animate={false}>
        <View style={styles.row}>
          <PremiumIcon icon={Wallet} size="lg" color={tokens.colors.primary} />
          <View style={{ flex: 1 }}>
            <SummaryBlock
              title="Available balance"
              amount={availableLabel}
              subtitle="Available to withdraw now"
              highlight
            />
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <SummaryBlock
          title="Reserved balance"
          amount={reservedLabel}
          subtitle="Contribution Guarantee Reserve"
          highlight={hasReserve}
        />

        {!hasReserve ? (
          <Text style={styles.zeroReserveNote}>No reserved funds right now.</Text>
        ) : null}

        <View style={styles.summaryDivider} />

        <SummaryBlock
          title="Total wallet"
          amount={w ? formatGhs(w.totalBalance ?? w.balance) : "—"}
          subtitle="Available + Reserved"
        />

        <View style={styles.summaryDivider} />

        <SummaryBlock
          title="Pending withdrawals"
          amount={w ? formatGhs(w.pendingWithdrawals) : "—"}
          subtitle="Being processed"
        />
      </PremiumCard>

      {w?.reserveDefaultCoverPrompt?.fullyCovered ? (
        <PremiumCard variant="flat" style={{ marginTop: 12 }} animate={false}>
          <View style={styles.explainHeader}>
            <HelpCircle size={18} color={tokens.colors.primary} />
            <Text style={styles.explainTitle}>Reserve used for your group</Text>
          </View>
          <Text style={styles.explainBody}>{w.reserveDefaultCoverPrompt.message}</Text>
        </PremiumCard>
      ) : null}

      {hasActiveReserves ? (
        <PremiumCard variant="flat" style={{ marginTop: 12 }} animate={false}>
          <View style={styles.explainHeader}>
            <HelpCircle size={18} color={tokens.colors.primary} />
            <Text style={styles.explainTitle}>
              What is Contribution Guarantee Reserve?
            </Text>
          </View>
          <Text style={styles.explainBody}>
            To protect everyone in your group, a portion of early payouts is
            temporarily reserved. This reserve unlocks automatically as you
            continue making successful contributions.
          </Text>
          <Text style={styles.explainBody}>
            Each successful contribution releases part of your reserved balance
            into your available wallet.
          </Text>
        </PremiumCard>
      ) : null}

      {reserves.length > 0 ? (
        <>
          <Text style={styles.section}>Contribution Guarantee Reserve</Text>
          {reserves.map((r: ReserveDetail) => (
            <PremiumCard
              key={`${r.groupId}-${r.payoutCycle}`}
              variant="flat"
              style={{ marginBottom: 8 }}
              animate={false}
            >
              <Text style={styles.activityTitle}>Group: {r.groupName}</Text>
              <View style={styles.reserveDetailGrid}>
                <Text style={styles.reserveDetailLine}>
                  Reserved: {formatGhs(r.remainingReserveAmount)}
                </Text>
                <Text style={styles.reserveDetailLine}>
                  Released: {formatGhs(r.releasedAmount)}
                </Text>
                <Text style={styles.reserveDetailLine}>
                  Next unlock: {formatGhs(r.nextUnlockAmount)}
                </Text>
                <Text style={styles.reserveDetailLine}>
                  Progress: {r.releaseProgressPercent}%
                </Text>
                <Text style={styles.reserveDetailLine}>
                  Remaining contributions: {r.remainingContributionUnits}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, r.releaseProgressPercent)}%` },
                  ]}
                />
              </View>
              <Text style={styles.unlockHint}>
                Next unlock happens after your next successful contribution.
              </Text>
            </PremiumCard>
          ))}
        </>
      ) : null}

      <Text style={styles.section}>Withdraw to MoMo</Text>
      <PremiumCard variant="flat">
        <View style={styles.withdrawContext}>
          <View style={styles.withdrawContextRow}>
            <Text style={styles.withdrawContextLabel}>Available to withdraw</Text>
            <Text style={styles.withdrawContextValue}>{availableLabel}</Text>
          </View>
          <View style={styles.withdrawContextRow}>
            <Text style={styles.withdrawContextLabel}>Reserved balance</Text>
            <Text style={styles.withdrawContextValue}>{reservedLabel}</Text>
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder={`Enter amount up to ${availableLabel}`}
          placeholderTextColor={tokens.colors.outline + "99"}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            setError(null);
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="MoMo number"
          placeholderTextColor={tokens.colors.outline + "99"}
          keyboardType="phone-pad"
          value={momo}
          onChangeText={setMomo}
        />
        {withdrawPreview ? (
          <Text
            style={
              withdrawPreview.type === "error"
                ? styles.previewError
                : styles.previewOk
            }
          >
            {withdrawPreview.text}
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GradientButton
          label={createWithdrawal.isPending ? "Processing…" : "Withdraw to MoMo"}
          onPress={onWithdraw}
          disabled={createWithdrawal.isPending}
        />
        <Text style={styles.ctaHelper}>
          Only available balance can be withdrawn. Reserved funds unlock after
          successful contributions.
        </Text>
      </PremiumCard>

      <Text style={styles.section}>Withdrawal requests</Text>
      {(withdrawals.data?.withdrawals ?? []).length === 0 ? (
        <Text style={styles.hint}>No withdrawal requests yet.</Text>
      ) : (
        (withdrawals.data?.withdrawals ?? []).slice(0, 5).map((wd) => (
          <PremiumCard
            key={wd.id}
            variant="flat"
            style={{ marginBottom: 8 }}
            animate={false}
          >
            <Text style={styles.activityTitle}>
              GHS {wd.amount} → {wd.momoNumber}
            </Text>
            <Text style={styles.activityMeta}>
              {wd.status === "COMPLETED"
                ? `GHS ${wd.amount} sent to your MoMo wallet`
                : wd.status === "FAILED"
                  ? "Withdrawal failed — funds returned to wallet"
                  : wd.status === "PROCESSING"
                    ? "Processing automatically…"
                    : wd.status}{" "}
              · {new Date(wd.requestedAt).toLocaleString()}
            </Text>
          </PremiumCard>
        ))
      )}

      <Text style={styles.section}>Recent activity</Text>
      {activity.isLoading ? (
        <ActivityIndicator color={tokens.colors.primary} />
      ) : (
        (activity.data?.activity ?? []).slice(0, 8).map((a: ActivityItem) => (
          <PremiumCard
            key={a.id}
            variant="flat"
            style={{ marginBottom: 8 }}
            animate={false}
          >
            <Text style={styles.activityTitle}>
              {a.description ?? a.referenceType}
            </Text>
            <Text style={styles.activityMeta}>
              {Number(a.delta) >= 0 ? "+" : ""}
              {formatGhs(a.delta)} · {new Date(a.createdAt).toLocaleString()}
            </Text>
          </PremiumCard>
        ))
      )}

      <Pressable
        onPress={() => router.push("/(main)/profile" as Href)}
        style={{ marginTop: 16 }}
      >
        <Text style={styles.link}>Back</Text>
      </Pressable>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: tokens.colors.onSurface,
  },
  guestSub: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 12,
    lineHeight: 22,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sectionHeading: {
    fontFamily: fonts.display,
    fontSize: 18,
    marginBottom: 8,
    color: tokens.colors.onSurface,
  },
  summaryBlock: { marginBottom: 4 },
  summaryTitle: {
    fontFamily: fonts.label,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: tokens.colors.onSurfaceVariant,
  },
  summaryAmount: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: tokens.colors.onSurface,
    marginTop: 2,
  },
  summaryAmountHighlight: {
    fontSize: 28,
    color: tokens.colors.primary,
  },
  summarySubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: tokens.colors.outline + "33",
    marginVertical: 12,
  },
  zeroReserveNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 4,
    fontStyle: "italic",
  },
  explainHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  explainTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: tokens.colors.onSurface,
    flex: 1,
  },
  explainBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 8,
  },
  section: {
    fontFamily: fonts.display,
    fontSize: 18,
    marginTop: 20,
    marginBottom: 8,
    color: tokens.colors.onSurface,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.onSurfaceVariant,
    marginBottom: 12,
  },
  withdrawContext: {
    backgroundColor: tokens.colors.surfaceVariant + "44",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  withdrawContextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  withdrawContextLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: tokens.colors.onSurfaceVariant,
  },
  withdrawContextValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: tokens.colors.onSurface,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.outline + "44",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    fontFamily: fonts.body,
    color: tokens.colors.onSurface,
  },
  previewOk: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.primary,
    marginBottom: 8,
    lineHeight: 18,
  },
  previewError: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.error,
    marginBottom: 8,
    lineHeight: 20,
  },
  error: {
    color: tokens.colors.error,
    marginBottom: 8,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  ctaHelper: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 17,
  },
  reserveDetailGrid: { marginTop: 8, gap: 4 },
  reserveDetailLine: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: tokens.colors.onSurface,
  },
  unlockHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 8,
    fontStyle: "italic",
  },
  activityTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: tokens.colors.onSurface,
  },
  activityMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: tokens.colors.outline + "33",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: tokens.colors.primary,
    borderRadius: 3,
  },
  link: {
    textAlign: "center",
    color: tokens.colors.primary,
    fontFamily: fonts.bodyMedium,
  },
});
