import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole, PayoutMode } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { GroupsService } from "./groups.service";

class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  contributionAmount!: number;

  @IsEnum(PayoutMode)
  payoutMode!: PayoutMode;

  @ValidateIf((o: CreateGroupDto) => o.payoutMode === PayoutMode.CYCLE)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  daysPerCycle?: number;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(250)
  groupSize!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;
}

class UpdateGroupDraftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  contributionAmount?: number;

  @IsOptional()
  @IsEnum(PayoutMode)
  payoutMode?: PayoutMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  daysPerCycle?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(250)
  groupSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
}

class UpdateCycleRiskDto {
  @IsOptional()
  @IsBoolean()
  allowPayoutOverride?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  defaultGraceDays?: number;
}

class ReplaceDefaultedMemberDto {
  @IsString()
  oldUserId!: string;

  @IsString()
  newUserId!: string;
}

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("groups")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class GroupsController {
  constructor(private groups: GroupsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Req() req: ReqUser, @Body() body: CreateGroupDto) {
    return this.groups.create(req.user.sub, body);
  }

  @Roles(UserRole.ADMIN)
  @Get("mine")
  mine(@Req() req: ReqUser) {
    return this.groups.listForAdmin(req.user.sub);
  }

  @Roles(UserRole.USER)
  @Get("member/participation")
  memberParticipation(@Req() req: ReqUser) {
    return this.groups.getMemberParticipation(req.user.sub);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  all() {
    return this.groups.listAll();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get(":groupId/payout-readiness")
  payoutReadiness(@Req() req: ReqUser, @Param("groupId") groupId: string) {
    return this.groups.getPayoutReadiness(groupId, {
      id: req.user.sub,
      role: req.user.role,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get(":id/cycle-compliance")
  cycleCompliance(@Req() req: ReqUser, @Param("id") id: string) {
    return this.groups.getCycleComplianceAdmin(id, {
      id: req.user.sub,
      role: req.user.role,
    });
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id/cycle-risk-settings")
  cycleRiskSettings(
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: UpdateCycleRiskDto,
  ) {
    return this.groups.updateCycleRiskSettings(req.user.sub, id, body);
  }

  @Roles(UserRole.ADMIN)
  @Post(":id/replace-defaulted-member")
  replaceDefaulted(
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: ReplaceDefaultedMemberDto,
  ) {
    return this.groups.replaceDefaultingMember(
      req.user.sub,
      id,
      body.oldUserId,
      body.newUserId,
    );
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get(":id")
  get(@Req() req: ReqUser, @Param("id") id: string) {
    return this.groups.get(id, { id: req.user.sub, role: req.user.role });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get(":id/cycle-preview/:cycle")
  preview(@Param("id") id: string, @Param("cycle") cycle: string) {
    return this.groups.previewCycleMath(id, Number(cycle));
  }

  @Roles(UserRole.ADMIN)
  @Post(":id/activate")
  activate(@Req() req: ReqUser, @Param("id") id: string) {
    return this.groups.activate(req.user.sub, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id")
  updateDraft(
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: UpdateGroupDraftDto,
  ) {
    return this.groups.updateDraft(req.user.sub, id, body);
  }
}
