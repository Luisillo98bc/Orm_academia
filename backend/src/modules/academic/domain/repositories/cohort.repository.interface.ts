import { CohortEntity } from '../entities/cohort.entity';

export interface ICohortRepository {
  findAll(): Promise<CohortEntity[]>;
  findPublicOperational?(now?: Date): Promise<CohortEntity[]>;
  findByTeacherId(teacherId: string): Promise<CohortEntity[]>;
  findById(id: string): Promise<CohortEntity | null>;
  create(data: {
    courseId: string;
    teacherIds: string[];
    name: string;
    modality?: string;
    schedule?: string;
    price?: string;
    installments?: number;
    maxStudents: number;
    startDate: Date;
    endDate: Date;
    discountPercentage?: number;
    discountEndsAt?: Date;
    imageUrl?: string;
  }): Promise<CohortEntity>;

  update(
    id: string,
    data: {
      name?: string;
      modality?: string;
      schedule?: string;
      teacherIds?: string[];
      price?: string;
      installments?: number;
      maxStudents?: number;
      startDate?: Date;
      endDate?: Date;
      isActive?: boolean;
      discountPercentage?: number;
      discountEndsAt?: Date;
      imageUrl?: string;
    },
  ): Promise<CohortEntity>;

  softDelete(id: string): Promise<void>;
  findTrash(): Promise<CohortEntity[]>;
  restore(id: string): Promise<CohortEntity>;
}

export const COHORT_REPOSITORY = Symbol('ICohortRepository');
