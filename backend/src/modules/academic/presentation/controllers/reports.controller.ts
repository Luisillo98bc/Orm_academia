import { Controller, Get, Query, UseGuards, Res, Header } from '@nestjs/common';
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
import * as express from 'express';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN') // Solo ADMIN puede acceder a los reportes
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obtener KPIs generales' })
  getSummary() {
    return this.reportsService.getSummary();
  }

  @Get('enrollments-by-month')
  @ApiOperation({ summary: 'Obtener matrículas por mes (últimos 12 meses)' })
  getEnrollmentsByMonth() {
    return this.reportsService.getEnrollmentsByMonth();
  }

  @Get('revenue-by-month')
  @ApiOperation({ summary: 'Obtener ingresos por mes (últimos 12 meses)' })
  getRevenueByMonth() {
    return this.reportsService.getRevenueByMonth();
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

  // ── EXPORTACIÓN CSV ──

  @Get('export/students')
  @ApiOperation({ summary: 'Exportar alumnos matriculados como CSV' })
  @ApiQuery({ name: 'cohortId', required: true })
  async exportStudents(
    @Query('cohortId') cohortId: string,
    @Res() res: express.Response,
  ) {
    const csv = await this.reportsService.exportStudentsCsv(cohortId);
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
    @Res() res: express.Response,
  ) {
    const csv = await this.reportsService.exportGradesCsv(cohortId);
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
    @Res() res: express.Response,
  ) {
    const csv = await this.reportsService.exportAttendanceCsv(cohortId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=asistencia_${cohortId.slice(0, 8)}.csv`,
    );
    res.send('\uFEFF' + csv);
  }
}
