import { Inject, Injectable } from '@nestjs/common';
import type { ICourseRepository } from '../../domain/repositories/course.repository.interface';
import { COURSE_REPOSITORY } from '../../domain/repositories/course.repository.interface';
import { CreateCourseDto } from '../dtos/create-course.dto';
import { CourseEntity } from '../../domain/entities/course.entity';

@Injectable()
export class ManageCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY)
    private readonly courseRepository: ICourseRepository,
  ) {}

  async createCourse(dto: CreateCourseDto): Promise<CourseEntity> {
    return this.courseRepository.create(dto);
  }

  async getAllCourses(): Promise<CourseEntity[]> {
    return this.courseRepository.findAll();
  }

  async getPublicCourses(): Promise<CourseEntity[]> {
    return this.courseRepository.findPublic();
  }

  async updateCourse(
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
      isPublished?: boolean;
    },
  ): Promise<CourseEntity> {
    return this.courseRepository.update(id, data);
  }

  async deleteCourse(id: string): Promise<void> {
    return this.courseRepository.softDelete(id);
  }

  async getTrashCourses(): Promise<CourseEntity[]> {
    return this.courseRepository.findTrash();
  }

  async restoreCourse(id: string): Promise<CourseEntity> {
    return this.courseRepository.restore(id);
  }
}
