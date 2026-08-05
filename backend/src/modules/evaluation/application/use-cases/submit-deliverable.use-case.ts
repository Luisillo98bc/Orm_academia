// ============================================================================
// SubmitDeliverableUseCase — Caso de Uso de Entrega de Tarea
//
// Flujo:
// 1. Valida que la evaluación exista y esté abierta.
// 2. Valida que el estudiante esté matriculado en la cohorte.
// 3. Verifica que no exista una entrega previa (evita duplicados).
// 4. Utiliza IStorageService para procesar/almacenar la URL del código.
// 5. Persiste el entregable a través de IDeliverableRepository.
// ============================================================================

import {
  Inject,
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import type { IEvaluationRepository } from '../../domain/repositories/evaluation.repository.interface';
import { EVALUATION_REPOSITORY } from '../../domain/repositories/evaluation.repository.interface';

import type { IDeliverableRepository } from '../../domain/repositories/deliverable.repository.interface';
import { DELIVERABLE_REPOSITORY } from '../../domain/repositories/deliverable.repository.interface';

import type { IStorageService } from '../../domain/services/storage.service.interface';
import { STORAGE_SERVICE } from '../../domain/services/storage.service.interface';

import { ENROLLMENT_REPOSITORY } from '../../../academic/domain/repositories/enrollment.repository.interface';
import type { IEnrollmentRepository } from '../../../academic/domain/repositories/enrollment.repository.interface';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../../communication/notifications.service';

import { DeliverableStatusEnum } from '../../domain/entities/deliverable.entity';

/**
 * Resultado exitoso de la entrega.
 */
export interface SubmitDeliverableResult {
  deliverableId: string;
  evaluationTitle: string;
  fileUrl: string;
  status: string;
  submittedAt: Date;
  isLate: boolean;
}

/**
 * Caso de uso: Entrega de tarea/proyecto por parte de un estudiante.
 *
 * Inyecta tres puertos abstractos:
 * - IEvaluationRepository: para validar la evaluación
 * - IDeliverableRepository: para persistir la entrega
 * - IStorageService: para procesar/almacenar la URL del código
 * - IEnrollmentRepository: para validar la matrícula del estudiante
 */
@Injectable()
export class SubmitDeliverableUseCase {
  constructor(
    @Inject(EVALUATION_REPOSITORY)
    private readonly evaluationRepo: IEvaluationRepository,

    @Inject(DELIVERABLE_REPOSITORY)
    private readonly deliverableRepo: IDeliverableRepository,

    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,

    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Ejecuta la entrega de un entregable.
   *
   * @param evaluationId - UUID de la evaluación
   * @param studentId - UUID del estudiante autenticado
   * @param fileUrl - URL del repositorio o archivo de código
   * @param fileName - Nombre original del archivo (opcional)
   * @param comment - Comentario del estudiante (opcional)
   * @returns Resultado con los datos de la entrega creada
   */
  async execute(params: {
    evaluationId: string;
    studentId: string;
    fileUrl: string;
    fileName?: string;
    comment?: string;
  }): Promise<SubmitDeliverableResult> {
    const { evaluationId, studentId, fileUrl, fileName, comment } = params;

    // 1. Validar que la evaluación exista y no esté eliminada
    const evaluation = await this.evaluationRepo.findById(evaluationId);

    if (!evaluation) {
      throw new NotFoundException(
        `La evaluación con ID "${evaluationId}" no existe o fue eliminada`,
      );
    }

    // 2. Validar que la evaluación esté publicada
    if (!evaluation.isPublished) {
      throw new BadRequestException(
        'La evaluación aún no está publicada. No se aceptan entregas.',
      );
    }

    // 3. Validar que el estudiante esté matriculado en la cohorte
    const enrollment = await this.enrollmentRepo.findActiveByUserAndCohort(
      studentId,
      evaluation.cohortId,
    );

    if (!enrollment) {
      throw new ForbiddenException(
        'No tienes una matrícula activa en esta cohorte. No puedes entregar.',
      );
    }

    // 4. Verificar que no exista una entrega previa
    const existing = await this.deliverableRepo.findByEvaluationAndStudent(
      evaluationId,
      studentId,
    );

    if (existing) {
      throw new ConflictException(
        'Ya existe una entrega para esta evaluación. Contacta al docente si necesitas reenviar.',
      );
    }

    // 5. Procesar la URL a través del servicio de almacenamiento
    //    Esto valida la URL y la registra en el sistema de archivos.
    const storageResult = await this.storageService.upload(
      fileUrl,
      `deliverables/${evaluation.cohortId}/${evaluationId}`,
      fileName ?? 'submission',
    );

    // 6. Determinar si la entrega es tardía
    const isLate = evaluation.isOverdue;
    const status = isLate
      ? DeliverableStatusEnum.LATE
      : DeliverableStatusEnum.PENDING;

    // 7. Persistir la entrega
    const deliverable = await this.deliverableRepo.create({
      evaluationId,
      studentId,
      fileUrl: storageResult.url,
      fileName: storageResult.fileName,
      comment,
      status,
    });

    // 8. Enviar email a los profesores de la cohorte
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
      });
      const cohort = await this.prisma.cohort.findUnique({
        where: { id: evaluation.cohortId },
        include: { teachers: true },
      });

      if (student && cohort && cohort.teachers.length > 0) {
        for (const teacher of cohort.teachers) {
          if (teacher.email) {
            this.mailService
              .sendNewDeliverableNotification(
                teacher.email,
                teacher.firstName,
                `${student.firstName} ${student.lastName}`,
                evaluation.title,
              )
              .catch((e) => console.error(e));

            this.notificationsService
              .createNotification({
                userId: teacher.id,
                title: 'Nueva Entrega',
                message: `El alumno ${student.firstName} ${student.lastName} ha subido su tarea para "${evaluation.title}".`,
                type: 'INFO',
                actionUrl: '/dashboard',
              })
              .catch((e) => console.error(e));
          }
        }
      }
    } catch (err) {
      console.error('Error enviando notificaciones a docentes:', err);
    }

    return {
      deliverableId: deliverable.id,
      evaluationTitle: evaluation.title,
      fileUrl: deliverable.fileUrl,
      status: deliverable.status,
      submittedAt: deliverable.submittedAt,
      isLate,
    };
  }
}
