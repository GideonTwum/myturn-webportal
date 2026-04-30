import { Module } from "@nestjs/common";
import { GroupMembersModule } from "../group-members/group-members.module";
import { ContributionsController } from "./contributions.controller";

@Module({
  imports: [GroupMembersModule],
  controllers: [ContributionsController],
})
export class ContributionsModule {}
