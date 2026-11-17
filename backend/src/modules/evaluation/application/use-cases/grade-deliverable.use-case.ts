// ============================================================================
// GradeDeliverableUseCase — Caso de Uso de Calificación
//
// Flujo:
// 1. Valida que el entregable exista y sea calificable.
// 2. Valida que la nota esté dentro del rango permitido (0–20).
// 3. Verifica si ya existe una calificación (actualiza o crea).
// 4. Actualiza el estado del entregable a GRADED.
// 5. Persiste la calificación a través de IGradeRepository.
// ============================================================================

import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import type { IDeliverableRepository } from '../../domain/repositories/deliverable.repository.interface';
import { DELIVERABLE_REPOSITORY } from '../../domain/repositories/deliverable.repository.interface';

import type { IGradeRepository } from '../../domain/repositories/grade.repository.interface';
import { GRADE_REPOSITORY } from '../../domain/repositories/grade.repository.interface';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../../communication/notifications.service';

import { DeliverableStatusEnum } from '../../domain/entities/deliverable.entity';
import { GradeStatusEnum } from '../../domain/entities/grade.entity';

/** Rango permitido para las calificaciones (escala vigesimal). */
const MIN_SCORE = 0;
const MAX_SCORE = 20;

/**
 * Resultado exitoso de la calificación.
 */
export interface GradeDeliverableResult {
  gradeId: string;
  deliverableId: string;
  score: number;
  feedback: string | null;
  status: string;
  gradedAt: Date;
  isNewGrade: boolean;
}

/**
 * Caso de uso: Calificación de un entregable por parte del docente.
 *
 * Inyecta dos puertos abstractos:
 * - IDeliverableRepository: para buscar y actualizar el entregable
 * - IGradeRepository: para crear/actualizar la calificación
 */
@Injectable()
export class GradeDeliverableUseCase {
  constructor(
    @Inject(DELIVERABLE_REPOSITORY)
    private readonly deliverableRepo: IDeliverableRepository,

    @Inject(GRADE_REPOSITORY)
    private readonly gradeRepo: IGradeRepository,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Ejecuta la calificación de un entregable.
   *
   * @param deliverableId - UUID del entregable a calificar
   * @param graderId - UUID del docente que califica
   * @param score - Nota numérica (0–20)
   * @param feedback - Retroalimentación cualitativa (opcional)
   * @returns Resultado con los datos de la calificación
   */
  async execute(params: {
    deliverableId: string;
    graderId: string;
    score: number;
    feedback?: string;
  }): Promise<GradeDeliverableResult> {
    const { deliverableId, graderId, score, feedback } = params;

    // 1. Validar el rango de la nota (0–20)
    if (score < MIN_SCORE || score > MAX_SCORE) {
      throw new BadRequestException(
        `La nota debe estar entre ${MIN_SCORE} y ${MAX_SCORE}. Valor recibido: ${score}`,
      );
    }

    // 2. Validar que el entregable exista
    const deliverable = await this.deliverableRepo.findById(deliverableId);

    if (!deliverable) {
      throw new NotFoundException(
        `El entregable con ID "${deliverableId}" no existe o fue eliminado`,
      );
    }

    // 3. Verificar si ya existe una calificación para este entregable
    const existingGrade =
      await this.gradeRepo.findByDeliverableId(deliverableId);

    let grade;
    let isNewGrade: boolean;

    if (existingGrade) {
      // ── Actualizar calificación existente ──
      grade = await this.gradeRepo.update(existingGrade.id, {
        score,
        feedback,
        status: GradeStatusEnum.PUBLISHED,
      });
      isNewGrade = false;
    } else {
      // ── Validar que el entregable sea calificable (solo para primera vez) ──
      if (!deliverable.isGradeable) {
        throw new BadRequestException(
          `El entregable no se puede calificar en su estado actual: "${deliverable.status}"`,
        );
      }

      // ── Crear nueva calificación ──
      grade = await this.gradeRepo.create({
        deliverableId,
        graderId,
        score,
        feedback,
        status: GradeStatusEnum.PUBLISHED,
      });
      isNewGrade = true;
    }

    // 4. Actualizar el estado del entregable a GRADED
    await this.deliverableRepo.updateStatus(
      deliverableId,
      DeliverableStatusEnum.GRADED,
    );

    // 5. Enviar email al estudiante
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: deliverable.studentId },
      });
      const evaluation = await this.prisma.evaluation.findUnique({
        where: { id: deliverable.evaluationId },
      });

      if (student && evaluation) {
        this.mailService
          .sendNewGradeNotification(
            student.email,
            student.firstName,
            evaluation.title,
            score,
          )
          .catch((e) => console.error(e));

        await this.notificationsService
          .createNotification({
            userId: student.id,
            title: 'Calificación Publicada',
            message: `Tu profesor ha calificado tu entrega de "${evaluation.title}" con un puntaje de ${score}.`,
            type: 'SUCCESS',
            actionUrl: '/dashboard',
          })
          .catch((e) => console.error(e));
      }
    } catch (err) {
      console.error('Error al intentar enviar email de nota:', err);
    }

    return {
      gradeId: grade.id,
      deliverableId,
      score: grade.score,
      feedback: grade.feedback,
      status: grade.status,
      gradedAt: grade.gradedAt,
      isNewGrade,
    };
  }
}
