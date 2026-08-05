// ============================================================================
// PrismaGradeRepository — Implementación de IGradeRepository
// ============================================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IGradeRepository } from '../../domain/repositories/grade.repository.interface';
import {
  GradeEntity,
  GradeStatusEnum,
} from '../../domain/entities/grade.entity';

@Injectable()
export class PrismaGradeRepository implements IGradeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDeliverableId(
    deliverableId: string,
  ): Promise<GradeEntity | null> {
    const grade = await this.prisma.grade.findFirst({
      where: {
        deliverableId,
        deletedAt: null, // 🔒 Soft delete
      },
    });

    if (!grade) return null;
    return this.toDomainEntity(grade);
  }

  async create(data: {
    deliverableId: string;
    graderId: string;
    score: number;
    feedback?: string;
    status: string;
  }): Promise<GradeEntity> {
    const grade = await this.prisma.grade.create({
      data: {
        deliverableId: data.deliverableId,
        graderId: data.graderId,
        score: data.score,
        feedback: data.feedback,
        status: data.status as any,
      },
    });

    return this.toDomainEntity(grade);
  }

  async update(
    id: string,
    data: {
      score?: number;
      feedback?: string;
      status?: string;
    },
  ): Promise<GradeEntity> {
    const grade = await this.prisma.grade.update({
      where: { id },
      data: {
        ...(data.score !== undefined && { score: data.score }),
        ...(data.feedback !== undefined && { feedback: data.feedback }),
        ...(data.status !== undefined && { status: data.status as any }),
        gradedAt: new Date(),
      },
    });

    return this.toDomainEntity(grade);
  }

  private toDomainEntity(raw: any): GradeEntity {
    return new GradeEntity({
      id: raw.id,
      deliverableId: raw.deliverableId,
      graderId: raw.graderId,
      score: raw.score,
      feedback: raw.feedback,
      status: raw.status as GradeStatusEnum,
      gradedAt: raw.gradedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }
}
