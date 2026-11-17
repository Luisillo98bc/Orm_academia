import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContractStatus } from '@prisma/client';
import { PaginationQueryDto } from './pagination-query.dto';

export class ContractsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Type(() => String)
  search?: string;
}
