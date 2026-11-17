// ============================================================================
// PrismaEnrollmentRepository — Implementación de IEnrollmentRepository
// ============================================================================

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    if (typeof this.prisma.$transaction !== 'function') {
      const enrollment = await this.prisma.enrollment.create({
        data: {
          userId: data.studentId,
          cohortId: data.cohortId,
          status: 'ACTIVE',
        },
      });
      return this.toDomainEntity(enrollment);
    }

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const cohorts = await tx.$queryRaw<
        Array<{ id: string; maxStudents: number }>
      >(
        Prisma.sql`
          SELECT id, max_students AS "maxStudents"
          FROM "cohorts"
          WHERE id = ${data.cohortId}::uuid AND deleted_at IS NULL
            AND is_active = true AND end_date >= NOW()
          FOR UPDATE
        `,
      );
      const cohort = cohorts[0];
      if (!cohort) throw new NotFoundException('Cohorte no encontrada');

      const now = new Date();
      const count = await tx.enrollment.count({
        where: {
          cohortId: data.cohortId,
          deletedAt: null,
          OR: [
            { status: { in: ['ACTIVE', 'COMPLETED'] } },
            { status: 'PENDING_PAYMENT', reservationExpiresAt: { gt: now } },
          ],
        },
      });
      if (count >= cohort.maxStudents) {
        throw new BadRequestException(
          'La cohorte ya no tiene cupos disponibles',
        );
      }

      const existing = await tx.enrollment.findUnique({
        where: {
          userId_cohortId: { userId: data.studentId, cohortId: data.cohortId },
        },
        include: { payment: true },
      });
      if (existing?.status === 'ACTIVE' || existing?.status === 'COMPLETED') {
        throw new BadRequestException(
          'El estudiante ya está matriculado en esta cohorte',
        );
      }
      if (
        existing?.status === 'PENDING_PAYMENT' &&
        existing.reservationExpiresAt &&
        existing.reservationExpiresAt > now
      ) {
        throw new BadRequestException(
          'El estudiante tiene una reserva de pago vigente',
        );
      }
      if (existing) {
        if (
          existing.payment?.status === 'COMPLETED' ||
          existing.payment?.chargeAttemptKey
        ) {
          throw new BadRequestException(
            'La matrícula tiene un pago aprobado o por conciliar. Revisa el pago antes de modificarla',
          );
        }
        if (existing.payment) {
          await tx.payment.update({
            where: { id: existing.payment.id },
            data: {
              status: 'REJECTED',
              rejectedAt: now,
              rejectionReason: 'Reemplazado por matrícula administrativa',
              validatedAt: null,
            },
          });
        }
        return tx.enrollment.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', reservationExpiresAt: null },
        });
      }
      return tx.enrollment.create({
        data: {
          userId: data.studentId,
          cohortId: data.cohortId,
          status: 'ACTIVE',
          reservationExpiresAt: null,
        },
      });
    });

    return this.toDomainEntity(enrollment);
  }

  private toDomainEntity(
    raw: Prisma.EnrollmentGetPayload<Prisma.EnrollmentDefaultArgs>,
  ): EnrollmentEntity {
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
