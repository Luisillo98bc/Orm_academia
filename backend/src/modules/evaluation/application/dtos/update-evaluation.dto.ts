import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateEvaluationDto {
  @IsString()
  @IsOptional()
  @MaxLength(300)
  readonly title?: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  readonly weight?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  readonly maxScore?: number;

  @IsDateString()
  @IsOptional()
  readonly dueDate?: string;

  @IsBoolean()
  @IsOptional()
  readonly isPublished?: boolean;
}
