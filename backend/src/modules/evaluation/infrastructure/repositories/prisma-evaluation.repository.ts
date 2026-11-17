// ============================================================================
// PrismaEvaluationRepository — Implementación de IEvaluationRepository
// ============================================================================

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IEvaluationRepository } from '../../domain/repositories/evaluation.repository.interface';
import { EvaluationEntity } from '../../domain/entities/evaluation.entity';

@Injectable()
export class PrismaEvaluationRepository implements IEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<EvaluationEntity | null> {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: {
        id,
        deletedAt: null, // 🔒 Soft delete
      },
    });

    if (!evaluation) return null;
    return this.toDomainEntity(evaluation);
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        EvaluationEntity,
        | 'title'
        | 'description'
        | 'weight'
        | 'maxScore'
        | 'dueDate'
        | 'isPublished'
      >
    >,
  ): Promise<EvaluationEntity> {
    const evaluation = await this.prisma.evaluation.update({
      where: { id },
      data,
    });
    return this.toDomainEntity(evaluation);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.evaluation.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });
  }

  async findByCohortId(cohortId: string): Promise<EvaluationEntity[]> {
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        cohortId,
        deletedAt: null, // 🔒 Soft delete
      },
      orderBy: { createdAt: 'asc' },
    });

    return evaluations.map((e) => this.toDomainEntity(e));
  }

  async create(
    data: Omit<
      EvaluationEntity,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'isOpen' | 'isOverdue'
    >,
  ): Promise<EvaluationEntity> {
    const evaluation = await this.prisma.evaluation.create({
      data: {
        cohortId: data.cohortId,
        title: data.title,
        description: data.description,
        weight: data.weight,
        maxScore: data.maxScore,
        dueDate: data.dueDate,
        isPublished: data.isPublished,
      },
    });
    return this.toDomainEntity(evaluation);
  }

  private toDomainEntity(
    raw: Prisma.EvaluationGetPayload<Prisma.EvaluationDefaultArgs>,
  ): EvaluationEntity {
    return new EvaluationEntity({
      id: raw.id,
      cohortId: raw.cohortId,
      title: raw.title,
      description: raw.description,
      weight: raw.weight,
      maxScore: raw.maxScore,
      dueDate: raw.dueDate,
      isPublished: raw.isPublished,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }
}
