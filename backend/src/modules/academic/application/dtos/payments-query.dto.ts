import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/pagination/pagination-query.dto';

export class PaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsIn(['TARJETA', 'YAPE', 'PLIN', 'EFECTIVO'])
  method?: 'TARJETA' | 'YAPE' | 'PLIN' | 'EFECTIVO';
}
