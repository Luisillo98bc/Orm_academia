import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ICohortRepository } from '../../domain/repositories/cohort.repository.interface';
import { CohortEntity } from '../../domain/entities/cohort.entity';
import { moneyToString } from '../../../../shared/utils/money';

@Injectable()
export class PrismaCohortRepository implements ICohortRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CohortEntity[]> {
    const cohorts = await this.prisma.cohort.findMany({
      where: { deletedAt: null },
      include: {
        course: true,
        teachers: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });
    return cohorts.map((c) => this.toDomain(c));
  }

  async findById(id: string): Promise<CohortEntity | null> {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, deletedAt: null },
      include: {
        course: true,
        teachers: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });
    if (!cohort) return null;
    return this.toDomain(cohort);
  }

  async create(data: {
    courseId: string;
    teacherIds: string[];
    name: string;
    price?: string;
    maxStudents: number;
    startDate: Date;
    endDate: Date;
    discountPercentage?: number;
    discountEndsAt?: Date;
    imageUrl?: string;
  }): Promise<CohortEntity> {
    const cohort = await this.prisma.cohort.create({
      data: {
        courseId: data.courseId,
        teachers: {
          connect: data.teacherIds.map((id) => ({ id })),
        },
        name: data.name,
        price: data.price ?? '0.00',
        maxStudents: data.maxStudents,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: true,
        discountPercentage: data.discountPercentage,
        discountEndsAt: data.discountEndsAt,
        imageUrl: data.imageUrl,
      } as any,
      include: {
        course: true,
        teachers: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });
    return this.toDomain(cohort);
  }

  async update(
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
    const cohort = await this.prisma.cohort.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price,
        maxStudents: data.maxStudents,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive,
        discountPercentage: data.discountPercentage,
        discountEndsAt: data.discountEndsAt,
        imageUrl: data.imageUrl,
        ...(data.teacherIds && {
          teachers: {
            set: data.teacherIds.map((id) => ({ id })),
          },
        }),
      } as any,
      include: {
        course: true,
        teachers: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });
    return this.toDomain(cohort);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.cohort.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findTrash(): Promise<CohortEntity[]> {
    const cohorts = await this.prisma.cohort.findMany({
      where: { deletedAt: { not: null } },
      include: {
        course: true,
        teachers: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
    return cohorts.map((c) => this.toDomain(c));
  }

  async restore(id: string): Promise<CohortEntity> {
    const cohort = await this.prisma.cohort.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        course: true,
        teachers: true,
        _count: { select: { enrollments: true } },
      },
    });
    return this.toDomain(cohort);
  }

  private toDomain(raw: any): CohortEntity {
    return new CohortEntity({
      id: raw.id,
      courseId: raw.courseId,
      teacherIds: raw.teachers?.map((t: any) => t.id) || [],
      name: raw.name,
      googleMeetLink: raw.googleMeetLink,
      price: moneyToString(raw.price),
      maxStudents: raw.maxStudents,
      startDate: raw.startDate,
      endDate: raw.endDate,
      isActive: raw.isActive,
      discountPercentage: raw.discountPercentage,
      discountEndsAt: raw.discountEndsAt,
      imageUrl: raw.imageUrl,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
      courseName: raw.course?.name,
      course: raw.course,
      teachers: raw.teachers?.map((t: any) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
      })),
      enrollmentCount: raw._count?.enrollments ?? 0,
    });
  }
}
