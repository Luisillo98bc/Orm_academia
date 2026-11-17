import { MaterialType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSyllabusModuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly order!: number;
}

export class UpdateSyllabusModuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly order?: number;
}

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @IsEnum(MaterialType)
  readonly type!: MaterialType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  readonly fileUrl!: string;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @IsOptional()
  @IsEnum(MaterialType)
  readonly type?: MaterialType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  readonly fileUrl?: string;
}

export class CreateClassSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @IsDateString()
  readonly date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly meetLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly recordingUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  readonly durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly timeZone?: string;
}

export class UpdateClassSessionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @IsOptional()
  @IsDateString()
  readonly date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly meetLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly recordingUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  readonly durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly timeZone?: string;
}
