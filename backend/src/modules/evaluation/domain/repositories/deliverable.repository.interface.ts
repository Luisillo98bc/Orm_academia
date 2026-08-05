// ============================================================================
// IDeliverableRepository — Puerto del Dominio de Evaluaciones
// ============================================================================

import { DeliverableEntity } from '../entities/deliverable.entity';

/**
 * Puerto para operaciones de persistencia de entregables.
 */
export interface IDeliverableRepository {
  /**
   * Busca un entregable por ID. Respeta soft delete.
   */
  findById(id: string): Promise<DeliverableEntity | null>;

  /**
   * Busca todos los entregables de una evaluación específica.
   */
  findByEvaluation(evaluationId: string): Promise<DeliverableEntity[]>;

  /**
   * Busca un entregable existente de un estudiante para una evaluación.
   * Respeta soft delete.
   */
  findByEvaluationAndStudent(
    evaluationId: string,
    studentId: string,
  ): Promise<DeliverableEntity | null>;

  /**
   * Crea un nuevo entregable en la base de datos.
   */
  create(data: {
    evaluationId: string;
    studentId: string;
    fileUrl: string;
    fileName?: string;
    comment?: string;
    status: string;
  }): Promise<DeliverableEntity>;

  /**
   * Actualiza el estado de un entregable.
   */
  updateStatus(id: string, status: string): Promise<void>;
}

export const DELIVERABLE_REPOSITORY = Symbol('IDeliverableRepository');
