import { BadRequestException } from '@nestjs/common';
import { EnrollStudentUseCase } from './enroll-student.use-case';

describe('EnrollStudentUseCase', () => {
  it('rejects an active duplicate enrollment', async () => {
    const repository = {
      findActiveByUserAndCohort: jest
        .fn()
        .mockResolvedValue({ id: 'enrollment-1' }),
      create: jest.fn(),
    };
    const useCase = new EnrollStudentUseCase(repository as never);

    await expect(
      useCase.execute('student-1', { cohortId: 'cohort-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates an enrollment for a student without an active duplicate', async () => {
    const enrollment = {
      id: 'enrollment-2',
      studentId: 'student-1',
      cohortId: 'cohort-1',
    };
    const repository = {
      findActiveByUserAndCohort: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(enrollment),
    };
    const useCase = new EnrollStudentUseCase(repository as never);

    await expect(
      useCase.execute('student-1', { cohortId: 'cohort-1' }),
    ).resolves.toEqual(enrollment);
    expect(repository.create).toHaveBeenCalledWith({
      studentId: 'student-1',
      cohortId: 'cohort-1',
    });
  });

  it('rejects when student is not active or lacks ESTUDIANTE role', async () => {
    const repository = {
      findActiveByUserAndCohort: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    };
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const useCase = new EnrollStudentUseCase(
      repository as never,
      prisma as never,
    );

    await expect(
      useCase.execute('invalid-user', { cohortId: 'cohort-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
