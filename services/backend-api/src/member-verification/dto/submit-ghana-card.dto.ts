import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SubmitGhanaCardDto {
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  ghanaCardNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  selfieAssetKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cardImageAssetKey?: string;
}
