import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';
import { normalizeMoneyInput } from './money-input';

export class CreateContractDto {
  @IsString()
  type: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @Transform(normalizeMoneyInput)
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'agreedSalary debe tener máximo 2 decimales',
  })
  agreedSalary: string;

  @IsString()
  @IsOptional()
  documentUrl?: string;

  @IsString()
  @IsOptional()
  observations?: string;
}
