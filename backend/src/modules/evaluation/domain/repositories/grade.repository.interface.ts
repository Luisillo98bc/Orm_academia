// ============================================================================
// IGradeRepository — Puerto del Dominio de Evaluaciones
// ============================================================================

import { GradeEntity } from '../entities/grade.entity';

/**
 * Puerto para operaciones de persistencia de calificaciones.
 */
export interface IGradeRepository {
  /**
   * Busca una calificación por ID del entregable. Respeta soft delete.
   */
  findByDeliverableId(deliverableId: string): Promise<GradeEntity | null>;

  /**
   * Crea una nueva calificación.
   */
  create(data: {
    deliverableId: string;
    graderId: string;
    score: number;
    feedback?: string;
    status: string;
  }): Promise<GradeEntity>;

  /**
   * Actualiza una calificación existente.
   */
  update(
    id: string,
    data: {
      score?: number;
      feedback?: string;
      status?: string;
    },
  ): Promise<GradeEntity>;
}

export const GRADE_REPOSITORY = Symbol('IGradeRepository');
