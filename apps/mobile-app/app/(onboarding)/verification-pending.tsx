import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Clock3, CheckCircle2 } from "lucide-react-native";
import { GradientButton, PremiumCard, PremiumScreen } from "@/components/premium";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { useTrustProfile } from "@/hooks/useMemberQueries";
import { tokens } from "@/constants/tokens";
import { fonts } from "@/constants/typography";

export default function VerificationPendingScreen() {
  const router = useRouter();
  const trustQuery = useTrustProfile(!IS_MOCK_UI);
  const [progress, setProgress] = useState(15);
  const pulseScale = useRef(new Animated.Value(0.9)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const float = useRef(new Animated.Value(0)).current;

  const verified =
    trustQuery.data?.unlocks.ghanaCardVerified ||
    trustQuery.data?.stagingRelaxTrust;

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => (p >= 88 ? 88 : p + 2));
    }, 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (IS_MOCK_UI) {
      const done = setTimeout(() => router.replace("/(onboarding)/group-preview"), 3500);
      return () => clearTimeout(done);
    }
    if (verified) {
      const done = setTimeout(() => router.replace("/(onboarding)/join"), 1200);
      return () => clearTimeout(done);
    }
  }, [router, verified]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 0.9, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.25, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
        ]),
      ]),
    );
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -6, duration: 1250, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1250, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    bob.start();
    return () => {
      pulse.stop();
      bob.stop();
    };
  }, [float, pulseOpacity, pulseScale]);

  return (
    <PremiumScreen noPad>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.pulse,
            { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
          ]}
        />
        <Animated.View style={[styles.badge, { transform: [{ translateY: float }] }]}>
          <PremiumIcon icon={CheckCircle2} size="xxl" color={tokens.colors.onPrimary} />
        </Animated.View>
        <Text style={styles.h1}>We're verifying your details</Text>
        <Text style={styles.sub}>
          Our community safety team is reviewing your profile to keep the circles secure.
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.eta}>
          <PremiumIcon icon={Clock3} size="sm" color={tokens.colors.onSecondaryContainer} />
          <Text style={styles.etaText}>
            {IS_MOCK_UI
              ? "Demo: auto-continuing…"
              : verified
                ? "Verified — continuing…"
                : "Usually within a few minutes on staging"}
          </Text>
        </View>
        <PremiumCard style={styles.tip} animate={false}>
          <Text style={styles.tipTitle}>Did you know?</Text>
          <Text style={styles.tipBody}>
            Verified members have a 40% higher chance of being invited to private savings circles.
          </Text>
        </PremiumCard>
      </View>
      <View style={styles.footer}>
        <GradientButton
          label="Continue"
          onPress={() =>
            router.replace(verified ? "/(onboarding)/join" : "/(onboarding)/group-preview")
          }
        />
        <Text style={styles.note}>We'll notify you as soon as you're clear!</Text>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.mobile,
    paddingTop: 80,
  },
  pulse: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: tokens.colors.primary + "18",
  },
  badge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 26,
    textAlign: "center",
    color: tokens.colors.onSurface,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    color: tokens.colors.onSurfaceVariant,
    marginTop: 12,
    maxWidth: 300,
    lineHeight: 22,
  },
  track: {
    width: "100%",
    height: 8,
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: 4,
    marginTop: 28,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: tokens.colors.primary },
  eta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tokens.colors.secondaryContainer + "44",
    borderRadius: tokens.radius.pill,
  },
  etaText: { fontFamily: fonts.label, fontSize: 13, color: tokens.colors.onSecondaryContainer },
  tip: { marginTop: 32, width: "100%" },
  tipTitle: { fontFamily: fonts.label, fontSize: 14, color: tokens.colors.onSurface },
  tipBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: tokens.colors.onSurfaceVariant,
    marginTop: 6,
    lineHeight: 18,
  },
  footer: {
    padding: tokens.spacing.mobile,
    paddingBottom: 32,
    backgroundColor: tokens.colors.background,
  },
  note: {
    textAlign: "center",
    marginTop: 12,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: tokens.colors.onSurfaceVariant,
  },
});
