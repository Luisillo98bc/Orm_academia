// ============================================================================
// Grade Entity — Capa de Dominio
// ============================================================================

/**
 * Estados posibles de una calificación.
 */
export enum GradeStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

/**
 * Entidad de dominio Grade.
 * Representa la calificación otorgada por un docente a un entregable.
 */
export class GradeEntity {
  readonly id: string;
  readonly deliverableId: string;
  readonly graderId: string;
  readonly score: number;
  readonly feedback: string | null;
  readonly status: GradeStatusEnum;
  readonly gradedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: {
    id: string;
    deliverableId: string;
    graderId: string;
    score: number;
    feedback?: string | null;
    status: GradeStatusEnum;
    gradedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.deliverableId = props.deliverableId;
    this.graderId = props.graderId;
    this.score = props.score;
    this.feedback = props.feedback ?? null;
    this.status = props.status;
    this.gradedAt = props.gradedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
  }

  /** Verifica si la calificación es visible para el estudiante. */
  get isVisibleToStudent(): boolean {
    return this.status === GradeStatusEnum.PUBLISHED && this.deletedAt === null;
  }
}
