import { Module } from "@nestjs/common";
import { GroupsModule } from "../groups/groups.module";
import { DeviceTokensService } from "./device-tokens.service";
import { MemberController } from "./member.controller";
import { MemberParticipationService } from "./member-participation.service";
import { MemberService } from "./member.service";

@Module({
  imports: [GroupsModule],
  controllers: [MemberController],
  providers: [MemberService, DeviceTokensService, MemberParticipationService],
  exports: [MemberService, DeviceTokensService, MemberParticipationService],
})
export class MemberModule {}
