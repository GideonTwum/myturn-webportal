import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { MemberPhoneLoginDto } from "./dto/member-phone.dto";

type AuthedReq = { user: { sub: string; email: string; role: UserRole } };

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  /** Temporary web member portal: phone-only session (staging — use OTP/MoMo later). */
  @Post("member-phone")
  memberPhone(@Body() body: MemberPhoneLoginDto) {
    return this.auth.loginMemberByPhone(body.phone);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("me")
  me(@Req() req: AuthedReq) {
    return this.auth.me(req.user.sub);
  }

  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get("hq-check")
  hqCheck() {
    return { ok: true, scope: "SUPER_ADMIN" };
  }

  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get("admin-check")
  adminCheck() {
    return { ok: true, scope: "ADMIN" };
  }
}
