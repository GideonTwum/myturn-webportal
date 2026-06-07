import type { WalletActivityResponse } from "@myturn/api-client";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Wallet } from "lucide-react-native";
import {
  GlassHeader,
  GradientButton,
  PremiumCard,
  PremiumScreen,
} from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { formatGhs } from "@/lib/format-money";
import {
  useCreateMemberWithdrawal,
  useMemberWallet,
  useMemberWalletActivity,
  useMemberWithdrawals,
} from "@/hooks/useWalletQueries";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function WalletScreen() {
  const router = useRouter();
  const wallet = useMemberWallet(!IS_MOCK_UI);
  const activity = useMemberWalletActivity(!IS_MOCK_UI);
  const withdrawals = useMemberWithdrawals(!IS_MOCK_UI);
  const createWithdrawal = useCreateMemberWithdrawal();
  const [amount, setAmount] = useState("");
  const [momo, setMomo] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (IS_MOCK_UI) {
    return (
      <PremiumScreen header={<GlassHeader showBack />}>
        <Text style={styles.h1}>Wallet unavailable in demo mode</Text>
      </PremiumScreen>
    );
  }

  async function onWithdraw() {
    setError(null);
    try {
      await createWithdrawal.mutateAsync({ amount: amount.trim(), momoNumber: momo.trim() });
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    }
  }

  const w = wallet.data;
  type ActivityItem = WalletActivityResponse["activity"][number];

  return (
    <PremiumScreen header={<GlassHeader showBack />}>
      <PremiumCard animate={false}>
        <View style={styles.row}>
          <PremiumIcon icon={Wallet} size="lg" color={tokens.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Available balance</Text>
            <Text style={styles.balance}>
              {w ? formatGhs(w.availableBalance) : "—"}
            </Text>
            <Text style={styles.meta}>
              Total credited · {w ? formatGhs(w.balance) : "—"} · Pending withdrawals{" "}
              {w ? formatGhs(w.pendingWithdrawals) : "—"}
            </Text>
            <Text style={styles.meta}>
              Payouts credited · {w?.payoutsCreditedCount ?? 0} · Withdrawn{" "}
              {w ? formatGhs(w.totalWithdrawn) : "—"}
            </Text>
          </View>
        </View>
      </PremiumCard>

      <Text style={styles.section}>Withdraw to MoMo</Text>
      <PremiumCard variant="flat">
        <Text style={styles.hint}>
          Withdrawals are processed manually during beta. You will be notified when sent.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Amount (GHS)"
          placeholderTextColor={tokens.colors.outline + "99"}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="MoMo number"
          placeholderTextColor={tokens.colors.outline + "99"}
          keyboardType="phone-pad"
          value={momo}
          onChangeText={setMomo}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GradientButton
          label={createWithdrawal.isPending ? "Submitting…" : "Request withdrawal"}
          onPress={onWithdraw}
          disabled={createWithdrawal.isPending}
        />
      </PremiumCard>

      <Text style={styles.section}>Withdrawal requests</Text>
      {(withdrawals.data?.withdrawals ?? []).length === 0 ? (
        <Text style={styles.hint}>No withdrawal requests yet.</Text>
      ) : (
        (withdrawals.data?.withdrawals ?? []).slice(0, 5).map((wd) => (
          <PremiumCard key={wd.id} variant="flat" style={{ marginBottom: 8 }} animate={false}>
            <Text style={styles.activityTitle}>
              GHS {wd.amount} → {wd.momoNumber}
            </Text>
            <Text style={styles.activityMeta}>
              {wd.status} · {new Date(wd.requestedAt).toLocaleString()}
            </Text>
          </PremiumCard>
        ))
      )}

      <Text style={styles.section}>Recent activity</Text>
      {activity.isLoading ? (
        <ActivityIndicator color={tokens.colors.primary} />
      ) : (
        (activity.data?.activity ?? []).slice(0, 8).map((a: ActivityItem) => (
          <PremiumCard key={a.id} variant="flat" style={{ marginBottom: 8 }} animate={false}>
            <Text style={styles.activityTitle}>{a.description ?? a.referenceType}</Text>
            <Text style={styles.activityMeta}>
              {Number(a.delta) >= 0 ? "+" : ""}
              {formatGhs(a.delta)} · {new Date(a.createdAt).toLocaleString()}
            </Text>
          </PremiumCard>
        ))
      )}

      <Pressable onPress={() => router.push("/(main)/profile" as Href)} style={{ marginTop: 16 }}>
        <Text style={styles.link}>Back</Text>
      </Pressable>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 20, color: tokens.colors.onSurface },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  label: { fontFamily: fonts.label, fontSize: 13, color: tokens.colors.onSurfaceVariant },
  balance: { fontFamily: fonts.display, fontSize: 28, color: tokens.colors.onSurface },
  meta: { fontFamily: fonts.body, fontSize: 13, color: tokens.colors.onSurfaceVariant, marginTop: 4 },
  section: {
    fontFamily: fonts.display,
    fontSize: 18,
    marginTop: 20,
    marginBottom: 8,
    color: tokens.colors.onSurface,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, color: tokens.colors.onSurfaceVariant, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.outline + "44",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    fontFamily: fonts.body,
    color: tokens.colors.onSurface,
  },
  error: { color: tokens.colors.error, marginBottom: 8, fontFamily: fonts.body },
  activityTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: tokens.colors.onSurface },
  activityMeta: { fontFamily: fonts.body, fontSize: 12, color: tokens.colors.onSurfaceVariant, marginTop: 4 },
  link: { textAlign: "center", color: tokens.colors.primary, fontFamily: fonts.bodyMedium },
});
