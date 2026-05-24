import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { FadeInView, ShimmerLoader } from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { useAuth } from "@/providers/AuthProvider";
import { getPendingInviteCode } from "@/lib/invite-storage";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function SplashScreen() {
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(async () => {
      if (IS_MOCK_UI) {
        router.replace("/invite/DEMO2024");
        return;
      }
      if (token) {
        router.replace("/(main)/home");
        return;
      }
      const invite = await getPendingInviteCode();
      if (invite) {
        router.replace(`/invite/${invite}`);
      } else {
        router.replace("/(onboarding)/phone");
      }
    }, isLoading ? 3200 : 2400);
    return () => clearTimeout(t);
  }, [router, token, isLoading]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -10, duration: 1500, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <LinearGradient colors={[tokens.colors.primary, tokens.colors.primaryContainer]} style={styles.root}>
      <FadeInView>
        <Animated.View style={{ transform: [{ translateY: float }] }}>
          <View style={styles.logo}>
            <PremiumIcon icon={RefreshCw} size="hero" color={tokens.colors.onPrimary} />
          </View>
        </Animated.View>
        <Text style={styles.title}>MyTurn Susu</Text>
        <Text style={styles.tag}>Community savings, built on trust</Text>
      </FadeInView>
      <View style={styles.loader}>
        <ShimmerLoader width={200} height={4} />
        <Text style={styles.loading}>Preparing your experience…</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.displayExtra,
    fontSize: 42,
    color: tokens.colors.onPrimary,
    textAlign: "center",
  },
  tag: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: tokens.colors.onPrimary,
    opacity: 0.85,
    textAlign: "center",
    marginTop: 8,
  },
  loader: { position: "absolute", bottom: 80, alignItems: "center", gap: 12 },
  loading: { fontFamily: fonts.label, fontSize: 12, color: tokens.colors.onPrimary, opacity: 0.7 },
});
