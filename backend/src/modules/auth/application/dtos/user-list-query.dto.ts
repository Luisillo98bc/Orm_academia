import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../../shared/pagination/pagination-query.dto';

export class UserListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'RRHH', 'DOCENTE', 'ESTUDIANTE', 'Todos'])
  role?: string;
}
