import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { ManageCourseUseCase } from '../../application/use-cases/manage-course.use-case';
import { ManageCohortUseCase } from '../../application/use-cases/manage-cohort.use-case';
import { EnrollStudentUseCase } from '../../application/use-cases/enroll-student.use-case';
import { AcademicExtrasService } from '../../application/services/academic-extras.service';
import { AcademicMetricsService } from '../../application/services/academic-metrics.service';
import { CreateCourseDto } from '../../application/dtos/create-course.dto';
import { CreateCohortDto } from '../../application/dtos/create-cohort.dto';
import { UpdateCohortDto } from '../../application/dtos/update-cohort.dto';
import { EnrollStudentDto } from '../../application/dtos/enroll-student.dto';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import { Public } from '../../../auth/infrastructure/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../../shared/infrastructure/multer/multer.config';

import { SyllabusService } from '../../application/services/syllabus.service';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';

@ApiTags('Academic')
@ApiBearerAuth()
@Controller('academic')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicController {
  constructor(
    private readonly manageCourseUseCase: ManageCourseUseCase,
    private readonly manageCohortUseCase: ManageCohortUseCase,
    private readonly enrollStudentUseCase: EnrollStudentUseCase,
    private readonly academicExtrasService: AcademicExtrasService,
    private readonly academicMetricsService: AcademicMetricsService,
    private readonly syllabusService: SyllabusService,
    private readonly storageService: StorageService,
  ) {}

  // ── MÉTRICAS Y EXPORTACIÓN ──

  @Get('metrics')
  @Roles('ADMIN', 'RRHH')
  @ApiOperation({ summary: 'Obtener métricas para el dashboard' })
  async getDashboardMetrics() {
    return this.academicMetricsService.getDashboardMetrics();
  }

  @Get('export-students')
  @Roles('ADMIN', 'RRHH')
  @ApiOperation({ summary: 'Exportar estudiantes a CSV' })
  async exportStudents() {
    return this.academicMetricsService.getStudentsExportData();
  }

  // ── CURSOS ──

  @Post('courses')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un curso nuevo (Solo Admin)' })
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.manageCourseUseCase.createCourse(dto);
  }

  @Get('courses')
  @Public()
  @ApiOperation({ summary: 'Listar todos los cursos' })
  async getAllCourses() {
    return this.manageCourseUseCase.getAllCourses();
  }

  @Patch('courses/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar un curso (Solo Admin)' })
  async updateCourse(@Param('id') id: string, @Body() body: any) {
    return this.manageCourseUseCase.updateCourse(id, body);
  }

  @Post('courses/:id/image')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Subir imagen para el curso (Solo Admin)' })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadCourseImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException(
        'Ningún archivo fue subido o el formato es incorrecto',
      );
    }

    const imageUrl = `/uploads/${file.filename}`;
    // Assuming manageCourseUseCase.updateCourse exists and handles it
    const updated = await this.manageCourseUseCase.updateCourse(id, {
      imageUrl,
    });

    return {
      message: 'Imagen del curso actualizada',
      imageUrl: updated.imageUrl,
    };
  }

  @Get('trash')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Listar elementos en la papelera de reciclaje (Solo Admin)',
  })
  async getTrashItems() {
    const courses = await this.manageCourseUseCase.getTrashCourses();
    const cohorts = await this.manageCohortUseCase.getTrashCohorts();
    return { courses, cohorts };
  }

  @Patch('courses/:id/restore')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Restaurar un curso eliminado (Solo Admin)' })
  async restoreCourse(@Param('id') id: string) {
    return this.manageCourseUseCase.restoreCourse(id);
  }

  @Patch('cohorts/:id/restore')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Restaurar una cohorte eliminada (Solo Admin)' })
  async restoreCohort(@Param('id') id: string) {
    return this.manageCohortUseCase.restoreCohort(id);
  }

  @Delete('courses/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un curso (Solo Admin)' })
  async deleteCourse(@Param('id') id: string) {
    return this.manageCourseUseCase.deleteCourse(id);
  }

  // ── COHORTES ──

  @Post('cohorts')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una cohorte para un curso (Solo Admin)' })
  async createCohort(@Body() dto: CreateCohortDto) {
    return this.manageCohortUseCase.createCohort(dto);
  }

  @Get('cohorts')
  @Public()
  @ApiOperation({ summary: 'Listar todas las cohortes' })
  async getAllCohorts() {
    return this.manageCohortUseCase.getAllCohorts();
  }

  @Patch('cohorts/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar una cohorte (Solo Admin)' })
  async updateCohort(@Param('id') id: string, @Body() body: UpdateCohortDto) {
    return this.manageCohortUseCase.updateCohort(id, body);
  }

  @Delete('cohorts/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una cohorte (Solo Admin)' })
  async deleteCohort(@Param('id') id: string) {
    return this.manageCohortUseCase.deleteCohort(id);
  }

  @Post('cohorts/:id/image')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Subir imagen para la cohorte (Solo Admin)' })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadCohortImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException(
        'Ningún archivo fue subido o el formato es incorrecto',
      );
    }

    const imageUrl = `/uploads/${file.filename}`;
    const updated = await this.manageCohortUseCase.updateCohort(id, {
      imageUrl,
    });

    return {
      message: 'Imagen de la cohorte actualizada',
      imageUrl: updated.imageUrl,
    };
  }

  @Get('enrollments/me')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Obtener los cursos activos del estudiante' })
  async getMyCourses(@CurrentUser() user: any) {
    return this.academicExtrasService.getMyActiveCohorts(user.id);
  }

  // ── MATRÍCULAS ──

  // El endpoint público de matriculación de estudiantes fue removido
  // ya que ahora todo el flujo de compra/matriculación pasa por POST /payments/checkout

  @Post('enrollments/admin')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Matricular a un estudiante (Admin/RRHH)' })
  async enrollStudentAdmin(
    @Body() dto: { studentId: string; cohortId: string },
  ) {
    return this.enrollStudentUseCase.execute(dto.studentId, {
      cohortId: dto.cohortId,
    });
  }

  // ── ESTUDIANTE Y ASISTENCIA (Fase 4) ──

  @Get('cohorts/:id/students')
  @Roles('DOCENTE', 'ADMIN', 'RRHH')
  @ApiOperation({
    summary: 'Obtener lista de alumnos matriculados en una cohorte',
  })
  async getCohortStudents(@Param('id') cohortId: string) {
    return this.academicExtrasService.getCohortStudents(cohortId);
  }

  @Post('cohorts/:id/attendance')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Registrar asistencia de un alumno' })
  async markAttendance(
    @Param('id') cohortId: string,
    @Body() body: { studentId: string; date: string; isPresent: boolean },
  ) {
    return this.academicExtrasService.markAttendance(cohortId, body);
  }

  @Post('cohorts/:id/attendance-bulk')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({
    summary: 'Registrar asistencia masiva de la lista de alumnos',
  })
  async markAttendanceBulk(
    @Param('id') cohortId: string,
    @Body()
    body: {
      date: string;
      records: Array<{
        studentId: string;
        isPresent: boolean;
        isExcused?: boolean;
        observation?: string;
      }>;
    },
  ) {
    return this.academicExtrasService.markAttendanceBulk(cohortId, body);
  }

  @Get('cohorts/:id/attendance')
  @Roles('DOCENTE', 'ADMIN', 'ESTUDIANTE')
  @ApiOperation({ summary: 'Obtener asistencia de una fecha' })
  async getAttendance(
    @Param('id') cohortId: string,
    @Query('date') date: string,
  ) {
    return this.academicExtrasService.getAttendance(cohortId, date);
  }

  @Get('cohorts/:id/grades-summary')
  @Roles('DOCENTE', 'ADMIN', 'RRHH')
  @ApiOperation({
    summary:
      'Obtener acta de notas consolidadas y promedios finales de la cohorte',
  })
  async getCohortGradesSummary(@Param('id') cohortId: string) {
    return this.academicExtrasService.getCohortGradesSummary(cohortId);
  }

  // ── EVALUACIÓN DOCENTE (Fase 4) ──

  @Post('cohorts/:id/evaluate')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Evaluar al docente de la cohorte' })
  async evaluateTeacher(
    @CurrentUser() user: any,
    @Param('id') cohortId: string,
    @Body() body: { teacherId: string; score: number; comment?: string },
  ) {
    return this.academicExtrasService.evaluateTeacher(cohortId, user.id, body);
  }

  // ── CALENDARIO ACADÉMICO ──

  @Get('calendar-events')
  @ApiOperation({ summary: 'Obtener eventos del calendario académico' })
  async getCalendarEvents(@CurrentUser() user: any) {
    const role = user.roles?.[0] || 'ESTUDIANTE';
    return this.academicExtrasService.getCalendarEvents(user.id, role);
  }

  // ── PROGRESO DEL ESTUDIANTE ──

  @Get('cohorts/:id/my-progress')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Obtener progreso del estudiante en una cohorte' })
  async getMyProgress(@CurrentUser() user: any, @Param('id') cohortId: string) {
    return this.academicExtrasService.getStudentProgress(user.id, cohortId);
  }

  // ── SUBIDA DE MATERIALES (Ruta Directa Estática) ──

  @Post('materials/upload')
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({
    summary: 'Subir archivo de material (PDF, Word, PPT, Excel, Video)',
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadMaterial(
    @UploadedFile() file: any,
    @Body('moduleId') moduleId: string,
    @Body('title') title?: string,
    @Body('type') type?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo no adjuntado');
    if (!moduleId) throw new BadRequestException('moduleId es requerido');

    const fileUrl = await this.storageService.uploadFile(file, 'materials');

    let materialType = type || 'PDF';
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (
      ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf'].includes(ext || '')
    ) {
      materialType = 'PDF';
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
      materialType = 'VIDEO';
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
      materialType = 'IMAGE';
    }

    return this.syllabusService.addMaterial(moduleId, {
      title: title || file.originalname,
      type: materialType,
      fileUrl,
    });
  }
}
