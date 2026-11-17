import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import type { IEnrollmentRepository } from '../../domain/repositories/enrollment.repository.interface';
import { ENROLLMENT_REPOSITORY } from '../../domain/repositories/enrollment.repository.interface';
import { EnrollStudentDto } from '../dtos/enroll-student.dto';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class EnrollStudentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepository: IEnrollmentRepository,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async execute(userId: string, dto: EnrollStudentDto) {
    if (this.prisma) {
      const student = await this.prisma.user.findFirst({
        where: {
          id: userId,
          isActive: true,
          deletedAt: null,
          roles: {
            some: {
              role: { name: 'ESTUDIANTE', isActive: true, deletedAt: null },
            },
          },
        },
        select: { id: true },
      });
      if (!student) {
        throw new BadRequestException(
          'Selecciona una cuenta activa con el rol Estudiante',
        );
      }
    }
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
