import {
  IsDate,
  IsNotEmpty,
  IsDecimal,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { Transform, type TransformFnParams } from 'class-transformer';

function normalizeDecimal({ value }: TransformFnParams): unknown {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : value;
}

export class CreateCohortDto {
  @IsUUID()
  @IsNotEmpty()
  courseId: string;

  @IsUUID(4, { each: true })
  @IsNotEmpty()
  teacherIds: string[];

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  modality?: string;

  @IsString()
  @IsOptional()
  schedule?: string;

  @IsNumber()
  maxStudents: number;

  @IsNumber()
  @IsOptional()
  installments?: number;

  @Transform(normalizeDecimal)
  @IsDecimal({ decimal_digits: '0,2' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'price debe ser positivo y tener máximo 2 decimales',
  })
  @IsOptional()
  price?: string;

  @IsDate()
  startDate: Date;

  @IsDate()
  endDate: Date;

  @IsNumber()
  @IsOptional()
  discountPercentage?: number;

  @IsDate()
  @IsOptional()
  discountEndsAt?: Date;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
