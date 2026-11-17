// ============================================================================
// EvaluationController — Capa de Presentación
// ============================================================================

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { PermissionsGuard } from '../../../auth/infrastructure/guards/permissions.guard';
import { Permissions } from '../../../auth/infrastructure/guards/permissions.decorator';
import { AcademicExtrasService } from '../../../academic/application/services/academic-extras.service';

import {
  SubmitDeliverableUseCase,
  GradeDeliverableUseCase,
  CreateEvaluationUseCase,
  GetCohortEvaluationsUseCase,
  UpdateEvaluationUseCase,
  DeleteEvaluationUseCase,
} from '../../application/use-cases';

import { CreateEvaluationDto } from '../../application/dtos/create-evaluation.dto';
import { SubmitDeliverableDto } from '../../application/dtos/submit-deliverable.dto';
import { GradeDeliverableDto } from '../../application/dtos/grade-deliverable.dto';
import { UpdateEvaluationDto } from '../../application/dtos/update-evaluation.dto';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/infrastructure/strategies/authenticated-user.type';
import { ClassroomService } from '../../application/services/classroom.service';

/**
 * Controlador de evaluaciones, entregas y calificaciones.
 * Todos los endpoints requieren autenticación JWT.
 */
@Controller('evaluations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvaluationController {
  constructor(
    private readonly submitDeliverableUseCase: SubmitDeliverableUseCase,
    private readonly gradeDeliverableUseCase: GradeDeliverableUseCase,
    private readonly createEvaluationUseCase: CreateEvaluationUseCase,
    private readonly getCohortEvaluationsUseCase: GetCohortEvaluationsUseCase,
    private readonly updateEvaluationUseCase: UpdateEvaluationUseCase,
    private readonly deleteEvaluationUseCase: DeleteEvaluationUseCase,
    private readonly academicExtrasService: AcademicExtrasService,
    private readonly classroom: ClassroomService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @Permissions('evaluations:update')
  @HttpCode(HttpStatus.CREATED)
  async createEvaluation(
    @Body() dto: CreateEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.academicExtrasService.assertCohortManagerAccess(
      dto.cohortId,
      user,
    );
    const result = await this.createEvaluationUseCase.execute(dto, user.id);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Evaluación creada exitosamente.',
      data: result,
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @Permissions('evaluations:update')
  async updateEvaluation(
    @Param('id') evaluationId: string,
    @Body() dto: UpdateEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.academicExtrasService.assertEvaluationManagerAccess(
      evaluationId,
      user,
    );
    const result = await this.classroom.legacyUpdate(
      evaluationId,
      {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      user,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Evaluación actualizada.',
      data: result,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @Permissions('evaluations:update')
  async deleteEvaluation(
    @Param('id') evaluationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.academicExtrasService.assertEvaluationManagerAccess(
      evaluationId,
      user,
    );
    await this.deleteEvaluationUseCase.execute(evaluationId);
    return { statusCode: HttpStatus.OK, message: 'Evaluación retirada.' };
  }

  @Get('cohort/:id')
  @HttpCode(HttpStatus.OK)
  async getCohortEvaluations(
    @Param('id') cohortId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.academicExtrasService.assertCohortViewAccess(cohortId, user);
    const role = user.roles[0];
    void role;
    const result = (await this.classroom.list(cohortId, user)).map(
      (evaluation) => ({
        ...evaluation,
        deliverables: evaluation.deliverables.map((d) => ({
          ...d,
          score: d.grade?.score ?? null,
          feedback: d.grade?.feedback ?? d.returnFeedback ?? null,
        })),
      }),
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Evaluaciones obtenidas exitosamente.',
      data: result,
    };
  }

  @Get('cohort/:id/grades-summary')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @HttpCode(HttpStatus.OK)
  async getCohortGradesSummary(
    @Param('id') cohortId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.academicExtrasService.assertCohortViewAccess(cohortId, user);
    return this.academicExtrasService.getCohortGradesSummary(cohortId, user);
  }

  /**
   * POST /api/v1/evaluations/deliver
   *
   * Permite a un estudiante entregar su tarea/proyecto.
   * El studentId se extrae del token JWT.
   */
  @Post('deliver')
  @Permissions('evaluations:submit')
  @HttpCode(HttpStatus.CREATED)
  async submitDeliverable(
    @Body() dto: SubmitDeliverableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const delivery = await this.classroom.submit(
      dto.evaluationId,
      {
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        comment: dto.comment,
      },
      user,
    );
    const result = {
      ...delivery,
      deliverableId: delivery.id,
      isLate: delivery.status === 'LATE',
    };

    return {
      statusCode: HttpStatus.CREATED,
      message: result.isLate
        ? 'Entrega registrada con retraso. El docente decidirá si la acepta.'
        : 'Entrega registrada exitosamente.',
      data: result,
    };
  }

  /**
   * POST /api/v1/evaluations/grade
   *
   * Permite a un docente calificar un entregable.
   * El graderId se extrae del token JWT.
   */
  @Post('grade')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @Permissions('evaluations:update')
  @HttpCode(HttpStatus.OK)
  async gradeDeliverable(
    @Body() dto: GradeDeliverableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.academicExtrasService.assertDeliverableManagerAccess(
      dto.deliverableId,
      user,
    );
    const result = await this.classroom.grade(
      dto.deliverableId,
      {
        score: dto.score,
        feedback: dto.feedback,
      },
      user,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Calificación publicada exitosamente.',
      data: result,
    };
  }
}
