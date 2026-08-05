// ============================================================================
// Course Entity — Capa de Dominio
// ============================================================================

/**
 * Niveles disponibles para un curso.
 */
export enum CourseLevelEnum {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

/**
 * Entidad de dominio Course.
 * Representa el catálogo general de un curso sin dependencias de infraestructura.
 */
export class CourseEntity {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly promotionalVideoUrl: string | null;
  readonly whatYouWillLearn: string | null;
  readonly requirements: string | null;
  readonly targetAudience: string | null;
  readonly level: CourseLevelEnum;
  readonly durationHours: number;
  readonly imageUrl: string | null;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    promotionalVideoUrl?: string | null;
    whatYouWillLearn?: string | null;
    requirements?: string | null;
    targetAudience?: string | null;
    level: CourseLevelEnum;
    durationHours: number;
    imageUrl?: string | null;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.code = props.code;
    this.name = props.name;
    this.description = props.description ?? null;
    this.promotionalVideoUrl = props.promotionalVideoUrl ?? null;
    this.whatYouWillLearn = props.whatYouWillLearn ?? null;
    this.requirements = props.requirements ?? null;
    this.targetAudience = props.targetAudience ?? null;
    this.level = props.level;
    this.durationHours = props.durationHours;
    this.imageUrl = props.imageUrl ?? null;
    this.isPublished = props.isPublished;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
  }

  /** Verifica si el curso está disponible para inscripciones. */
  get isAvailable(): boolean {
    return this.isPublished && this.deletedAt === null;
  }
}
