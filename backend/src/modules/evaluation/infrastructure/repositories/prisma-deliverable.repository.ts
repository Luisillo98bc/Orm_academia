// ============================================================================
// PrismaDeliverableRepository — Implementación de IDeliverableRepository
// ============================================================================

import { Injectable } from '@nestjs/common';
import { DeliverableStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IDeliverableRepository } from '../../domain/repositories/deliverable.repository.interface';
import {
  DeliverableEntity,
  DeliverableStatusEnum,
} from '../../domain/entities/deliverable.entity';

@Injectable()
export class PrismaDeliverableRepository implements IDeliverableRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<DeliverableEntity | null> {
    const deliverable = await this.prisma.deliverable.findFirst({
      where: {
        id,
        deletedAt: null, // 🔒 Soft delete
      },
    });

    if (!deliverable) return null;
    return this.toDomainEntity(deliverable);
  }

  async findByEvaluation(evaluationId: string): Promise<DeliverableEntity[]> {
    const deliverables = await this.prisma.deliverable.findMany({
      where: {
        evaluationId,
        deletedAt: null, // 🔒 Soft delete
      },
    });

    return deliverables.map((d) => this.toDomainEntity(d));
  }

  async findByEvaluationAndStudent(
    evaluationId: string,
    studentId: string,
  ): Promise<DeliverableEntity | null> {
    const deliverable = await this.prisma.deliverable.findFirst({
      where: {
        evaluationId,
        studentId,
        deletedAt: null, // 🔒 Soft delete
      },
    });

    if (!deliverable) return null;
    return this.toDomainEntity(deliverable);
  }

  async create(data: {
    evaluationId: string;
    studentId: string;
    fileUrl: string;
    fileName?: string;
    comment?: string;
    status: string;
  }): Promise<DeliverableEntity> {
    const deliverable = await this.prisma.deliverable.create({
      data: {
        evaluationId: data.evaluationId,
        studentId: data.studentId,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        comment: data.comment,
        status: data.status as DeliverableStatus,
      },
    });

    return this.toDomainEntity(deliverable);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.prisma.deliverable.update({
      where: { id },
      data: { status: status as DeliverableStatus },
    });
  }

  private toDomainEntity(
    raw: Prisma.DeliverableGetPayload<Prisma.DeliverableDefaultArgs>,
  ): DeliverableEntity {
    return new DeliverableEntity({
      id: raw.id,
      evaluationId: raw.evaluationId,
      studentId: raw.studentId,
      fileUrl: raw.fileUrl,
      fileName: raw.fileName,
      comment: raw.comment,
      status: raw.status as DeliverableStatusEnum,
      submittedAt: raw.submittedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }
}
