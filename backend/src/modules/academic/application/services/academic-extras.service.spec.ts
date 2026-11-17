import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AcademicExtrasService } from './academic-extras.service';

describe('AcademicExtrasService — asistencia', () => {
  const prisma = {
    cohort: { findUnique: jest.fn() },
    enrollment: { findMany: jest.fn(), findFirst: jest.fn() },
    classAttendance: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    classSession: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  let service: AcademicExtrasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AcademicExtrasService(prisma as never);
  });

  it('solo devuelve alumnos con matrícula activa o completada', async () => {
    prisma.enrollment.findMany.mockResolvedValue([]);

    await service.getCohortStudents('cohort-id');

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ACTIVE', 'COMPLETED'] },
        }) as unknown,
      }),
    );
  });

  it('impide a un docente gestionar una cohorte no asignada', async () => {
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-id',
      teachers: [{ id: 'another-teacher' }],
    });

    await expect(
      service.markAttendanceBulk(
        'cohort-id',
        {
          sessionId: 'session-id',
          date: '2026-08-26',
          records: [{ studentId: 'student-id', isPresent: true }],
        },
        { id: 'teacher-id', roles: ['DOCENTE'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('impide a un docente no asignado consultar una cohorte', async () => {
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-id',
      teachers: [{ id: 'another-teacher' }],
    });

    await expect(
      service.assertCohortViewAccess('cohort-id', {
        id: 'teacher-id',
        roles: ['DOCENTE'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no permite guardar una lista sin alumnos marcados', async () => {
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-id',
      teachers: [{ id: 'teacher-id' }],
    });

    await expect(
      service.markAttendanceBulk(
        'cohort-id',
        { sessionId: 'session-id', date: '2026-08-26', records: [] },
        { id: 'teacher-id', roles: ['DOCENTE'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza registrar estudiantes sin matrícula activa', async () => {
    prisma.enrollment.findMany.mockResolvedValue([]);

    await expect(
      service.markAttendanceBulk(
        'cohort-id',
        {
          sessionId: 'session-id',
          date: '2026-08-26',
          records: [{ studentId: 'student-id', isPresent: true }],
        },
        { id: 'admin-id', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza guardar asistencia sin una sesiÃ³n programada', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-id' }]);

    await expect(
      service.markAttendanceBulk(
        'cohort-id',
        {
          sessionId: '',
          date: '2026-08-26',
          records: [{ studentId: 'student-id', isPresent: true }],
        },
        { id: 'admin-id', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mantiene separadas dos sesiones de la misma fecha', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-id' }]);
    prisma.classSession.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          date: new Date('2026-08-26T00:00:00.000Z'),
          module: { cohortId: 'cohort-id' },
        }),
    );
    prisma.$transaction.mockResolvedValue([]);

    const user = { id: 'admin-id', roles: ['ADMIN'] };
    await service.markAttendanceBulk(
      'cohort-id',
      {
        sessionId: 'morning-session',
        date: '2026-08-26',
        records: [{ studentId: 'student-id', isPresent: true }],
      },
      user,
    );
    await service.markAttendanceBulk(
      'cohort-id',
      {
        sessionId: 'afternoon-session',
        date: '2026-08-26',
        records: [{ studentId: 'student-id', isPresent: false }],
      },
      user,
    );

    expect(prisma.classAttendance.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          sessionId_studentId: {
            sessionId: 'morning-session',
            studentId: 'student-id',
          },
        },
      }),
    );
    expect(prisma.classAttendance.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          sessionId_studentId: {
            sessionId: 'afternoon-session',
            studentId: 'student-id',
          },
        },
      }),
    );
  });

  it('limita la consulta del estudiante a su propia asistencia', async () => {
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-id' });
    prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-id',
      date: new Date('2026-08-26T00:00:00.000Z'),
      module: { cohortId: 'cohort-id' },
    });
    prisma.classAttendance.findMany.mockResolvedValue([]);

    await service.getAttendance('cohort-id', '2026-08-26', 'session-id', {
      id: 'student-id',
      roles: ['ESTUDIANTE'],
    });

    expect(prisma.classAttendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cohortId: 'cohort-id',
          studentId: 'student-id',
        }) as unknown,
      }),
    );
  });

  it('rechaza fechas, sesiones y estados de asistencia inconsistentes', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-id' }]);
    await expect(
      service.markAttendance(
        'cohort-id',
        {
          studentId: 'student-id',
          sessionId: 'session-id',
          date: '2026-08-26',
          isPresent: 'yes' as never,
        },
        { id: 'admin', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.markAttendance(
        'cohort-id',
        {
          studentId: 'student-id',
          sessionId: 'session-id',
          date: 'bad',
          isPresent: true,
        },
        { id: 'admin', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.classSession.findUnique.mockResolvedValue(null);
    await expect(
      service.markAttendance(
        'cohort-id',
        {
          studentId: 'student-id',
          sessionId: 'missing',
          date: '2026-08-26',
          isPresent: true,
        },
        { id: 'admin', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.classSession.findUnique.mockResolvedValue({
      date: new Date('2026-08-27T00:00:00.000Z'),
      module: { cohortId: 'cohort-id' },
    });
    await expect(
      service.markAttendance(
        'cohort-id',
        {
          studentId: 'student-id',
          sessionId: 'session-id',
          date: '2026-08-26',
          isPresent: true,
        },
        { id: 'admin', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.markAttendanceBulk(
        'cohort-id',
        {
          sessionId: 'session-id',
          date: '2026-08-26',
          records: [
            { studentId: 'student-id', isPresent: true },
            { studentId: 'student-id', isPresent: false },
          ],
        },
        { id: 'admin', roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza consultas de asistencia sin matrícula o rol válido', async () => {
    prisma.enrollment.findFirst.mockResolvedValue(null);
    await expect(
      service.getAttendance('cohort-id', '2026-08-26', 'session-id', {
        id: 'student-id',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getAttendance('cohort-id', '2026-08-26', 'session-id', {
        id: 'guest',
        roles: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
