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
import { UserRole } from "@prisma/client";
import { IsIn, IsOptional, IsString } from "class-validator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdminRequestsService } from "./admin-requests.service";

class CreateAdminRequestDto {
  @IsOptional()
  @IsString()
  message?: string;
}

class ReviewDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";
}

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("admin-requests")
export class AdminRequestsController {
  constructor(private requests: AdminRequestsService) {}

  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.USER)
  @Post()
  create(@Req() req: ReqUser, @Body() body: CreateAdminRequestDto) {
    return this.requests.create(req.user.sub, body.message);
  }

  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  list() {
    return this.requests.list();
  }

  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(":id")
  review(
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: ReviewDto,
  ) {
    return this.requests.review(id, req.user.sub, body.decision);
  }
}
