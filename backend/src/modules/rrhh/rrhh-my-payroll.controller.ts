import { Controller, Get, Req, Query, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RrhhService } from './rrhh.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';

type UserRequest = Request & {
  user: { id: string; roles?: string[] };
};

@Controller('rrhh/my-payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RrhhMyPayrollController {
  constructor(private readonly rrhhService: RrhhService) {}

  @Get()
  @Roles('ADMIN', 'RRHH', 'DOCENTE')
  findMine(@Req() req: UserRequest, @Query() pagination: PaginationQueryDto) {
    return this.rrhhService.findMyPayrolls(
      req.user.id,
      pagination.page,
      pagination.limit,
    );
  }
}
