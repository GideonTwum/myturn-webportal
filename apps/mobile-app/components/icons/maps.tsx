import {
  Award,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  CreditCard,
  Handshake,
  PartyPopper,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import type { ActivityItem, NotificationItem } from "@/mock-data";

export const activityIconMap: Record<ActivityItem["type"], LucideIcon> = {
  contribution: CreditCard,
  payout: PartyPopper,
  milestone: Award,
  system: Bell,
  circle: Users,
};

export const notificationIconMap: Record<NotificationItem["category"], LucideIcon> = {
  payout: Bell,
  verification: ShieldCheck,
  contribution: Calendar,
  promo: TrendingUp,
};

export const emptyStateIcons = [Users, Wallet, Handshake, Sprout] as const;

export const profileStatIcons = {
  contributions: Handshake,
  groups: Users,
  paidOut: Wallet,
  onTime: BarChart3,
} as const;
