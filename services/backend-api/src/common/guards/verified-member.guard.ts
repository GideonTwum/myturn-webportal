import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { REQUIRE_VERIFIED_MEMBER_KEY } from "../decorators/require-verified-member.decorator";
import { MemberParticipationService } from "../../member/member-participation.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Injectable()
export class VerifiedMemberGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private participation: MemberParticipationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_VERIFIED_MEMBER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest<ReqUser>();
    if (req.user?.role !== UserRole.USER) return true;

    try {
      await this.participation.assertCanParticipateFinancially(req.user.sub);
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new ForbiddenException("Participation not allowed");
    }
  }
}
