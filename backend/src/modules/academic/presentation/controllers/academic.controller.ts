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
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { UpdateCourseDto } from '../../application/dtos/update-course.dto';
import { CreateCohortDto } from '../../application/dtos/create-cohort.dto';
import { UpdateCohortDto } from '../../application/dtos/update-cohort.dto';
import {
  DuplicateCohortDto,
  EvaluateTeacherDto,
  ImportGradesDto,
  MarkAttendanceBulkDto,
  MarkAttendanceDto,
  SetMaterialProgressDto,
  StudentCohortActionDto,
  UpdateTestimonialPublishDto,
} from '../../application/dtos/academic-operations.dto';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import { Public } from '../../../auth/infrastructure/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../../shared/infrastructure/multer/multer.config';

import { SyllabusService } from '../../application/services/syllabus.service';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import { EnrollmentsQueryDto } from '../../application/dtos/enrollments-query.dto';
import { MaterialType } from '@prisma/client';
import { CourseEntity } from '../../domain/entities/course.entity';
import { CohortEntity } from '../../domain/entities/cohort.entity';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../auth/infrastructure/strategies/authenticated-user.type';

function publicCourse(course: CourseEntity) {
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    description: course.description,
    promotionalVideoUrl: course.promotionalVideoUrl,
    whatYouWillLearn: course.whatYouWillLearn,
    requirements: course.requirements,
    targetAudience: course.targetAudience,
    level: course.level,
    durationHours: course.durationHours,
    imageUrl: course.imageUrl,
  };
}

