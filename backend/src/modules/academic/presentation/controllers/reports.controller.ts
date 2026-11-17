import {
  Body,
  Controller,
  Delete,
  Get,
  Query,
  UseGuards,
  Res,
  Post,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { ReportsService } from '../../application/services/reports.service';
import { Permissions } from '../../../auth/infrastructure/guards/permissions.decorator';
import { PermissionsGuard } from '../../../auth/infrastructure/guards/permissions.guard';
import * as express from 'express';
import { EnrollmentsQueryDto } from '../../application/dtos/enrollments-query.dto';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN') // Solo ADMIN puede acceder a los reportes
@Permissions('reports:read')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obtener KPIs generales' })
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSummary(startDate, endDate);
  }

  @Get('enrollments')
  @ApiOperation({ summary: 'Listar matrículas paginadas para reportes' })
  async getEnrollments(@Query() query: EnrollmentsQueryDto) {
    return this.reportsService.getEnrollmentsReport(
      query.page,
      query.limit,
      query.search,
    );
  }

  @Get('enrollments-by-month')
  @ApiOperation({ summary: 'Obtener matrículas por mes (últimos 12 meses)' })
  getEnrollmentsByMonth(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getEnrollmentsByMonth(startDate, endDate);
  }

  @Get('revenue-by-month')
  @ApiOperation({ summary: 'Obtener ingresos por mes (últimos 12 meses)' })
  getRevenueByMonth(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getRevenueByMonth(startDate, endDate);
  }

  @Get('courses-ranking')
  @ApiOperation({ summary: 'Obtener ranking de cursos por matrículas' })
  getCoursesRanking() {
    return this.reportsService.getCoursesRanking();
  }

  @Get('attendance-summary')
  @ApiOperation({
    summary: 'Obtener porcentaje de asistencia por cohorte activa',
  })
  getAttendanceSummary() {
    return this.reportsService.getAttendanceSummary();
  }

  @Get('grades-distribution')
  @ApiOperation({ summary: 'Obtener distribución de notas' })
  @ApiQuery({ name: 'cohortId', required: false })
  getGradesDistribution(@Query('cohortId') cohortId?: string) {
    return this.reportsService.getGradesDistribution(cohortId);
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'Obtener distribución de métodos de pago' })
  getPaymentMethodsDistribution() {
    return this.reportsService.getPaymentMethodsDistribution();
  }

  @Get('financial-profitability')
  @ApiOperation({ summary: 'Rentabilidad, costos y proyección financiera' })
  getFinancialProfitability(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getFinancialProfitability(startDate, endDate);
  }

  @Get('operating-costs')
  listOperatingCosts() {
    return this.reportsService.listOperatingCosts();
  }

  @Post('operating-costs')
  createOperatingCost(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      label: string;
      amount: number;
      periodStart: string;
      periodEnd?: string;
      courseId?: string;
      cohortId?: string;
      notes?: string;
    },
  ) {
    return this.reportsService.createOperatingCost(user.id, body);
  }

  @Delete('operating-costs/:id')
  deleteOperatingCost(@Param('id') id: string) {
    return this.reportsService.deleteOperatingCost(id);
  }

  // ── EXPORTACIÓN CSV ──

  @Get('export/students')
  @ApiOperation({ summary: 'Exportar alumnos matriculados como CSV' })
  @ApiQuery({ name: 'cohortId', required: true })
  async exportStudents(
    @Query('cohortId') cohortId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: express.Response,
  ) {
    const csv = await this.reportsService.exportStudentsCsv(
      cohortId,
      startDate,
      endDate,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=alumnos_${cohortId.slice(0, 8)}.csv`,
    );
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  }

  @Get('export/grades')
  @ApiOperation({ summary: 'Exportar calificaciones consolidadas como CSV' })
  @ApiQuery({ name: 'cohortId', required: true })
  async exportGrades(
    @Query('cohortId') cohortId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: express.Response,
  ) {
    const csv = await this.reportsService.exportGradesCsv(
      cohortId,
      startDate,
      endDate,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=notas_${cohortId.slice(0, 8)}.csv`,
    );
    res.send('\uFEFF' + csv);
  }

  @Get('export/attendance')
  @ApiOperation({ summary: 'Exportar asistencia como CSV' })
  @ApiQuery({ name: 'cohortId', required: true })
  async exportAttendance(
    @Query('cohortId') cohortId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: express.Response,
  ) {
    const csv = await this.reportsService.exportAttendanceCsv(
      cohortId,
      startDate,
      endDate,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=asistencia_${cohortId.slice(0, 8)}.csv`,
    );
    res.send('\uFEFF' + csv);
  }

  @Get('export/payments')
  @ApiOperation({ summary: 'Exportar reporte financiero de pagos como CSV' })
  async exportPayments(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: express.Response,
  ) {
    const csv = await this.reportsService.exportPaymentsCsv(startDate, endDate);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte_financiero_pagos.csv',
    );
    res.send('\uFEFF' + csv);
  }
}
