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
import * as express from 'express';
import { CreateWorkerDto } from './dtos/create-worker.dto';
import { CreateContractDto } from './dtos/create-contract.dto';

@Controller('rrhh')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'RRHH')
export class RrhhController {
  constructor(private readonly rrhhService: RrhhService) {}

  @Get('stats')
  getDashboardStats() {
    return this.rrhhService.getDashboardStats();
  }

  @Get('workers')
  findAllWorkers() {
    return this.rrhhService.findAllWorkers();
  }

  @Post('workers')
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
  createContract(
    @Param('id') workerId: string,
    @Body() contractData: CreateContractDto,
  ) {
    return this.rrhhService.createContract(workerId, contractData);
  }

  @Get('payroll')
  findAllPayrolls() {
    return this.rrhhService.findAllPayrolls();
  }

  @Post('payroll/generate/:period')
  generatePayroll(@Param('period') period: string) {
    return this.rrhhService.generatePayroll(period);
  }

  @Patch('payroll/:id/pay')
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

  @Post('attendance')
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
