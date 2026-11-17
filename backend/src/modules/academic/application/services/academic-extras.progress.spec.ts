import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AcademicExtrasService } from './academic-extras.service';

describe('AcademicExtrasService — progreso y seguimiento', () => {
  const prisma = {
    cohort: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    enrollment: { findMany: jest.fn(), findFirst: jest.fn() },
    material: { findFirst: jest.fn() },
    materialProgress: { upsert: jest.fn(), findMany: jest.fn() },
    syllabusModule: { findMany: jest.fn() },
    evaluation: { findMany: jest.fn() },
    classSession: { findMany: jest.fn(), findUnique: jest.fn() },
    classAttendance: { findMany: jest.fn() },
    forum: { findMany: jest.fn() },
    teacherEvaluation: { upsert: jest.fn() },
  };
  const notifications = { createNotification: jest.fn() };
  let service: AcademicExtrasService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });
    service = new AcademicExtrasService(
      prisma as never,
      notifications as never,
    );
  });

  const learningEnrollment = () => ({
    status: 'ACTIVE',
    cohort: {
      id: 'cohort-1',
      name: 'Cohorte 1',
      course: { id: 'course-1', name: 'Curso 1', imageUrl: null },
      syllabusModules: [
        {
          id: 'module-1',
          materials: [
            { id: 'material-1', progress: [{ completedAt: new Date() }] },
            { id: 'material-2', progress: [{ completedAt: new Date() }] },
          ],
          sessions: [
            {
              id: 'session-past',
              title: 'Pasada',
              date: new Date(Date.now() - 86_400_000),
              meetLink: null,
            },
            {
              id: 'session-next',
              title: 'Próxima clase',
              date: new Date(Date.now() + 86_400_000),
              meetLink: 'https://meet.test',
            },
          ],
          evaluations: [
            {
              id: 'evaluation-pending',
              title: 'Evaluación pendiente',
              dueDate: new Date(Date.now() + 2 * 86_400_000),
              deliverables: [],
            },
            {
              id: 'evaluation-done',
              title: 'Evaluación entregada',
              dueDate: new Date(Date.now() + 3 * 86_400_000),
              deliverables: [{ id: 'deliverable-1' }],
            },
          ],
        },
      ],
    },
  });

  it('evalúa docentes, consulta matrículas y actualiza progreso de materiales', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{ userId: 'student-1' }]);
    prisma.cohort.findFirst.mockResolvedValue({
      teachers: [{ id: 'teacher-1' }],
    });
    prisma.cohort.findUnique.mockResolvedValue({
      teachers: [{ id: 'teacher-1' }],
    });
    prisma.teacherEvaluation.upsert.mockResolvedValue({ id: 'evaluation-1' });
    await expect(
      service.evaluateTeacher('cohort-1', 'student-1', {
        score: 5,
        comment: 'Muy buen acompañamiento',
      }),
    ).resolves.toEqual({ id: 'evaluation-1' });

    prisma.enrollment.findMany.mockResolvedValue([{ id: 'enrollment-1' }]);
    await expect(service.getMyActiveCohorts('student-1')).resolves.toEqual([
      { id: 'enrollment-1' },
    ]);

    prisma.material.findFirst.mockResolvedValue({ id: 'material-1' });
    prisma.materialProgress.upsert.mockResolvedValue({ id: 'progress-1' });
    await expect(
      service.setMaterialProgress('student-1', 'material-1', true),
    ).resolves.toEqual({ id: 'progress-1' });
    prisma.material.findFirst.mockResolvedValue(null);
    await expect(
      service.setMaterialProgress('student-1', 'missing', false),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('construye el resumen de aprendizaje y ordena la siguiente actividad', async () => {
    prisma.enrollment.findMany.mockResolvedValue([learningEnrollment()]);

    await expect(service.getLearningOverview('student-1')).resolves.toEqual(
      expect.objectContaining({
        courses: [
          expect.objectContaining({
            cohortId: 'cohort-1',
            progressPercent: 75,
            completedItems: 3,
            totalItems: 4,
            continueModuleId: 'module-1',
          }),
        ],
        nextClass: expect.objectContaining({
          id: 'session-next',
        }) as jest.AsymmetricMatcher,
        pendingEvaluations: [
          expect.objectContaining({ id: 'evaluation-pending' }),
        ],
      }),
    );
  });

  it('calcula engagement, puntos, insignias y actividad siguiente', async () => {
    prisma.enrollment.findMany.mockResolvedValue([learningEnrollment()]);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    prisma.materialProgress.findMany.mockResolvedValue(
      [today, yesterday, twoDaysAgo, today, yesterday].map((updatedAt) => ({
        updatedAt,
      })),
    );
    prisma.classAttendance.findMany.mockResolvedValue([
      { isPresent: true, isExcused: false },
      { isPresent: false, isExcused: true },
    ]);

    await expect(service.getStudentEngagement('student-1')).resolves.toEqual(
      expect.objectContaining({
        points: 60,
        activeCourses: 1,
        badges: expect.arrayContaining([
          expect.objectContaining({ key: 'first-step' }),
          expect.objectContaining({ key: 'consistent' }),
          expect.objectContaining({ key: 'streak' }),
        ]) as jest.AsymmetricMatcher,
        nextActivity: expect.objectContaining({
          type: 'evaluation',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('consolida calendario para administración y estudiantes', async () => {
    prisma.cohort.findMany.mockResolvedValue([{ id: 'cohort-1' }]);
    prisma.enrollment.findMany.mockResolvedValue([{ cohortId: 'cohort-1' }]);
    prisma.classSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        title: 'Clase',
        date: new Date('2026-08-20'),
        meetLink: 'https://meet.test',
        module: { cohort: { name: 'Cohorte', course: { name: 'Curso' } } },
      },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      {
        id: 'evaluation-1',
        title: 'Examen',
        dueDate: new Date('2026-08-21'),
        weight: 40,
        cohort: { name: 'Cohorte', course: { name: 'Curso' } },
      },
    ]);

    await expect(
      service.getCalendarEvents('admin-1', 'ADMIN'),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'session-1', type: 'class' }),
      expect.objectContaining({ id: 'evaluation-1', type: 'evaluation' }),
    ]);
    await expect(
      service.getCalendarEvents('student-1', 'ESTUDIANTE'),
    ).resolves.toHaveLength(2);
    prisma.cohort.findMany.mockResolvedValue([{ id: 'cohort-2' }]);
    await expect(
      service.getCalendarEvents('teacher-1', 'DOCENTE'),
    ).resolves.toHaveLength(2);
    prisma.enrollment.findMany.mockResolvedValue([]);
    await expect(
      service.getCalendarEvents('empty-student', 'ESTUDIANTE'),
    ).resolves.toEqual([]);
  });

  it('calcula progreso académico, notas y asistencia', async () => {
    prisma.syllabusModule.findMany.mockResolvedValue([
      {
        id: 'module-1',
        title: 'Módulo',
        order: 1,
        materials: [
          { id: 'material-1', progress: [{ completedAt: new Date() }] },
        ],
        evaluations: [{ deliverables: [{ id: 'deliverable-1' }] }],
      },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      {
        id: 'evaluation-1',
        title: 'Examen',
        weight: 100,
        maxScore: 20,
        dueDate: null,
        deliverables: [
          { grade: { score: 18, status: 'PUBLISHED', feedback: 'Excelente' } },
        ],
      },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-08-20'),
        sessionId: 'session-1',
        isPresent: true,
        isExcused: false,
        session: { title: 'Clase', module: { title: 'Módulo' } },
      },
      {
        date: new Date('2026-08-21'),
        sessionId: 'session-2',
        isPresent: false,
        isExcused: false,
        session: null,
      },
    ]);

    await expect(
      service.getStudentProgress('student-1', 'cohort-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        modules: 1,
        completedModules: 1,
        progressPercent: 100,
        averageScore: 18,
        attendance: expect.objectContaining({
          total: 2,
          present: 1,
          rate: 50,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('detecta alumnos con bajo progreso y permite enviar recordatorios', async () => {
    prisma.cohort.findMany.mockResolvedValue([
      {
        id: 'cohort-1',
        name: 'Cohorte',
        course: { name: 'Curso' },
        teachers: [{ id: 'teacher-1' }],
        enrollments: [
          {
            user: {
              id: 'student-1',
              firstName: 'Ana',
              lastName: 'Prueba',
              email: 'ana@test.com',
            },
          },
        ],
      },
    ]);
    prisma.syllabusModule.findMany.mockResolvedValue([
      {
        id: 'module-1',
        cohortId: 'cohort-1',
        materials: [{ id: 'material-1' }],
      },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      { id: 'evaluation-1', cohortId: 'cohort-1', deliverables: [] },
    ]);
    prisma.materialProgress.findMany.mockResolvedValue([]);
    prisma.forum.findMany.mockResolvedValue([
      {
        id: 'forum-1',
        title: 'Duda',
        cohortId: 'cohort-1',
        messages: [
          { authorId: 'student-1', content: 'Ayuda', createdAt: new Date() },
        ],
      },
    ]);

    await expect(
      service.getTeacherAttention('teacher-1', ['DOCENTE']),
    ).resolves.toEqual(
      expect.objectContaining({
        totals: { lowProgress: 1, pendingForums: 1 },
        lowProgressStudents: [expect.objectContaining({ progressPercent: 0 })],
      }),
    );

    prisma.cohort.findFirst.mockResolvedValue({
      name: 'Cohorte',
      course: { name: 'Curso' },
    });
    await expect(
      service.remindLowProgressStudent({
        teacherId: 'teacher-1',
        studentId: 'student-1',
        cohortId: 'cohort-1',
      }),
    ).resolves.toEqual({ sent: true });
    expect(notifications.createNotification).toHaveBeenCalled();

    prisma.cohort.findFirst.mockResolvedValue(null);
    await expect(
      service.remindLowProgressStudent({
        teacherId: 'teacher-1',
        studentId: 'student-1',
        cohortId: 'missing',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cubre accesos docentes, cohortes vacías y recordatorios sin servicio', async () => {
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
    });
    await expect(
      service.assertCohortViewAccess('cohort-1', {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).resolves.toBeUndefined();
    prisma.cohort.findMany.mockResolvedValue([]);
    await expect(
      service.getTeacherAttention('teacher-1', ['DOCENTE']),
    ).resolves.toEqual({
      lowProgressStudents: [],
      pendingForums: [],
      totals: { lowProgress: 0, pendingForums: 0 },
    });

    prisma.cohort.findFirst.mockResolvedValue({
      name: 'Cohorte',
      course: { name: 'Curso' },
    });
    const withoutNotifications = new AcademicExtrasService(prisma as never);
    await expect(
      withoutNotifications.remindLowProgressStudent({
        teacherId: 'teacher-1',
        studentId: 'student-1',
        cohortId: 'cohort-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calcula engagement cuando no hay evaluaciones pendientes y hay una brecha', async () => {
    const enrollment = learningEnrollment();
    enrollment.cohort.syllabusModules[0].materials[0].progress = [];
    enrollment.cohort.syllabusModules[0].evaluations = [
      {
        id: 'evaluation-done',
        title: 'Evaluación entregada',
        dueDate: new Date(Date.now() + 86_400_000),
        deliverables: [{ id: 'deliverable-1' }],
      },
    ];
    prisma.enrollment.findMany.mockResolvedValue([enrollment]);
    prisma.materialProgress.findMany.mockResolvedValue([
      { updatedAt: new Date() },
      { updatedAt: new Date('2020-01-01T00:00:00.000Z') },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([]);

    await expect(service.getStudentEngagement('student-1')).resolves.toEqual(
      expect.objectContaining({
        streak: 1,
        nextActivity: expect.objectContaining({
          type: 'course',
        }) as jest.AsymmetricMatcher,
      }),
    );
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    prisma.materialProgress.findMany.mockResolvedValue([
      { updatedAt: yesterday },
    ]);
    await expect(service.getStudentEngagement('student-1')).resolves.toEqual(
      expect.objectContaining({ streak: 1 }),
    );
  });

  it('cubre fechas inválidas, asistencia docente y orden de alertas', async () => {
    prisma.cohort.findUnique.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
    });
    prisma.enrollment.findMany.mockResolvedValue([
      { user: { id: 'student-1' } },
    ]);
    await expect(
      service.getCohortStudents('cohort-1', {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).resolves.toEqual([{ id: 'student-1' }]);

    await expect(
      service.getAttendance('cohort-1', 'not-a-date', 'session-1', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getAttendance('cohort-1', '2026-02-30', 'session-1', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-1',
      date: new Date('2026-08-26T00:00:00.000Z'),
      module: { cohortId: 'cohort-1' },
    });
    prisma.classAttendance.findMany.mockResolvedValue([]);
    await expect(
      service.getAttendance('cohort-1', '2026-08-26', 'session-1', {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).resolves.toEqual([]);

    prisma.cohort.findMany.mockResolvedValue([
      {
        id: 'cohort-1',
        name: 'Cohorte',
        course: { name: 'Curso' },
        teachers: [{ id: 'teacher-1' }],
        enrollments: [
          {
            user: {
              id: 'student-1',
              firstName: 'Ana',
              lastName: 'A',
              email: 'a@test.com',
            },
          },
          {
            user: {
              id: 'student-2',
              firstName: 'Beto',
              lastName: 'B',
              email: 'b@test.com',
            },
          },
        ],
      },
    ]);
    prisma.syllabusModule.findMany.mockResolvedValue([
      {
        id: 'module-1',
        cohortId: 'cohort-1',
        materials: [{ id: 'material-1' }, { id: 'material-2' }],
      },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      {
        id: 'evaluation-1',
        cohortId: 'cohort-1',
        deliverables: [{ studentId: 'other' }],
      },
    ]);
    prisma.materialProgress.findMany.mockResolvedValue([
      { userId: 'student-1', materialId: 'material-1' },
    ]);
    prisma.forum.findMany.mockResolvedValue([]);
    await expect(
      service.getTeacherAttention('teacher-1', ['DOCENTE']),
    ).resolves.toMatchObject({
      totals: { lowProgress: 2 },
      lowProgressStudents: [
        expect.objectContaining({ studentId: 'student-2' }),
        expect.objectContaining({ studentId: 'student-1' }),
      ],
    });

    const sortedEnrollment = learningEnrollment();
    sortedEnrollment.cohort.syllabusModules[0].evaluations.push({
      id: 'evaluation-earlier',
      title: 'Evaluación urgente',
      dueDate: new Date(Date.now() + 86_400_000),
      deliverables: [],
    });
    prisma.enrollment.findMany.mockResolvedValue([sortedEnrollment]);
    await expect(
      service.getLearningOverview('student-1'),
    ).resolves.toMatchObject({
      pendingEvaluations: [
        expect.objectContaining({ id: 'evaluation-earlier' }),
        expect.objectContaining({ id: 'evaluation-pending' }),
      ],
    });
  });
});
