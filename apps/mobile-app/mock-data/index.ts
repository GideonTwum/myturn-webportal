/** Demo-only fields (trustScore, contributionStreak) — used only when EXPO_PUBLIC_MOCK_UI=true. */
export type MockUser = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneMasked: string;
  avatarUrl?: string;
  /** UI demo only — not synced from backend User.trustScore */
  trustScore: number;
  verified: boolean;
  /** UI demo only — not synced from backend User.contributionStreak */
  contributionStreak: { current: number; total: number };
  memberSince: string;
};

export type PayoutSlot = {
  position: number;
  month: string;
  label: string;
  status: "done" | "current" | "upcoming" | "you";
  memberName?: string;
};

export type MockGroup = {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  contributionAmount: number;
  contributionLabel: string;
  totalPayout: number;
  payoutMode: string;
  memberCount: number;
  memberSlots: number;
  healthScore: number;
  adminName: string;
  adminVerified: boolean;
  adminCycles: number;
  nextPayoutDate: string;
  yourTurnPosition?: number;
  payoutTimeline: PayoutSlot[];
  scheduleLocked: boolean;
};

export type ActivityItem = {
  id: string;
  type: "contribution" | "payout" | "milestone" | "system" | "circle";
  title: string;
  body: string;
  time: string;
  amount?: string;
  memberName?: string;
  highlight?: boolean;
  raw?: import("@myturn/api-client").NotificationRow;
};

export type NotificationItem = {
  id: string;
  category: "payout" | "verification" | "contribution" | "promo";
  title: string;
  body: string;
  time: string;
  actionLabel?: string;
  raw?: import("@myturn/api-client").NotificationRow;
};

export const mockUser: MockUser = {
  id: "demo-user",
  firstName: "Akosua",
  lastName: "Mansa",
  phone: "0242105441",
  phoneMasked: "+233 ••• ••41",
  trustScore: 950,
  verified: true,
  contributionStreak: { current: 8, total: 10 },
  memberSince: "March 2023",
};

export const mockInviteGroup: MockGroup = {
  id: "grp-auntie",
  name: "Auntie Mansa's Circle",
  description: "Empowering collective growth through community savings and trust.",
  inviteCode: "DEMO2024",
  contributionAmount: 500,
  contributionLabel: "per month",
  totalPayout: 6000,
  payoutMode: "Monthly Payout",
  memberCount: 10,
  memberSlots: 12,
  healthScore: 75,
  adminName: "Auntie Mansa",
  adminVerified: true,
  adminCycles: 24,
  nextPayoutDate: "Nov 15",
  yourTurnPosition: 11,
  scheduleLocked: false,
  payoutTimeline: [
    { position: 9, month: "Sept", label: "Sept", status: "done" },
    { position: 10, month: "Oct", label: "Oct", status: "done" },
    { position: 11, month: "Nov", label: "Nov (You)", status: "you" },
    { position: 12, month: "Dec", label: "Dec", status: "upcoming" },
    { position: 1, month: "Jan", label: "Jan", status: "upcoming" },
  ],
};

export const mockActiveGroup: MockGroup = {
  id: "grp-tech",
  name: "Accra Tech Founders",
  description: "Monthly contribution circle for startup capital.",
  inviteCode: "TECH01",
  contributionAmount: 500,
  contributionLabel: "per month",
  totalPayout: 5000,
  payoutMode: "Monthly",
  memberCount: 10,
  memberSlots: 12,
  healthScore: 90,
  adminName: "Kofi Mensah",
  adminVerified: true,
  adminCycles: 14,
  nextPayoutDate: "Oct 15, 2024",
  yourTurnPosition: 4,
  scheduleLocked: true,
  payoutTimeline: [
    { position: 1, month: "Sep", label: "Amaa B.", status: "done", memberName: "Amaa Boateng" },
    { position: 2, month: "Oct", label: "Kwame O.", status: "current", memberName: "Kwame Owusu" },
    { position: 3, month: "Nov", label: "Your turn", status: "upcoming", memberName: "You" },
  ],
};

export const mockMarketGroup: MockGroup = {
  ...mockActiveGroup,
  id: "grp-market",
  name: "Market Women Savings",
  healthScore: 75,
  yourTurnPosition: 4,
};

export const mockActivities: ActivityItem[] = [
  {
    id: "1",
    type: "system",
    title: "New payout round started!",
    body: 'The "Elite Founders" circle has initiated its August distribution.',
    time: "Just now",
  },
  {
    id: "2",
    type: "contribution",
    title: "Kwame just contributed!",
    body: "Successfully added GHS 200 to Weekly Growth. 8/10 members have paid.",
    time: "12m ago",
    memberName: "Kwame",
    amount: "GHS 200",
  },
  {
    id: "3",
    type: "milestone",
    title: "Akosua reached a 5-month streak!",
    body: "She has never missed a contribution in the Accra Hub circle.",
    time: "1h ago",
    highlight: true,
  },
  {
    id: "4",
    type: "circle",
    title: 'New circle "Tech Pioneers" was formed!',
    body: "5 members · GHS 500/mo",
    time: "3h ago",
  },
];

export const mockNotifications: NotificationItem[] = [
  {
    id: "n1",
    category: "payout",
    title: "Payout Upcoming",
    body: "Your payout is in 2 days! Prepare your account details for the automatic transfer.",
    time: "2h ago",
    actionLabel: "View Details",
  },
  {
    id: "n2",
    category: "verification",
    title: "Identity Verified",
    body: "Verification successful. You now have full access to premium savings circles.",
    time: "Yesterday",
  },
  {
    id: "n3",
    category: "contribution",
    title: "Payment Due",
    body: 'Reminder: Group payment due tomorrow for "Friday Circle".',
    time: "Yesterday",
  },
];

export const mockPayoutHistory = [
  { id: "p1", group: "Digital Nomads Circle", round: "Round 10 of 12", amount: "₵2,400.00", date: "Aug 15, 2023" },
  { id: "p2", group: "Tech Founders Susu", round: "Round 5 of 5 · Completed", amount: "₵1,800.00", date: "May 02, 2023" },
];

export const mockBadges = [
  { id: "b1", label: "First Out", earned: true, icon: "medal" },
  { id: "b2", label: "Quick Saver", earned: true, icon: "rocket" },
  { id: "b3", label: "Perfect Year", earned: false, icon: "handshake" },
  { id: "b4", label: "Impact Maker", earned: false, icon: "leaf" },
];

export const mockMembers = [
  { id: "m1", name: "Abena Mensah", status: "paid" as const, detail: "Paid ₵200.00 · 2h ago" },
  { id: "m2", name: "Fatima Suleiman", status: "pending" as const, detail: "Due in 2 days" },
  { id: "m3", name: "Eunice Koomson", status: "paid" as const, detail: "Paid ₵200.00 · Yesterday", initials: "EK" },
];
