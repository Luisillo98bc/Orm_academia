import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Res,
  Query,
} from '@nestjs/common';
import { RrhhService } from './rrhh.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { Roles } from '../auth/infrastructure/guards/roles.decorator';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { PermissionsGuard } from '../auth/infrastructure/guards/permissions.guard';
import { Permissions } from '../auth/infrastructure/guards/permissions.decorator';
import * as express from 'express';
import { CreateWorkerDto } from './dtos/create-worker.dto';
import { CreateContractDto } from './dtos/create-contract.dto';
import { WorkersQueryDto } from './dtos/workers-query.dto';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';

@Controller('rrhh')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'RRHH')
@Permissions('rrhh:read')
export class RrhhController {
  constructor(private readonly rrhhService: RrhhService) {}

  @Get('stats')
  getDashboardStats() {
    return this.rrhhService.getDashboardStats();
  }

  @Get('workers')
  findAllWorkers(@Query() query: WorkersQueryDto) {
    return this.rrhhService.findAllWorkers(query);
  }

  @Post('workers')
  @Permissions('rrhh:update')
  createWorker(@Body() createWorkerDto: CreateWorkerDto) {
    return this.rrhhService.createWorker(createWorkerDto);
  }

  @Get('available-users')
  getAvailableUsers() {
    return this.rrhhService.getAvailableUsers();
  }

  @Get('workers/:id')
  findWorkerById(@Param('id') id: string) {
    return this.rrhhService.findWorkerById(id);
  }

  @Post('workers/:id/contracts')
  @Permissions('rrhh:update')
  createContract(
    @Param('id') workerId: string,
    @Body() contractData: CreateContractDto,
  ) {
    return this.rrhhService.createContract(workerId, contractData);
  }

  @Get('payroll')
  findAllPayrolls(
    @Query()
    query: PaginationQueryDto & { period?: string; search?: string },
  ) {
    return this.rrhhService.findAllPayrolls(
      query.page,
      query.limit,
      query.period,
      query.search,
    );
  }

  @Post('payroll/generate/:period')
  @Permissions('rrhh:update')
  generatePayroll(@Param('period') period: string) {
    return this.rrhhService.generatePayroll(period);
  }

  @Patch('payroll/:id/pay')
  @Permissions('rrhh:update')
  payPayroll(@Param('id') id: string) {
    return this.rrhhService.payPayroll(id);
  }

  @Get('export/payroll')
  async exportPayroll(@Res() res: express.Response) {
    const csv = await this.rrhhService.exportPayrollCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=nominas.csv');
    res.send('\uFEFF' + csv);
  }

  @Get('attendance')
  getDailyAttendance(@Query('date') dateFromQuery?: string) {
    const date = dateFromQuery || new Date().toISOString().split('T')[0];
    return this.rrhhService.getDailyAttendance(date);
  }

  @Get('attendance/monthly')
  getMonthlyAttendance(@Query('month') month: string) {
    return this.rrhhService.getMonthlyAttendance(month);
  }

  @Post('attendance')
  @Permissions('rrhh:update')
  markAttendance(
    @Body()
    data: {
      workerId: string;
      date: string;
      status: string;
      observation?: string;
    },
  ) {
    return this.rrhhService.markAttendance(data);
  }
}
