import {
  GhanaCardVerificationStatus,
  MemberAuthorizationLevel,
  type User,
} from "@prisma/client";

export function toMemberAuthUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    memberAuthorizationLevel: user.memberAuthorizationLevel,
    ghanaCardVerificationStatus: user.ghanaCardVerificationStatus,
    canContribute:
      user.memberAuthorizationLevel === MemberAuthorizationLevel.VERIFIED_MEMBER &&
      user.ghanaCardVerificationStatus === GhanaCardVerificationStatus.VERIFIED,
  };
}
