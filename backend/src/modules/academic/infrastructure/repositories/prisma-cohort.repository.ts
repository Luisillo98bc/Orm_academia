import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ICohortRepository } from '../../domain/repositories/cohort.repository.interface';
import { CohortEntity } from '../../domain/entities/cohort.entity';
import { moneyToString } from '../../../../shared/utils/money';
import {
  CourseEntity,
  CourseLevelEnum,
} from '../../domain/entities/course.entity';

function enrollmentCountSelection() {
  const where: Prisma.EnrollmentWhereInput = {
    deletedAt: null,
    OR: [
      { status: { in: ['ACTIVE', 'COMPLETED'] } },
      { status: 'PENDING_PAYMENT', reservationExpiresAt: { gt: new Date() } },
    ],
  };
  return {
    select: {
      enrollments: { where },
    },
  } satisfies Prisma.CohortCountOutputTypeDefaultArgs;
}

@Injectable()
export class PrismaCohortRepository implements ICohortRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CohortEntity[]> {
    const cohorts = await this.prisma.cohort.findMany({
      where: { deletedAt: null },
      include: {
        course: true,
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
      },
    });
    return cohorts.map((c) => this.toDomain(c));
  }

  async findPublicOperational(now: Date = new Date()): Promise<CohortEntity[]> {
    const cohorts = await this.prisma.cohort.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        endDate: { gte: now },
        course: { isPublished: true, deletedAt: null },
      },
      include: {
        course: true,
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
      },
    });
    return cohorts.map((c) => this.toDomain(c));
  }

  async findByTeacherId(teacherId: string): Promise<CohortEntity[]> {
    const cohorts = await this.prisma.cohort.findMany({
      where: { deletedAt: null, teachers: { some: { id: teacherId } } },
      include: {
        course: true,
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
      },
    });
    return cohorts.map((c) => this.toDomain(c));
  }

  async findById(id: string): Promise<CohortEntity | null> {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, deletedAt: null },
      include: {
        course: true,
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
      },
    });
    if (!cohort) return null;
    return this.toDomain(cohort);
  }

  async create(data: {
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
  }): Promise<CohortEntity> {
    const cohort = await this.prisma.cohort.create({
      data: {
        courseId: data.courseId,
        teachers: {
          connect: data.teacherIds.map((id) => ({ id })),
        },
        name: data.name,
        modality: data.modality,
        schedule: data.schedule,
        price: data.price ?? '0.00',
        installments: data.installments
          ? Math.max(1, Number(data.installments))
          : 1,
        maxStudents: data.maxStudents,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: true,
        discountPercentage: data.discountPercentage,
        discountEndsAt: data.discountEndsAt,
        imageUrl: data.imageUrl,
      },
      include: {
        course: true,
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
      },
    });
    return this.toDomain(cohort);
  }

  async update(
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
  ): Promise<CohortEntity> {
    const cohort = await this.prisma.cohort.update({
      where: { id },
      data: {
        name: data.name,
        modality: data.modality,
        schedule: data.schedule,
        price: data.price,
        ...(data.installments !== undefined && {
          installments: Math.max(1, Number(data.installments)),
        }),
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
      },
      include: {
        course: true,
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
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
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
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
        teachers: {
          include: {
            workerProfile: { select: { position: true, department: true } },
          },
        },
        _count: enrollmentCountSelection(),
      },
    });
    return this.toDomain(cohort);
  }

  private toDomain(
    raw: Prisma.CohortGetPayload<{
      include: {
        course: true;
        teachers: {
          include: {
            workerProfile: { select: { position: true; department: true } };
          };
        };
        _count: { select: { enrollments: true } };
      };
    }>,
  ): CohortEntity {
    const course = raw.course
      ? new CourseEntity({
          id: raw.course.id,
          code: raw.course.code,
          name: raw.course.name,
          description: raw.course.description,
          promotionalVideoUrl: raw.course.promotionalVideoUrl,
          whatYouWillLearn: raw.course.whatYouWillLearn,
          requirements: raw.course.requirements,
          targetAudience: raw.course.targetAudience,
          level: raw.course.level as CourseLevelEnum,
          durationHours: raw.course.durationHours,
          imageUrl: raw.course.imageUrl,
          isPublished: raw.course.isPublished,
          createdAt: raw.course.createdAt,
          updatedAt: raw.course.updatedAt,
          deletedAt: raw.course.deletedAt,
        })
      : undefined;
    return new CohortEntity({
      id: raw.id,
      courseId: raw.courseId,
      teacherIds: raw.teachers.map((teacher) => teacher.id),
      name: raw.name,
      modality: raw.modality,
      schedule: raw.schedule,
      googleMeetLink: raw.googleMeetLink,
      price: moneyToString(raw.price),
      installments: raw.installments ?? 1,
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
      course,
      teachers: raw.teachers.map((teacher) => ({
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        profilePicture: teacher.profilePicture,
        department: teacher.department,
        position: teacher.workerProfile?.position ?? null,
      })),
      enrollmentCount: raw._count?.enrollments ?? 0,
    });
  }
}
