// ============================================================================
// PrismaEnrollmentRepository — Implementación de IEnrollmentRepository
// ============================================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IEnrollmentRepository } from '../../domain/repositories/enrollment.repository.interface';
import {
  EnrollmentEntity,
  EnrollmentStatusEnum,
} from '../../domain/entities/enrollment.entity';

@Injectable()
export class PrismaEnrollmentRepository implements IEnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByUserAndCohort(
    userId: string,
    cohortId: string,
  ): Promise<EnrollmentEntity | null> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        cohortId,
        status: 'ACTIVE',
        deletedAt: null, // 🔒 Soft delete
      },
    });

    if (!enrollment) return null;
    return this.toDomainEntity(enrollment);
  }

  async findByUserId(userId: string): Promise<EnrollmentEntity[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        deletedAt: null, // 🔒 Soft delete
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments.map((e) => this.toDomainEntity(e));
  }

  async create(data: {
    studentId: string;
    cohortId: string;
  }): Promise<EnrollmentEntity> {
    const enrollment = await this.prisma.enrollment.create({
      data: {
        userId: data.studentId,
        cohortId: data.cohortId,
        status: 'ACTIVE',
      },
    });

    return this.toDomainEntity(enrollment);
  }

  private toDomainEntity(raw: any): EnrollmentEntity {
    return new EnrollmentEntity({
      id: raw.id,
      userId: raw.userId,
      cohortId: raw.cohortId,
      status: raw.status as EnrollmentStatusEnum,
      enrolledAt: raw.enrolledAt,
      completedAt: raw.completedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }
}
