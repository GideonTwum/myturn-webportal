import { Module } from "@nestjs/common";
import { CycleDepositsModule } from "../cycle-risk/cycle-deposits.module";
import { GroupMembersController } from "./group-members.controller";
import { GroupMembersService } from "./group-members.service";

@Module({
  imports: [CycleDepositsModule],
  controllers: [GroupMembersController],
  providers: [GroupMembersService],
  exports: [GroupMembersService],
})
export class GroupMembersModule {}
