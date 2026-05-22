import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { MemberService } from "./member.service";

type AuthedReq = { user: { sub: string; role: UserRole } };

@ApiWrapped()
@Controller("member")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.USER)
export class MemberController {
  constructor(private member: MemberService) {}

  @Get("me")
  me(@Req() req: AuthedReq) {
    return this.member.getMe(req.user.sub);
  }

  @Get("groups")
  groups(@Req() req: AuthedReq) {
    return this.member.listGroups(req.user.sub);
  }

  @Get("groups/:id")
  group(@Req() req: AuthedReq, @Param("id") id: string) {
    return this.member.getGroup(req.user.sub, id);
  }

  @Get("payouts")
  payouts(@Req() req: AuthedReq) {
    return this.member.listPayouts(req.user.sub);
  }

  @Get("payments")
  payments(@Req() req: AuthedReq) {
    return this.member.listPayments(req.user.sub);
  }

  @Get("notifications")
  notifications(@Req() req: AuthedReq) {
    return this.member.listNotifications(req.user.sub);
  }

  @Post("devices/register")
  registerDevice(@Req() req: AuthedReq, @Body() body: RegisterDeviceDto) {
    return this.member.registerDevice(
      req.user.sub,
      body.token,
      body.platform,
    );
  }
}
