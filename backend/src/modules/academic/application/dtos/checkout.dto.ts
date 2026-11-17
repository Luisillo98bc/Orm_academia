import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  readonly cohortId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  readonly method!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly analyticsSessionId?: string;

  @IsOptional()
  @IsUUID()
  readonly idempotencyKey?: string;
}
