// ============================================================================
// IEvaluationRepository — Puerto del Dominio de Evaluaciones
// ============================================================================

import { EvaluationEntity } from '../entities/evaluation.entity';

/**
 * Puerto para operaciones de persistencia de evaluaciones.
 */
export interface IEvaluationRepository {
  /**
   * Busca una evaluación por ID. Respeta soft delete.
   */
  findById(id: string): Promise<EvaluationEntity | null>;

  /**
   * Busca todas las evaluaciones de una cohorte. Respeta soft delete.
   */
  findByCohortId(cohortId: string): Promise<EvaluationEntity[]>;

  /**
   * Crea una nueva evaluación.
   */
  create(
    data: Omit<
      EvaluationEntity,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'isOpen' | 'isOverdue'
    >,
  ): Promise<EvaluationEntity>;
}

export const EVALUATION_REPOSITORY = Symbol('IEvaluationRepository');
