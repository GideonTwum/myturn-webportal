/** Standard envelope for mobile-first / member APIs (opt-in on backend). */
export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiErrorBody = {
  success: false;
  message: string;
  code?: string;
  statusCode?: number;
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiErrorBody;

export function isApiSuccess<T>(body: unknown): body is ApiSuccess<T> {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as ApiSuccess<T>).success === true &&
    "data" in body
  );
}

export function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as ApiErrorBody).success === false &&
    typeof (body as ApiErrorBody).message === "string"
  );
}

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  memberAuthorizationLevel?: string;
  ghanaCardVerificationStatus?: string;
  canContribute?: boolean;
};

export type AuthSession = {
  access_token: string;
  user: AuthUser;
};

export type MemberMe = AuthUser;

export type MemberGroupSummary = {
  groupId: string;
  groupName: string;
  groupStatus: string;
  payoutMode: string;
  turnOrder: number;
  memberSlots: number;
  payoutPositionLabel: string;
  contributionAmount: string;
  daysPerCycle: number;
  currentCycle: number;
  totalCycles: number;
  contributionId: string | null;
  paidDayCount: number;
  expectedDayCount: number;
  remainingDays: number;
  contributionStatus: string | null;
  cycleStanding: string;
};

export type MemberGroupsResponse = {
  memberships: MemberGroupSummary[];
};

export type MemberGroupDetail = MemberGroupSummary & {
  inviteCode?: null;
  description: string | null;
  groupStartDate: string | null;
  estimatedEndDate: string | null;
};

export type MemberPayoutRow = {
  id: string;
  groupId: string;
  groupName: string;
  cycleNumber: number;
  amount: string;
  status: string;
  paidAt: string | null;
  isUpcoming: boolean;
};

export type MemberPayoutsResponse = {
  payouts: MemberPayoutRow[];
};

export type MemberPaymentRow = {
  id: string;
  groupId: string | null;
  groupName: string | null;
  amount: string;
  type: string;
  status: string;
  completedAt: string | null;
  cycleNumber: number | null;
};

export type MemberPaymentsResponse = {
  payments: MemberPaymentRow[];
};

export type NotificationMetadata = {
  groupId?: string;
  contributionId?: string;
  payoutId?: string;
  requestId?: string;
  amount?: string;
  cycleNumber?: number;
  groupCompleted?: boolean;
};

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  metadata?: NotificationMetadata | null;
  createdAt: string;
};

export type MemberMeResponse = MemberMe & {
  payoutsReceivedCount: number;
  payoutsReceivedTotal: string;
};

export type MemberGroupMemberRow = {
  userId: string;
  displayName: string;
  turnOrder: number;
  paymentStatus: "PAID" | "PENDING" | "OVERDUE";
  isYou: boolean;
};

export type MemberGroupMembersResponse = {
  groupId: string;
  groupName: string;
  currentCycle: number;
  summary: { total: number; paid: number; pending: number };
  members: MemberGroupMemberRow[];
};

export type AdminPaymentRow = {
  id: string;
  reference: string;
  memberName: string | null;
  memberId: string | null;
  groupId: string | null;
  groupName: string | null;
  amount: string;
  status: string;
  type: string;
  provider: string;
  createdAt: string;
  settledAt: string | null;
};

export type AdminPaymentsResponse = {
  payments: AdminPaymentRow[];
};

export type MemberNotificationsResponse = {
  notifications: NotificationRow[];
};

export type OtpRequestResponse = {
  message: string;
  /** Staging only — omitted when NODE_ENV=production */
  debugCode?: string;
};
