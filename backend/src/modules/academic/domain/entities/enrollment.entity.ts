// ============================================================================
// Enrollment Entity — Capa de Dominio
// ============================================================================

/**
 * Estados posibles de una matrícula.
 */
export enum EnrollmentStatusEnum {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Entidad de dominio Enrollment.
 * Representa la matrícula de un estudiante en una cohorte.
 */
export class EnrollmentEntity {
  readonly id: string;
  readonly userId: string;
  readonly cohortId: string;
  readonly status: EnrollmentStatusEnum;
  readonly enrolledAt: Date;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: {
    id: string;
    userId: string;
    cohortId: string;
    status: EnrollmentStatusEnum;
    enrolledAt: Date;
    completedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.cohortId = props.cohortId;
    this.status = props.status;
    this.enrolledAt = props.enrolledAt;
    this.completedAt = props.completedAt ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
  }

  /** Verifica si la matrícula está activa. */
  get isActive(): boolean {
    return (
      this.status === EnrollmentStatusEnum.ACTIVE && this.deletedAt === null
    );
  }
}
