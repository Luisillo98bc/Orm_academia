import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { normalizeMoneyInput } from './money-input';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export class CreateWorkerDto {
  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  roleName?: string;

  @IsString()
  dni: string;

  @IsString()
  position: string;

  @IsString()
  department: string;

  @Transform(normalizeMoneyInput)
  @Matches(MONEY_PATTERN, {
    message: 'baseSalary debe tener máximo 2 decimales',
  })
  baseSalary: string;

  @IsDateString()
  hireDate: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  personalPhone?: string;
}
