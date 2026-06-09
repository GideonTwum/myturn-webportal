export type MemberIdentity = {
  firstName?: string | null;
  lastName?: string | null;
  turnOrder?: number;
};

/** Human-readable member name for admin UI — never uses email. */
export function memberLabel(user: MemberIdentity): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (user.turnOrder != null) return `Member ${user.turnOrder}`;
  return "Member";
}
