import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CycleRiskModule } from "../cycle-risk/cycle-risk.module";
import { UsersModule } from "../users/users.module";
import { GroupsController } from "./groups.controller";
import { GroupsPublicController } from "./groups-public.controller";
import { GroupsService } from "./groups.service";

@Module({
  imports: [UsersModule, CycleRiskModule, AuthModule],
  controllers: [GroupsController, GroupsPublicController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
