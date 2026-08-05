import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import type { IEnrollmentRepository } from '../../domain/repositories/enrollment.repository.interface';
import { ENROLLMENT_REPOSITORY } from '../../domain/repositories/enrollment.repository.interface';
import { EnrollStudentDto } from '../dtos/enroll-student.dto';

@Injectable()
export class EnrollStudentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepository: IEnrollmentRepository,
  ) {}

  async execute(userId: string, dto: EnrollStudentDto) {
    // Check if already enrolled
    const activeEnrollment =
      await this.enrollmentRepository.findActiveByUserAndCohort(
        userId,
        dto.cohortId,
      );

    if (activeEnrollment) {
      throw new BadRequestException(
        'El estudiante ya está matriculado en esta cohorte',
      );
    }

    return this.enrollmentRepository.create({
      studentId: userId,
      cohortId: dto.cohortId,
    });
  }
}
