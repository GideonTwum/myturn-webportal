import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateWithdrawalDto {
  @IsString()
  @MinLength(1)
  amount!: string;

  @IsString()
  @MinLength(9)
  momoNumber!: string;
}

export class ConfirmWithdrawalDto {
  @IsString()
  @MinLength(1)
  providerRef!: string;

  @IsOptional()
  @IsString()
  provider?: string;
}

export class FailWithdrawalDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
