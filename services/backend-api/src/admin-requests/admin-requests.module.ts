import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminRequestsController } from "./admin-requests.controller";
import { AdminRequestsService } from "./admin-requests.service";

@Module({
  imports: [NotificationsModule],
  controllers: [AdminRequestsController],
  providers: [AdminRequestsService],
  exports: [AdminRequestsService],
})
export class AdminRequestsModule {}
