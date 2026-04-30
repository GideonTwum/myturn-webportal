import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Type } from "class-transformer";
import { IsNumber, IsString, Min } from "class-validator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { GroupMembersService } from "./group-members.service";

class AddMemberDto {
  @IsString()
  userId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  turnOrder!: number;
}

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("groups/:groupId/members")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.ADMIN)
export class GroupMembersController {
  constructor(private members: GroupMembersService) {}

  @Post()
  add(
    @Req() req: ReqUser,
    @Param("groupId") groupId: string,
    @Body() body: AddMemberDto,
  ) {
    return this.members.addMember({
      groupId,
      adminId: req.user.sub,
      userId: body.userId,
      turnOrder: body.turnOrder,
    });
  }
}
