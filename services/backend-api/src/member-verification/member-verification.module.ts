import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  AdminMemberVerificationController,
  MemberVerificationController,
} from "./member-verification.controller";
import { MemberVerificationService } from "./member-verification.service";

@Module({
  imports: [NotificationsModule],
  controllers: [MemberVerificationController, AdminMemberVerificationController],
  providers: [MemberVerificationService],
  exports: [MemberVerificationService],
})
export class MemberVerificationModule {}
