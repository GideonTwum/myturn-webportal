import { tokens } from "./tokens";

export const fonts = {
  display: "PlusJakartaSans_700Bold",
  displayExtra: "PlusJakartaSans_800ExtraBold",
  displaySemi: "PlusJakartaSans_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  label: "Inter_600SemiBold",
} as const;

export const type = {
  display: { fontFamily: fonts.displayExtra, fontSize: 40, lineHeight: 48, letterSpacing: -1 },
  headlineLg: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36 },
  headlineMd: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  bodyLg: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: tokens.colors.onSurfaceVariant },
  bodyMd: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: tokens.colors.onSurfaceVariant },
  labelMd: { fontFamily: fonts.label, fontSize: 14, lineHeight: 20, letterSpacing: 0.5 },
  labelSm: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
} as const;
