import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewVerificationDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
