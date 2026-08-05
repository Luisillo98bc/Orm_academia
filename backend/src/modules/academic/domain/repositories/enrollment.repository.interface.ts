// ============================================================================
// IEnrollmentRepository — Puerto del Dominio Académico
// ============================================================================

import { EnrollmentEntity } from '../entities/enrollment.entity';

/**
 * Puerto para operaciones de persistencia de matrículas.
 */
export interface IEnrollmentRepository {
  /**
   * Busca una matrícula activa por estudiante y cohorte.
   * Respeta soft delete.
   */
  findActiveByUserAndCohort(
    userId: string,
    cohortId: string,
  ): Promise<EnrollmentEntity | null>;

  create(data: {
    studentId: string;
    cohortId: string;
  }): Promise<EnrollmentEntity>;

  /**
   * Busca todas las matrículas de un estudiante.
   * Respeta soft delete.
   */
  findByUserId(userId: string): Promise<EnrollmentEntity[]>;
}

export const ENROLLMENT_REPOSITORY = Symbol('IEnrollmentRepository');
