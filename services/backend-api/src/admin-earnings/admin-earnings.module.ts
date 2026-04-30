import { Module } from "@nestjs/common";
import { AdminEarningsController } from "./admin-earnings.controller";
import { AdminEarningsService } from "./admin-earnings.service";

@Module({
  controllers: [AdminEarningsController],
  providers: [AdminEarningsService],
  exports: [AdminEarningsService],
})
export class AdminEarningsModule {}
