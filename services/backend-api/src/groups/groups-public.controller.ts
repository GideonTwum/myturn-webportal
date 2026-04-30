import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { AuthService } from "../auth/auth.service";
import { GroupsService } from "./groups.service";

class JoinGroupDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  inviteCode!: string;

  /** Full name — split into first / last on the server */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** Optional; omit for auto-generated password + session from response. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

@Controller("groups")
export class GroupsPublicController {
  constructor(
    private groups: GroupsService,
    private auth: AuthService,
  ) {}

  @Get("invite/:inviteCode")
  invitePreview(@Param("inviteCode") raw: string) {
    return this.groups.getInvitePreview(raw);
  }

  @Post("join")
  async join(
    @Body() body: JoinGroupDto,
    @Headers("authorization") authorization?: string,
  ) {
    const authenticatedUserId =
      this.auth.tryResolveUserIdFromBearer(authorization);
    const { userId } = await this.groups.joinWithInvite(
      {
        inviteCode: body.inviteCode,
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        password: body.password,
      },
      { authenticatedUserId },
    );
    const session = await this.auth.issueAccessTokenForUserId(userId);
    return {
      message: "You have successfully joined the group.",
      ...session,
    };
  }
}
