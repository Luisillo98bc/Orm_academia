// ============================================================================
// GetCohortEvaluationsUseCase
// ============================================================================

import { Injectable, Inject } from '@nestjs/common';
import { EVALUATION_REPOSITORY } from '../../domain/repositories/evaluation.repository.interface';
import type { IEvaluationRepository } from '../../domain/repositories/evaluation.repository.interface';
import { DELIVERABLE_REPOSITORY } from '../../domain/repositories/deliverable.repository.interface';
import type { IDeliverableRepository } from '../../domain/repositories/deliverable.repository.interface';

@Injectable()
export class GetCohortEvaluationsUseCase {
  constructor(
    @Inject(EVALUATION_REPOSITORY)
    private readonly evaluationRepository: IEvaluationRepository,
    @Inject(DELIVERABLE_REPOSITORY)
    private readonly deliverableRepository: IDeliverableRepository,
  ) {}

  async execute(cohortId: string, userId: string, role: string) {
    const evaluations =
      await this.evaluationRepository.findByCohortId(cohortId);

    // Si es estudiante, solo devolvemos las publicadas y adjuntamos si ya la entregó
    if (role === 'ESTUDIANTE') {
      const published = evaluations.filter((e) => e.isPublished);

      const withDeliveryStatus = await Promise.all(
        published.map(async (ev) => {
          const deliverable =
            await this.deliverableRepository.findByEvaluationAndStudent(
              ev.id,
              userId,
            );
          return {
            ...ev,
            deliverable: deliverable || null,
          };
        }),
      );

      return withDeliveryStatus;
    }

    // Si es DOCENTE o ADMIN devolvemos todo, adjuntando entregables
    const withDeliverables = await Promise.all(
      evaluations.map(async (ev) => {
        const deliverables = await this.deliverableRepository.findByEvaluation(
          ev.id,
        );
        return {
          ...ev,
          deliverables,
        };
      }),
    );

    return withDeliverables;
  }
}
