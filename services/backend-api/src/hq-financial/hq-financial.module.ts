import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { HqFinancialController } from "./hq-financial.controller";
import { HqFinancialService } from "./hq-financial.service";

@Module({
  imports: [PrismaModule],
  controllers: [HqFinancialController],
  providers: [HqFinancialService],
})
export class HqFinancialModule {}
