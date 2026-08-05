// ============================================================================
// Deliverable Entity — Capa de Dominio
// ============================================================================

/**
 * Estados posibles de un entregable.
 */
export enum DeliverableStatusEnum {
  PENDING = 'PENDING',
  GRADED = 'GRADED',
  RETURNED = 'RETURNED',
  LATE = 'LATE',
}

/**
 * Entidad de dominio Deliverable.
 * Representa la entrega de un estudiante para una evaluación.
 * fileUrl almacena enlaces a repositorios GitHub o archivos de código.
 */
export class DeliverableEntity {
  readonly id: string;
  readonly evaluationId: string;
  readonly studentId: string;
  readonly fileUrl: string;
  readonly fileName: string | null;
  readonly comment: string | null;
  readonly status: DeliverableStatusEnum;
  readonly submittedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: {
    id: string;
    evaluationId: string;
    studentId: string;
    fileUrl: string;
    fileName?: string | null;
    comment?: string | null;
    status: DeliverableStatusEnum;
    submittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.evaluationId = props.evaluationId;
    this.studentId = props.studentId;
    this.fileUrl = props.fileUrl;
    this.fileName = props.fileName ?? null;
    this.comment = props.comment ?? null;
    this.status = props.status;
    this.submittedAt = props.submittedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
  }

  /** Verifica si el entregable puede ser calificado. */
  get isGradeable(): boolean {
    return (
      (this.status === DeliverableStatusEnum.PENDING ||
        this.status === DeliverableStatusEnum.LATE) &&
      this.deletedAt === null
    );
  }

  /** Verifica si el entregable ya fue calificado. */
  get isGraded(): boolean {
    return this.status === DeliverableStatusEnum.GRADED;
  }
}
