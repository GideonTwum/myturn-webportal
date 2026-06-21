import type { NotificationRow } from "@myturn/api-client";
import { shouldShowViewAction } from "@/lib/notification-routes";
import type { ActivityItem, NotificationItem } from "@/mock-data";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GH", { month: "short", day: "numeric" });
}

function activityTypeFromNotification(type: string): ActivityItem["type"] {
  const t = type.toUpperCase();
  if (t.includes("PAYOUT")) return "payout";
  if (
    t.includes("PAYMENT") ||
    t.includes("CONTRIBUTION") ||
    t.includes("RESERVE")
  ) {
    return "contribution";
  }
  if (t.includes("VERIFY") || t.includes("TRUST")) return "system";
  if (t.includes("GROUP") || t.includes("CIRCLE")) return "circle";
  return "system";
}

function notificationCategory(type: string): NotificationItem["category"] {
  const t = type.toUpperCase();
  if (t.includes("PAYOUT")) return "payout";
  if (t.includes("VERIFY") || t.includes("TRUST")) return "verification";
  if (
    t.includes("PAYMENT") ||
    t.includes("CONTRIBUTION") ||
    t.includes("RESERVE")
  ) {
    return "contribution";
  }
  return "promo";
}

export function notificationsToActivity(notifications: NotificationRow[]): ActivityItem[] {
  return notifications.map((n) => ({
    id: n.id,
    type: activityTypeFromNotification(n.type),
    title: n.title,
    body: n.body,
    time: formatRelativeTime(n.createdAt),
    highlight:
      n.type.toUpperCase().includes("PAYOUT") ||
      n.type.toUpperCase().includes("RESERVE") ||
      n.title.includes("Your Turn") ||
      n.title.toLowerCase().includes("reserve"),
    raw: n,
  }));
}

export function notificationsToFeed(notifications: NotificationRow[]): NotificationItem[] {
  return notifications.map((n) => ({
    id: n.id,
    category: notificationCategory(n.type),
    title: n.title,
    body: n.body,
    time: formatRelativeTime(n.createdAt),
    actionLabel: shouldShowViewAction(n) ? "View" : undefined,
    raw: n,
  }));
}
