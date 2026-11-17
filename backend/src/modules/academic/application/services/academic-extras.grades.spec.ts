import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AcademicExtrasService } from './academic-extras.service';

describe('AcademicExtrasService — cohortes, asistencia y calificaciones', () => {
  const prisma = {
    cohort: { findUnique: jest.fn() },
    enrollment: { findMany: jest.fn(), findFirst: jest.fn() },
    syllabusModule: { create: jest.fn(), findMany: jest.fn() },
    material: { createMany: jest.fn() },
    classSession: { createMany: jest.fn(), findUnique: jest.fn() },
    evaluation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    classAttendance: { upsert: jest.fn(), findMany: jest.fn() },
    deliverable: { findUnique: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    teacherEvaluation: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: AcademicExtrasService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AcademicExtrasService(prisma as never);
  });

  it('duplica la estructura académica de una cohorte', async () => {
    prisma.cohort.findUnique.mockResolvedValueOnce({
      id: 'source-cohort',
      courseId: 'course-1',
      modality: 'ONLINE',
      schedule: 'Lunes',
      price: '100.00',
      maxStudents: 20,
      discountPercentage: 0,
      teachers: [{ id: 'teacher-1' }],
      syllabusModules: [
        {
          id: 'module-1',
          title: 'Módulo',
          description: 'Desc',
          order: 1,
          materials: [{ title: 'PDF', type: 'PDF', fileUrl: 'file.pdf' }],
          sessions: [
            {
              title: 'Clase',
              date: new Date(),
              meetLink: null,
              recordingUrl: null,
            },
          ],
          evaluations: [
            {
              title: 'Examen',
              description: null,
              weight: 100,
              maxScore: 20,
              dueDate: null,
            },
          ],
        },
      ],
    });
    const tx = {
      cohort: {
        create: jest.fn().mockResolvedValue({ id: 'new-cohort' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'new-cohort' }),
      },
      syllabusModule: {
        create: jest.fn().mockResolvedValue({ id: 'new-module' }),
      },
      material: { createMany: jest.fn() },
      classSession: { createMany: jest.fn() },
      evaluation: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      service.duplicateCohort(
        'source-cohort',
        { id: 'admin-1', roles: ['ADMIN'] },
        {
          name: '  Nueva cohorte  ',
          startDate: '2026-09-01',
          endDate: '2026-10-01',
        },
      ),
    ).resolves.toEqual({ id: 'new-cohort' });
    expect(tx.cohort.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Nueva cohorte',
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(tx.material.createMany).toHaveBeenCalled();
    expect(tx.classSession.createMany).toHaveBeenCalled();
    expect(tx.evaluation.create).toHaveBeenCalled();
  });

  it('registra asistencia individual con sesión y matrícula válidas', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-1' }]);
    prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-1',
      date: new Date('2026-08-26T00:00:00.000Z'),
      module: { cohortId: 'cohort-1' },
    });
    prisma.classAttendance.upsert.mockResolvedValue({ id: 'attendance-1' });

    await expect(
      service.markAttendance(
        'cohort-1',
        {
          studentId: 'student-1',
          sessionId: 'session-1',
          date: '2026-08-26',
          isPresent: false,
          isExcused: true,
          observation: '  Justificado  ',
        },
        { id: 'admin-1', roles: ['ADMIN'] },
      ),
    ).resolves.toEqual({ id: 'attendance-1' });
    expect(prisma.classAttendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isPresent: false,
          isExcused: true,
          observation: 'Justificado',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('resume calificaciones ponderadas y asistencia de una cohorte', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { user: { id: 'student-1', firstName: 'Ana', lastName: 'Prueba' } },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      { id: 'evaluation-1', title: 'Examen', weight: 100, maxScore: 20 },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([
      { studentId: 'student-1', isPresent: true },
      { studentId: 'student-1', isPresent: false },
    ]);
    prisma.deliverable.findMany.mockResolvedValue([
      {
        evaluationId: 'evaluation-1',
        studentId: 'student-1',
        grade: { score: 18, feedback: 'Bien', status: 'PUBLISHED' },
      },
    ]);

    await expect(
      service.getCohortGradesSummary('cohort-1', {
        id: 'admin-1',
        roles: ['ADMIN'],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        totalWeight: 100,
        studentsSummary: [
          expect.objectContaining({ finalGrade: 18, attendanceRate: 50 }),
        ],
      }),
    );
  });

  it('importa notas y crea o actualiza entregas y calificaciones', async () => {
    prisma.evaluation.findFirst.mockResolvedValue({
      id: 'evaluation-1',
      title: 'Examen',
      maxScore: 20,
    });
    prisma.user.findMany.mockResolvedValue([
      { id: 'student-1', email: 'student@test.com' },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-1' }]);
    const tx = {
      deliverable: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'deliverable-1', grade: null }),
        update: jest.fn(),
      },
      grade: { create: jest.fn(), update: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      service.importGrades(
        'cohort-1',
        'evaluation-1',
        [{ studentEmail: ' STUDENT@TEST.COM ', score: 18, feedback: 'Bien' }],
        { id: 'teacher-1', roles: ['ADMIN'] },
      ),
    ).resolves.toEqual({
      imported: 1,
      evaluation: { id: 'evaluation-1', title: 'Examen' },
    });
    expect(tx.deliverable.create).toHaveBeenCalled();
    expect(tx.grade.create).toHaveBeenCalled();

    await expect(
      service.importGrades(
        'cohort-1',
        'evaluation-1',
        [{ studentEmail: '', score: 30 }],
        { id: 'admin-1', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cubre estados pendientes, validaciones masivas y actualización de notas', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { user: { id: 'student-1', firstName: 'Ana', lastName: 'Prueba' } },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      { id: 'evaluation-1', title: 'Examen', weight: 50, maxScore: 20 },
      { id: 'evaluation-2', title: 'Tarea', weight: 50, maxScore: 20 },
    ]);
    prisma.deliverable.findMany.mockResolvedValue([
      { evaluationId: 'evaluation-1', studentId: 'student-1', grade: null },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([]);
    await expect(
      service.getCohortGradesSummary('cohort-1', {
        id: 'admin-1',
        roles: ['ADMIN'],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        studentsSummary: [
          expect.objectContaining({
            gradesMap: {
              'evaluation-1': expect.objectContaining({
                status: 'PENDING_GRADE',
              }) as jest.AsymmetricMatcher,
              'evaluation-2': expect.objectContaining({
                status: 'NOT_SUBMITTED',
              }) as jest.AsymmetricMatcher,
            },
            attendanceRate: 100,
          }),
        ],
      }),
    );

    await expect(
      service.importGrades('cohort-1', 'evaluation-1', [], {
        id: 'teacher-1',
        roles: ['ADMIN'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.evaluation.findFirst.mockResolvedValue({
      id: 'evaluation-1',
      title: 'Examen',
      maxScore: 20,
    });
    prisma.user.findMany.mockResolvedValue([
      { id: 'student-1', email: 'student@test.com' },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-1' }]);
    await expect(
      service.importGrades(
        'cohort-1',
        'evaluation-1',
        [
          { studentEmail: 'student@test.com', score: 10 },
          { studentEmail: 'STUDENT@TEST.COM', score: 11 },
        ],
        { id: 'teacher-1', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.enrollment.findMany.mockResolvedValue([]);
    await expect(
      service.importGrades(
        'cohort-1',
        'evaluation-1',
        [{ studentEmail: 'student@test.com', score: 10 }],
        { id: 'teacher-1', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.importGrades(
        'cohort-1',
        'evaluation-1',
        Array.from({ length: 501 }, () => ({
          studentEmail: 'student@test.com',
          score: 10,
        })),
        {
          id: 'teacher-1',
          roles: ['ADMIN'],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.evaluation.findFirst.mockResolvedValue(null);
    await expect(
      service.importGrades(
        'cohort-1',
        'missing',
        [{ studentEmail: 'student@test.com', score: 10 }],
        { id: 'teacher-1', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.evaluation.findFirst.mockResolvedValue({
      id: 'evaluation-1',
      title: 'Examen',
      maxScore: 20,
    });
    prisma.user.findMany.mockResolvedValue([
      { id: 'student-1', email: 'student@test.com' },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-1' }]);
    const tx = {
      deliverable: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'deliverable-1',
          grade: { id: 'grade-1' },
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'deliverable-1',
          grade: { id: 'grade-1' },
        }),
      },
      grade: { create: jest.fn(), update: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    await expect(
      service.importGrades(
        'cohort-1',
        'evaluation-1',
        [{ studentEmail: 'student@test.com', score: 19 }],
        { id: 'teacher-1', roles: ['ADMIN'] },
      ),
    ).resolves.toMatchObject({ imported: 1 });
    expect(tx.grade.update).toHaveBeenCalled();

    prisma.cohort.findUnique.mockResolvedValue(null);
    await expect(
      service.evaluateTeacher('cohort-1', 'student-1', { score: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
