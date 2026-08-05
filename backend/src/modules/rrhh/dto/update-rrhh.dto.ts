import { PartialType } from '@nestjs/swagger';
import { CreateRrhhDto } from './create-rrhh.dto';

export class UpdateRrhhDto extends PartialType(CreateRrhhDto) {}
