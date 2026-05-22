import { SetMetadata } from "@nestjs/common";

export const REQUIRE_VERIFIED_MEMBER_KEY = "require_verified_member";

export const RequireVerifiedMember = () =>
  SetMetadata(REQUIRE_VERIFIED_MEMBER_KEY, true);
