import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicExtrasService } from './academic-extras.service';

describe('AcademicExtrasService access and cohort duplication', () => {
  const prisma = {
    cohort: { findUnique: jest.fn() },
    deliverable: { findUnique: jest.fn() },
    evaluation: { findFirst: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    syllabusModule: { findMany: jest.fn() },
    material: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('checks manager/view access for administrators, teachers and students', async () => {
    const service = new AcademicExtrasService(prisma as never);
    await expect(
      service.assertCohortManagerAccess('cohort-1', {
        id: 'admin',
        roles: ['ADMIN'],
      }),
    ).resolves.toBeUndefined();
    prisma.cohort.findUnique.mockResolvedValue(null);
    await expect(
      service.assertCohortManagerAccess('missing', {
        id: 'teacher',
        roles: ['DOCENTE'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'other' }],
    });
    await expect(
      service.assertCohortManagerAccess('cohort-1', {
        id: 'teacher',
        roles: ['DOCENTE'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher' }],
    });
    await expect(
      service.assertCohortManagerAccess('cohort-1', {
        id: 'teacher',
        roles: ['DOCENTE'],
      }),
    ).resolves.toBeUndefined();

    prisma.deliverable.findUnique.mockResolvedValue(null);
    await expect(
      service.assertDeliverableManagerAccess('missing', {
        id: 'admin',
        roles: ['ADMIN'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.deliverable.findUnique.mockResolvedValue({
      evaluation: { cohortId: 'cohort-1' },
    });
    await expect(
      service.assertDeliverableManagerAccess('deliverable-1', {
        id: 'admin',
        roles: ['ADMIN'],
      }),
    ).resolves.toBeUndefined();
    prisma.evaluation.findFirst.mockResolvedValue(null);
    await expect(
      service.assertEvaluationManagerAccess('missing', {
        id: 'admin',
        roles: ['ADMIN'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.evaluation.findFirst.mockResolvedValue({ cohortId: 'cohort-1' });
    await expect(
      service.assertEvaluationManagerAccess('evaluation-1', {
        id: 'admin',
        roles: ['ADMIN'],
      }),
    ).resolves.toBeUndefined();

    await expect(
      service.assertCohortViewAccess('cohort-1', {
        id: 'admin',
        roles: ['RRHH'],
      }),
    ).resolves.toBeUndefined();
    prisma.enrollment.findFirst.mockResolvedValue(null);
    await expect(
      service.assertCohortViewAccess('cohort-1', {
        id: 'student',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });
    await expect(
      service.assertCohortViewAccess('cohort-1', {
        id: 'student',
        roles: ['ESTUDIANTE'],
      }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertCohortViewAccess('cohort-1', { id: 'unknown', roles: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('duplicates a cohort with modules and nested resources', async () => {
    const source = {
      id: 'source-1',
      courseId: 'course-1',
      modality: 'ONLINE',
      schedule: 'Morning',
      price: '100',
      maxStudents: 20,
      discountPercentage: 5,
      teachers: [{ id: 'teacher-1' }],
      syllabusModules: [
        {
          id: 'module-1',
          title: 'Module',
          description: 'Description',
          order: 1,
          materials: [{ title: 'PDF', type: 'PDF', fileUrl: 'file.pdf' }],
          sessions: [
            {
              title: 'Class',
              date: new Date(),
              meetLink: null,
              recordingUrl: null,
            },
          ],
          evaluations: [
            {
              title: 'Exam',
              description: 'Exam',
              weight: 1,
              maxScore: 20,
              dueDate: new Date(),
            },
          ],
        },
      ],
    };
    prisma.cohort.findUnique.mockResolvedValue(source);
    const tx = {
      cohort: {
        create: jest.fn().mockResolvedValue({ id: 'new-cohort' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'new-cohort' }),
      },
      syllabusModule: {
        create: jest.fn().mockResolvedValue({ id: 'new-module' }),
      },
      material: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      classSession: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      evaluation: {
        create: jest.fn().mockResolvedValue({ id: 'new-evaluation' }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: typeof tx) => unknown) => callback(tx),
    );
    const service = new AcademicExtrasService(prisma as never);
    await expect(
      service.duplicateCohort(
        'source-1',
        { id: 'admin', roles: ['ADMIN'] },
        {
          name: ' New Cohort ',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      ),
    ).resolves.toEqual({ id: 'new-cohort' });
    expect(tx.material.createMany).toHaveBeenCalled();
    expect(tx.classSession.createMany).toHaveBeenCalled();
    expect(tx.evaluation.create).toHaveBeenCalled();
    await expect(
      service.duplicateCohort(
        'source-1',
        { id: 'admin', roles: ['ADMIN'] },
        {
          name: '',
          startDate: 'bad',
          endDate: '2026-01-01',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.cohort.findUnique.mockResolvedValue(null);
    await expect(
      service.duplicateCohort(
        'missing',
        { id: 'admin', roles: ['ADMIN'] },
        {
          name: 'Nueva cohorte',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
