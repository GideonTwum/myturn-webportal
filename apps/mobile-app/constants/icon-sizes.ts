/** Consistent Lucide icon sizing for premium UI. */
export const iconSizes = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
  hero: 40,
  display: 48,
} as const;

export type IconSizeKey = keyof typeof iconSizes;

/** Thin elegant strokes — Lucide default feel. */
export const iconStroke = {
  hairline: 1.5,
  default: 1.75,
  emphasis: 2,
} as const;
