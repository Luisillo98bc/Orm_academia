// ============================================================================
// EvaluationController — Capa de Presentación
// ============================================================================

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { AcademicExtrasService } from '../../../academic/application/services/academic-extras.service';

import {
  SubmitDeliverableUseCase,
  GradeDeliverableUseCase,
  CreateEvaluationUseCase,
  GetCohortEvaluationsUseCase,
} from '../../application/use-cases';

import { CreateEvaluationDto } from '../../application/dtos/create-evaluation.dto';
import { SubmitDeliverableDto } from '../../application/dtos/submit-deliverable.dto';
import { GradeDeliverableDto } from '../../application/dtos/grade-deliverable.dto';

/**
 * Controlador de evaluaciones, entregas y calificaciones.
 * Todos los endpoints requieren autenticación JWT.
 */
@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationController {
  constructor(
    private readonly submitDeliverableUseCase: SubmitDeliverableUseCase,
    private readonly gradeDeliverableUseCase: GradeDeliverableUseCase,
    private readonly createEvaluationUseCase: CreateEvaluationUseCase,
    private readonly getCohortEvaluationsUseCase: GetCohortEvaluationsUseCase,
    private readonly academicExtrasService: AcademicExtrasService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @HttpCode(HttpStatus.CREATED)
  async createEvaluation(@Body() dto: CreateEvaluationDto, @Req() req: any) {
    const result = await this.createEvaluationUseCase.execute(dto, req.user.id);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Evaluación creada exitosamente.',
      data: result,
    };
  }

  @Get('cohort/:id')
  @HttpCode(HttpStatus.OK)
  async getCohortEvaluations(@Req() req: any) {
    const cohortId = req.params.id;
    const role = req.user.roles[0];
    const result = await this.getCohortEvaluationsUseCase.execute(
      cohortId,
      req.user.id,
      role,
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
  async getCohortGradesSummary(@Param('id') cohortId: string) {
    return this.academicExtrasService.getCohortGradesSummary(cohortId);
  }

  /**
   * POST /api/v1/evaluations/deliver
   *
   * Permite a un estudiante entregar su tarea/proyecto.
   * El studentId se extrae del token JWT.
   */
  @Post('deliver')
  @HttpCode(HttpStatus.CREATED)
  async submitDeliverable(@Body() dto: SubmitDeliverableDto, @Req() req: any) {
    const result = await this.submitDeliverableUseCase.execute({
      evaluationId: dto.evaluationId,
      studentId: req.user.id,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      comment: dto.comment,
    });

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
  @HttpCode(HttpStatus.OK)
  async gradeDeliverable(@Body() dto: GradeDeliverableDto, @Req() req: any) {
    const result = await this.gradeDeliverableUseCase.execute({
      deliverableId: dto.deliverableId,
      graderId: req.user.id,
      score: dto.score,
      feedback: dto.feedback,
    });

    return {
      statusCode: HttpStatus.OK,
      message: result.isNewGrade
        ? 'Calificación registrada exitosamente.'
        : 'Calificación actualizada exitosamente.',
      data: result,
    };
  }
}
