// ============================================================================
// Evaluation Entity — Capa de Dominio
// ============================================================================

/**
 * Entidad de dominio Evaluation.
 * Representa una tarea/proyecto asignada a una cohorte.
 */
export class EvaluationEntity {
  readonly id: string;
  readonly cohortId: string;
  readonly title: string;
  readonly description: string | null;
  readonly weight: number;
  readonly maxScore: number;
  readonly dueDate: Date | null;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: {
    id: string;
    cohortId: string;
    title: string;
    description?: string | null;
    weight: number;
    maxScore: number;
    dueDate?: Date | null;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.cohortId = props.cohortId;
    this.title = props.title;
    this.description = props.description ?? null;
    this.weight = props.weight;
    this.maxScore = props.maxScore;
    this.dueDate = props.dueDate ?? null;
    this.isPublished = props.isPublished;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
  }

  /** Verifica si la evaluación aún acepta entregas. */
  get isOpen(): boolean {
    if (!this.isPublished || this.deletedAt !== null) return false;
    if (!this.dueDate) return true;
    return new Date() <= this.dueDate;
  }

  /** Verifica si la fecha límite ya pasó. */
  get isOverdue(): boolean {
    if (!this.dueDate) return false;
    return new Date() > this.dueDate;
  }
}
