import { CourseEntity } from '../entities/course.entity';

export interface ICourseRepository {
  findAll(): Promise<CourseEntity[]>;
  findPublic(): Promise<CourseEntity[]>;
  findById(id: string): Promise<CourseEntity | null>;
  create(data: {
    code: string;
    name: string;
    description?: string;
    promotionalVideoUrl?: string;
    whatYouWillLearn?: string;
    requirements?: string;
    targetAudience?: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    durationHours: number;
  }): Promise<CourseEntity>;

  update(
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
  ): Promise<CourseEntity>;

  softDelete(id: string): Promise<void>;
  findTrash(): Promise<CourseEntity[]>;
  restore(id: string): Promise<CourseEntity>;
}

export const COURSE_REPOSITORY = Symbol('ICourseRepository');
