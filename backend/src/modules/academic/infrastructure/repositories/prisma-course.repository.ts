import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ICourseRepository } from '../../domain/repositories/course.repository.interface';
import {
  CourseEntity,
  CourseLevelEnum,
} from '../../domain/entities/course.entity';

@Injectable()
export class PrismaCourseRepository implements ICourseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CourseEntity[]> {
    const courses = await this.prisma.course.findMany({
      where: { deletedAt: null },
    });
    return courses.map((c) => this.toDomain(c));
  }

  async findById(id: string): Promise<CourseEntity | null> {
    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
    });
    if (!course) return null;
    return this.toDomain(course);
  }

  async create(data: {
    code: string;
    name: string;
    description?: string;
    promotionalVideoUrl?: string;
    whatYouWillLearn?: string;
    requirements?: string;
    targetAudience?: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    durationHours: number;
  }): Promise<CourseEntity> {
    const course = await this.prisma.course.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        promotionalVideoUrl: data.promotionalVideoUrl,
        whatYouWillLearn: data.whatYouWillLearn,
        requirements: data.requirements,
        targetAudience: data.targetAudience,
        level: data.level,
        durationHours: data.durationHours,
        isPublished: true,
      },
    });
    return this.toDomain(course);
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      promotionalVideoUrl?: string;
      whatYouWillLearn?: string;
      requirements?: string;
      targetAudience?: string;
      level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
      durationHours?: number;
      imageUrl?: string | null;
    },
  ): Promise<CourseEntity> {
    const course = await this.prisma.course.update({
      where: { id },
      data,
    });
    return this.toDomain(course);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findTrash(): Promise<CourseEntity[]> {
    const courses = await this.prisma.course.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
    return courses.map((c) => this.toDomain(c));
  }

  async restore(id: string): Promise<CourseEntity> {
    const course = await this.prisma.course.update({
      where: { id },
      data: { deletedAt: null },
    });
    return this.toDomain(course);
  }

  private toDomain(raw: any): CourseEntity {
    return new CourseEntity({
      id: raw.id,
      code: raw.code,
      name: raw.name,
      description: raw.description,
      promotionalVideoUrl: raw.promotionalVideoUrl,
      whatYouWillLearn: raw.whatYouWillLearn,
      requirements: raw.requirements,
      targetAudience: raw.targetAudience,
      level: raw.level as CourseLevelEnum,
      durationHours: raw.durationHours,
      imageUrl: raw.imageUrl,
      isPublished: raw.isPublished,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }
}
