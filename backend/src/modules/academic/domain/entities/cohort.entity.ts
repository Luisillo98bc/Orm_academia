// ============================================================================

import { CourseEntity } from './course.entity';

// Cohort Entity — Capa de Dominio
// ============================================================================

/**
 * Entidad de dominio Cohort.
 * Representa una instancia específica de un curso con fechas, docente y enlace de Meet.
 */
export class CohortEntity {
  readonly id: string;
  readonly courseId: string;
  readonly teacherIds: string[];
  readonly name: string;
  readonly modality: string;
  readonly schedule: string | null;
  readonly googleMeetLink: string | null;
  readonly price: string;
  readonly installments: number;
  readonly maxStudents: number;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly isActive: boolean;
  readonly discountPercentage: number;
  readonly discountEndsAt: Date | null;
  readonly imageUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  /** Nombre del curso (cargado desde la relación). */
  readonly courseName?: string;

  /** Objeto completo del curso (cargado desde la relación) */
  readonly course?: CourseEntity;

  /** Profesores asignados (cargados desde la relación). */
  readonly teachers?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string | null;
    department?: string | null;
    position?: string | null;
  }[];

  /** Número actual de estudiantes matriculados. */
  readonly enrollmentCount?: number;

  constructor(props: {
    id: string;
    courseId: string;
    teacherIds: string[];
    name: string;
    modality?: string;
    schedule?: string | null;
    googleMeetLink?: string | null;
    price?: string;
    installments?: number;
    maxStudents: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    discountPercentage?: number;
    discountEndsAt?: Date | null;
    imageUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    courseName?: string;
    course?: CourseEntity;
    teachers?: {
      id: string;
      firstName: string;
      lastName: string;
      profilePicture?: string | null;
      department?: string | null;
      position?: string | null;
    }[];
    enrollmentCount?: number;
  }) {
    this.id = props.id;
    this.courseId = props.courseId;
    this.teacherIds = props.teacherIds;
    this.name = props.name;
    this.modality = props.modality ?? 'ONLINE';
    this.schedule = props.schedule ?? null;
    this.googleMeetLink = props.googleMeetLink ?? null;
    this.price = props.price ?? '0.00';
    this.installments = Math.max(1, props.installments ?? 1);
    this.maxStudents = props.maxStudents;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.isActive = props.isActive;
    this.discountPercentage = props.discountPercentage ?? 0;
    this.discountEndsAt = props.discountEndsAt ?? null;
    this.imageUrl = props.imageUrl ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
    this.courseName = props.courseName;
    this.course = props.course;
    this.teachers = props.teachers;
    this.enrollmentCount = props.enrollmentCount;
  }

  /** Verifica si la cohorte está activa y no eliminada. */
  get isOperational(): boolean {
    return this.isActive && this.deletedAt === null;
  }

  /** Verifica si la cohorte está en progreso según las fechas. */
  get isInProgress(): boolean {
    const now = new Date();
    return this.isOperational && now >= this.startDate && now <= this.endDate;
  }

  /** Verifica si hay cupo disponible. */
  get hasCapacity(): boolean {
    return (this.enrollmentCount ?? 0) < this.maxStudents;
  }
}
