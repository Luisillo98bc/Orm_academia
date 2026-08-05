import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCohortDto } from './create-cohort.dto';

export class UpdateCohortDto extends PartialType(CreateCohortDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
