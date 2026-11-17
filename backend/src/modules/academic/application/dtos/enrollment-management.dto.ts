import { EnrollmentStatus } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/pagination/pagination-query.dto';

export class EnrollmentManagementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class UpdateEnrollmentStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'DROPPED', 'COMPLETED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'DROPPED' | 'COMPLETED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class EnrollmentCandidatesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['ESTUDIANTE', 'ALL'])
  role?: 'ESTUDIANTE' | 'ALL';
}
