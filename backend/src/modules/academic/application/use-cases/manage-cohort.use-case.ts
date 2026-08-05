import { Inject, Injectable } from '@nestjs/common';
import type { ICohortRepository } from '../../domain/repositories/cohort.repository.interface';
import { COHORT_REPOSITORY } from '../../domain/repositories/cohort.repository.interface';
import { CreateCohortDto } from '../dtos/create-cohort.dto';
import { CohortEntity } from '../../domain/entities/cohort.entity';

@Injectable()
export class ManageCohortUseCase {
  constructor(
    @Inject(COHORT_REPOSITORY)
    private readonly cohortRepository: ICohortRepository,
  ) {}

  async createCohort(dto: CreateCohortDto): Promise<CohortEntity> {
    return this.cohortRepository.create(dto);
  }

  async getAllCohorts(): Promise<CohortEntity[]> {
    return this.cohortRepository.findAll();
  }

  async updateCohort(
    id: string,
    data: {
      name?: string;
      teacherIds?: string[];
      price?: string;
      maxStudents?: number;
      startDate?: Date;
      endDate?: Date;
      isActive?: boolean;
      discountPercentage?: number;
      discountEndsAt?: Date;
      imageUrl?: string;
    },
  ): Promise<CohortEntity> {
    return this.cohortRepository.update(id, data);
  }

  async deleteCohort(id: string): Promise<void> {
    return this.cohortRepository.softDelete(id);
  }

  async getTrashCohorts(): Promise<CohortEntity[]> {
    return this.cohortRepository.findTrash();
  }

  async restoreCohort(id: string): Promise<CohortEntity> {
    return this.cohortRepository.restore(id);
  }
}