function publicCohort(cohort: CohortEntity) {
  return {
    id: cohort.id,
    courseId: cohort.courseId,
    name: cohort.name,
    modality: cohort.modality,
    schedule: cohort.schedule,
    price: cohort.price,
    installments: cohort.installments ?? 1,
    maxStudents: cohort.maxStudents,
    maxCapacity: cohort.maxStudents,
    startDate: cohort.startDate,
    endDate: cohort.endDate,
    isActive: cohort.isActive,
    discountPercentage: cohort.discountPercentage,
    discountEndsAt: cohort.discountEndsAt,
    imageUrl: cohort.imageUrl,
    course: cohort.course ? publicCourse(cohort.course) : undefined,
    teachers: cohort.teachers?.map((teacher) => ({
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      profilePicture: teacher.profilePicture,
    })),
    enrollmentCount: cohort.enrollmentCount,
    enrolledCount: cohort.enrollmentCount ?? 0,
  };
}

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
    private readonly prisma: PrismaService,
  ) {}

  @Get('favorites')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Listar ediciones favoritas del usuario actual' })
  getFavorites(@CurrentUser() user: { id: string }) {
    return this.prisma.cohortFavorite.findMany({
      where: { userId: user.id, cohort: { deletedAt: null } },
      select: { cohortId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('cohorts/:id/favorite')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Guardar una edición como favorita' })
  async addFavorite(
    @Param('id') cohortId: string,
    @CurrentUser() user: { id: string },
  ) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, deletedAt: null },
      select: { id: true },
    });
    if (!cohort)
      throw new NotFoundException('La edición no existe o fue eliminada');
    return this.prisma.cohortFavorite.upsert({
      where: { userId_cohortId: { userId: user.id, cohortId } },
      create: { userId: user.id, cohortId },
      update: {},
      select: { cohortId: true },
    });
  }

  @Delete('cohorts/:id/favorite')
  @Roles('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Quitar una edición de favoritos' })
  async removeFavorite(
    @Param('id') cohortId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.prisma.cohortFavorite.deleteMany({
      where: { userId: user.id, cohortId },
    });
    return { cohortId, saved: false };
  }

  // ── MÉTRICAS Y EXPORTACIÓN ──

  @Get('metrics')
  @Roles('ADMIN', 'RRHH')
  @ApiOperation({ summary: 'Obtener métricas para el dashboard' })
  async getDashboardMetrics() {
    return this.academicMetricsService.getDashboardMetrics();
  }

  @Get('data-quality')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Detectar registros académicos incompletos' })
  getDataQuality() {
    return this.academicMetricsService.getDataQualitySummary();
  }

  @Get('export-students')
  @Roles('ADMIN', 'RRHH')
  @ApiOperation({ summary: 'Exportar estudiantes a CSV' })
  async exportStudents() {
    return this.academicMetricsService.getStudentsExportData();
  }

  @Get('enrollments')
  @Roles('ADMIN', 'RRHH')
  @ApiOperation({ summary: 'Listar matrículas paginadas' })
  async getEnrollments(@Query() query: EnrollmentsQueryDto) {
    return this.academicMetricsService.getEnrollmentsPage(
      query.page,
      query.limit,
      query.search,
    );
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
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar todos los cursos para administración' })
  async getAllCourses() {
    return this.manageCourseUseCase.getAllCourses();
  }

  @Get('public/courses')
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar cursos para el sitio público' })
  async getPublicCourses() {
    const courses = await this.manageCourseUseCase.getPublicCourses();
    return courses.map(publicCourse);
  }

  @Get('public/stats')
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Obtener indicadores públicos de la academia' })
  async getPublicStats() {
    return this.academicMetricsService.getPublicStats();
  }

  @Get('public/courses/:id/testimonials')
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar testimonios publicados de un programa' })
  async getPublicTestimonials(@Param('id') courseId: string) {
    const rows = await this.prisma.teacherEvaluation.findMany({
      where: {
        cohort: { courseId },
        isPublished: true,
        score: { gte: 4 },
        comment: { not: null },
      },
      select: {
        score: true,
        comment: true,
        cohort: { select: { course: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    return rows.map((row) => ({
      score: row.score,
      comment: row.comment,
      programName: row.cohort.course.name,
      author: 'Estudiante de la academia',
    }));
  }

  @Get('testimonials')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Listar testimonios para moderaciÃ³n administrativa',
  })
  async getTestimonialsForModeration() {
    return this.prisma.teacherEvaluation.findMany({
      select: {
        id: true,
        score: true,
        comment: true,
        isPublished: true,
        createdAt: true,
        student: { select: { firstName: true, lastName: true, email: true } },
        cohort: {
          select: {
            name: true,
            course: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Patch('testimonials/:id/publish')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar u ocultar un testimonio' })
  async updateTestimonialPublication(
    @Param('id') id: string,
    @Body() body: UpdateTestimonialPublishDto,
  ) {
    if (typeof body.isPublished !== 'boolean') {
      throw new BadRequestException('isPublished debe ser booleano');
    }
    return this.prisma.teacherEvaluation.update({
      where: { id },
      data: { isPublished: body.isPublished },
      select: { id: true, isPublished: true },
    });
  }

  @Patch('courses/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar un curso (Solo Admin)' })
  async updateCourse(@Param('id') id: string, @Body() body: UpdateCourseDto) {
    return this.manageCourseUseCase.updateCourse(id, body);
  }

  @Post('courses/:id/image')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Subir imagen para el curso (Solo Admin)' })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadCourseImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Ningún archivo fue subido o el formato es incorrecto',
      );
    }

    const imageUrl = await this.storageService.uploadFile(file, 'courses');
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

  @Post('cohorts/:id/duplicate')
  @Roles('ADMIN', 'DOCENTE')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicar la estructura académica de una cohorte' })
  duplicateCohort(
    @Param('id') id: string,
    @Body() body: DuplicateCohortDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.academicExtrasService.duplicateCohort(id, user, body);
  }

  @Get('cohorts')
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Listar todas las cohortes para administración' })
  async getAllCohorts(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('activeOnly') activeOnly?: string,
    @Query('search') search?: string,
  ) {
    const cohorts =
      user.roles?.includes('DOCENTE') &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('RRHH')
        ? await this.manageCohortUseCase.getCohortsForTeacher(user.id)
        : await this.manageCohortUseCase.getAllCohorts();

    const now = Date.now();
    const term = search?.trim().toLowerCase() || '';
    return cohorts.filter((cohort) => {
      if (activeOnly === 'true') {
        const end = new Date(cohort.endDate).getTime();
        if (!cohort.isActive || cohort.deletedAt || end < now) return false;
      }
      if (term) {
        const text =
          `${cohort.name} ${cohort.course?.name || ''}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  }

  @Get('public/cohorts')
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar cohortes operativas para el sitio público' })
  async getPublicCohorts() {
    const now = new Date();
    const cohorts = this.manageCohortUseCase.getPublicOperationalCohorts
      ? await this.manageCohortUseCase.getPublicOperationalCohorts(now)
      : await this.manageCohortUseCase.getAllCohorts();
    return cohorts
      .filter(
        (cohort) =>
          cohort.isOperational &&
          cohort.endDate >= now &&
          cohort.hasCapacity &&
          cohort.course?.isAvailable === true,
      )
      .map(publicCohort);
  }

  @Get('cohorts/:id')
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Obtener una cohorte por ID' })
  async getCohortById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    await this.academicExtrasService.assertCohortViewAccess(id, user);
    const cohort = await this.manageCohortUseCase.getCohortById(id);
    if (!cohort) {
      throw new NotFoundException('La cohorte no existe o fue eliminada');
    }
    return cohort;
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
  async uploadCohortImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Ningún archivo fue subido o el formato es incorrecto',
      );
    }

    const imageUrl = await this.storageService.uploadFile(file, 'cohorts');
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
  async getMyCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.academicExtrasService.getMyActiveCohorts(user.id);
  }

  @Get('teacher/attention')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({
    summary: 'Obtener estudiantes con bajo progreso y foros pendientes',
  })
  getTeacherAttention(@CurrentUser() user: { id: string; roles?: string[] }) {
    return this.academicExtrasService.getTeacherAttention(
      user.id,
      user.roles ?? [],
    );
  }

  @Post('teacher/attention/remind')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({
    summary: 'Enviar un recordatorio al estudiante con bajo progreso',
  })
  remindLowProgressStudent(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Body() body: StudentCohortActionDto,
  ) {
    return this.academicExtrasService.remindLowProgressStudent({
      ...body,
      teacherId: user.id,
      roles: user.roles ?? [],
    });
  }

  // ── MATRÍCULAS ──

  // El endpoint público de matriculación de estudiantes fue removido
  // ya que ahora todo el flujo de compra/matriculación pasa por POST /payments/checkout

  @Post('enrollments/admin')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Matricular a un estudiante (Admin/RRHH)' })
  async enrollStudentAdmin(@Body() dto: StudentCohortActionDto) {
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
  async getCohortStudents(
    @Param('id') cohortId: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    return this.academicExtrasService.getCohortStudents(cohortId, user);
  }

  @Post('cohorts/:id/attendance')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Registrar asistencia de un alumno' })
  async markAttendance(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Param('id') cohortId: string,
    @Body() body: MarkAttendanceDto,
  ) {
    return this.academicExtrasService.markAttendance(cohortId, body, user);
  }

  @Post('cohorts/:id/attendance-bulk')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({
    summary: 'Registrar asistencia masiva de la lista de alumnos',
  })
  async markAttendanceBulk(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Param('id') cohortId: string,
    @Body() body: MarkAttendanceBulkDto,
  ) {
    return this.academicExtrasService.markAttendanceBulk(cohortId, body, user);
  }

  @Get('cohorts/:id/attendance')
  @Roles('DOCENTE', 'ADMIN', 'ESTUDIANTE')
  @ApiOperation({ summary: 'Obtener asistencia de una fecha' })
  async getAttendance(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Param('id') cohortId: string,
    @Query('date') date: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.academicExtrasService.getAttendance(
      cohortId,
      date,
      sessionId,
      user,
    );
  }

  @Get('cohorts/:id/grades-summary')
  @Roles('DOCENTE', 'ADMIN', 'RRHH')
  @ApiOperation({
    summary:
      'Obtener acta de notas consolidadas y promedios finales de la cohorte',
  })
  async getCohortGradesSummary(
    @Param('id') cohortId: string,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    return this.academicExtrasService.getCohortGradesSummary(cohortId, user);
  }

  @Post('cohorts/:id/grades/import')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Importar notas de una evaluación desde CSV' })
  async importGrades(
    @Param('id') cohortId: string,
    @Body() body: ImportGradesDto,
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    if (
      !body ||
      typeof body.evaluationId !== 'string' ||
      !Array.isArray(body.rows)
    ) {
      throw new BadRequestException(
        'evaluationId y rows son obligatorios para importar notas',
      );
    }
    return this.academicExtrasService.importGrades(
      cohortId,
      body.evaluationId,
      body.rows,
      user,
    );
  }

  // ── EVALUACIÓN DOCENTE (Fase 4) ──

  @Post('cohorts/:id/evaluate')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Evaluar al docente de la cohorte' })
  async evaluateTeacher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cohortId: string,
    @Body() body: EvaluateTeacherDto,
  ) {
    return this.academicExtrasService.evaluateTeacher(cohortId, user.id, body);
  }

  // ── CALENDARIO ACADÉMICO ──

  @Get('calendar-events')
  @ApiOperation({ summary: 'Obtener eventos del calendario académico' })
  async getCalendarEvents(@CurrentUser() user: AuthenticatedUser) {
    const role = user.roles?.[0] || 'ESTUDIANTE';
    return this.academicExtrasService.getCalendarEvents(user.id, role);
  }

  // ── PROGRESO DEL ESTUDIANTE ──

  @Get('cohorts/:id/my-progress')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Obtener progreso del estudiante en una cohorte' })
  async getMyProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cohortId: string,
  ) {
    return this.academicExtrasService.getStudentProgress(user.id, cohortId);
  }

  @Get('student/learning-overview')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Obtener el resumen de aprendizaje del estudiante' })
  async getLearningOverview(
    @CurrentUser() user: { id: string },
    @Query('includeEngagement') includeEngagement?: string,
  ) {
    if (includeEngagement === 'true') {
      return this.academicExtrasService.getLearningOverview(user.id, true);
    }
    return this.academicExtrasService.getLearningOverview(user.id);
  }

  @Get('student/engagement')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Obtener puntos, racha y logros del estudiante' })
  async getStudentEngagement(@CurrentUser() user: { id: string }) {
    return this.academicExtrasService.getStudentEngagement(user.id);
  }

  @Patch('materials/:id/progress')
  @Roles('ESTUDIANTE')
  @ApiOperation({ summary: 'Actualizar el progreso de un material' })
  async setMaterialProgress(
    @Param('id') materialId: string,
    @Body() body: SetMaterialProgressDto,
    @CurrentUser() user: { id: string },
  ) {
    if (!body || typeof body.completed !== 'boolean') {
      throw new BadRequestException('completed debe ser booleano');
    }
    return this.academicExtrasService.setMaterialProgress(
      user.id,
      materialId,
      body.completed,
    );
  }

  // ── SUBIDA DE MATERIALES (Ruta Directa Estática) ──

  @Post('materials/upload')
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({
    summary: 'Subir archivo de material (PDF, Word, PPT, Excel, Video)',
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadMaterial(
    @CurrentUser() user: { id: string; roles?: string[] },
    @UploadedFile() file: Express.Multer.File,
    @Body('moduleId') moduleId: string,
    @Body('title') title?: string,
    @Body('type') type?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo no adjuntado');
    if (!moduleId) throw new BadRequestException('moduleId es requerido');

    const fileUrl = await this.storageService.uploadFile(file, 'materials');

    let materialType: MaterialType = Object.values(MaterialType).includes(
      type as MaterialType,
    )
      ? (type as MaterialType)
      : MaterialType.PDF;
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (
      ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf'].includes(ext || '')
    ) {
      materialType = MaterialType.PDF;
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
      materialType = MaterialType.VIDEO;
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
      materialType = MaterialType.REPOSITORY;
    }

    return this.syllabusService.addMaterial(
      moduleId,
      {
        title: title || file.originalname,
        type: materialType,
        fileUrl,
      },
      user,
    );
  }
}
