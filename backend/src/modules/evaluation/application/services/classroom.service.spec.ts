import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassroomService,
  quizScore,
  validateQuestions,
} from './classroom.service';

const q = { prompt: '2 + 2', options: ['3', '4'], correctIndex: 1, points: 2 };
const student = { id: 'student', roles: ['ESTUDIANTE'] };
const teacher = { id: 'teacher', roles: ['DOCENTE'] };
describe('Classroom workflows', () => {
  function setup() {
    const evaluation = {
      id: 'evaluation',
      cohortId: 'cohort',
      isPublished: true,
      kind: 'ASSIGNMENT',
      maxScore: 20,
      allowLate: true,
      allowResubmit: true,
      rubric: [],
      dueDate: null,
      quiz: [q],
      maxAttempts: 2,
      timeLimitMinutes: 10,
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      evaluation: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...evaluation,
          cohort: { teachers: [{ id: 'teacher' }] },
        }),
      },
      cohort: { count: jest.fn().mockResolvedValue(1) },
      deliverable: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'd',
          studentId: 'student',
          status: 'PENDING',
        }),
        create: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              id: 'delivery',
              ...data,
            }),
          ),
        update: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              id: 'delivery',
              ...data,
            }),
          ),
        upsert: jest.fn().mockResolvedValue({ id: 'delivery' }),
      },
      submissionRevision: { create: jest.fn().mockResolvedValue({}) },
      grade: {
        upsert: jest
          .fn()
          .mockImplementation(
            ({ create }: { create: Record<string, unknown> }) => ({
              id: 'grade',
              ...create,
            }),
          ),
        update: jest.fn().mockResolvedValue({}),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
      quizAttempt: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              id: 'attempt',
              ...data,
              submittedAt: null,
              score: null,
            }),
          ),
        findUniqueOrThrow: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              id: 'attempt',
              number: 1,
              questions: [q],
              expiresAt: new Date(),
              ...data,
            }),
          ),
        findFirstOrThrow: jest.fn().mockResolvedValue({ score: 20 }),
      },
    };
    const prisma = {
      ...tx,
      evaluation: {
        findFirst: jest
          .fn<
            Promise<
              Omit<typeof evaluation, 'dueDate'> & { dueDate: Date | null }
            >,
            []
          >()
          .mockResolvedValue(evaluation),
        findMany: jest.fn(),
      },
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enrollment' }),
      },
      deliverable: { findFirst: jest.fn() },
      quizAttempt: { findUnique: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (transaction: typeof tx) => unknown) =>
          fn(tx),
        ),
    };
    const access = {
      assertCohortManagerAccess: jest.fn().mockResolvedValue(undefined),
      assertCohortViewAccess: jest.fn().mockResolvedValue(undefined),
    };
    tx.evaluation.findUniqueOrThrow.mockImplementation(async () => ({
      ...(await prisma.evaluation.findFirst()),
      cohort: { teachers: [{ id: 'teacher' }] },
    }));
    const storage = {
      uploadFile: jest
        .fn()
        .mockResolvedValue('storage://local/deliverables/work.pdf'),
    };
    return {
      service: new ClassroomService(
        prisma as never,
        access as never,
        storage as never,
      ),
      prisma,
      tx,
      access,
      storage,
      evaluation,
    };
  }
  it('scores weighted questions, ignores unanswered items and validates choices', () => {
    expect(quizScore([q, { ...q, points: 3 }], [1, -1], 20)).toBe(8);
    expect(() => validateQuestions([{ ...q, correctIndex: 4 }])).toThrow(
      BadRequestException,
    );
    expect(() => validateQuestions([{ ...q, options: [''] }])).toThrow(
      BadRequestException,
    );
  });
  it('rejects submissions without active enrollment and without http URLs', async () => {
    const { service, prisma } = setup();
    prisma.enrollment.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.submit('evaluation', { fileUrl: 'https://example.com' }, student),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.submit('evaluation', { fileUrl: 'javascript:alert(1)' }, student),
    ).rejects.toThrow(BadRequestException);
  });
  it('enforces late submission policy', async () => {
    const { service, prisma, evaluation } = setup();
    prisma.evaluation.findFirst.mockResolvedValue({
      ...evaluation,
      allowLate: false,
      dueDate: new Date(0),
    });
    await expect(
      service.submit('evaluation', { fileUrl: 'https://example.com' }, student),
    ).rejects.toThrow(BadRequestException);
  });
  it('relee la publicación después del bloqueo y no entrega una actividad retirada', async () => {
    const { service, tx, evaluation } = setup();
    tx.evaluation.findUniqueOrThrow.mockResolvedValue({
      ...evaluation,
      isPublished: false,
      cohort: { teachers: [{ id: 'teacher' }] },
    });
    await expect(
      service.submit('evaluation', { fileUrl: 'https://example.com' }, student),
    ).rejects.toThrow(NotFoundException);
    expect(tx.deliverable.create).not.toHaveBeenCalled();
  });

  it('coordina la evaluación con bloqueo compartido y serializa por estudiante', async () => {
    const { service, tx } = setup();
    await service.submit(
      'evaluation',
      { fileUrl: 'https://example.com' },
      student,
    );
    const calls = tx.$executeRaw.mock.calls as unknown as Array<
      [TemplateStringsArray, string]
    >;
    expect(calls[0][0].join('?')).toContain('pg_advisory_xact_lock_shared');
    expect(calls[0][1]).toBe('classroom:evaluation');
    expect(calls[1][1]).toBe('classroom:evaluation:student');
  });
  it('archives previous files and grade before resubmission', async () => {
    const { service, tx } = setup();
    tx.deliverable.findUnique.mockResolvedValue({
      id: 'd',
      fileUrl: 'https://old.example.com',
      submittedAt: new Date(),
      status: 'RETURNED',
      grade: { id: 'g', score: 10 },
    });
    await service.submit(
      'evaluation',
      { fileUrl: 'https://new.example.com' },
      student,
    );
    expect(tx.submissionRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileUrl: 'https://old.example.com',
          gradeSnapshot: { id: 'g', score: 10 },
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(tx.grade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          deletedAt: expect.any(Date) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });
  it('does not overwrite a published grade without a teacher return', async () => {
    const { service, tx } = setup();
    tx.deliverable.findUnique.mockResolvedValue({
      status: 'GRADED',
      grade: { status: 'PUBLISHED' },
    });
    await expect(
      service.submit(
        'evaluation',
        { fileUrl: 'https://new.example.com' },
        student,
      ),
    ).rejects.toThrow(ConflictException);
  });
  it('keeps answer keys and draft grades out of student responses', async () => {
    const { service, prisma, evaluation } = setup();
    prisma.evaluation.findMany.mockResolvedValue([
      {
        ...evaluation,
        deliverables: [
          {
            grade: { score: 12, status: 'DRAFT' },
            revisions: [],
            status: 'PENDING',
          },
        ],
        quizAttempts: [],
      },
    ]);
    const [result] = await service.list('cohort', student);
    expect(result.questions).toBeUndefined();
    expect(result.deliverables[0].grade).toBeNull();
    expect(JSON.stringify(result)).not.toContain('correctIndex');
  });
  it('checks cohort ownership before reading activities', async () => {
    const { service, access, prisma } = setup();
    access.assertCohortViewAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.list('other', student)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.evaluation.findMany).not.toHaveBeenCalled();
  });
  it('validates rubric scores and calculates the final grade', async () => {
    const { service, prisma, evaluation, tx } = setup();
    prisma.deliverable.findFirst.mockResolvedValue({
      id: 'd',
      evaluationId: 'evaluation',
      evaluation: {
        ...evaluation,
        rubric: [
          { title: 'Code', points: 12 },
          { title: 'Tests', points: 8 },
        ],
      },
    });
    await expect(
      service.grade('d', { score: 20, rubricScores: [13, 8] }, teacher),
    ).rejects.toThrow(BadRequestException);
    await service.grade('d', { score: 20, rubricScores: [10, 6] }, teacher);
    expect(tx.grade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          score: 16,
          status: 'PUBLISHED',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });
  it('creates a timed attempt without exposing answers and resumes it', async () => {
    const { service, prisma, evaluation, tx } = setup();
    prisma.evaluation.findFirst.mockResolvedValue({
      ...evaluation,
      kind: 'QUIZ',
    });
    const result = await service.startQuiz('evaluation', student);
    expect(result.questions).toEqual([
      { prompt: q.prompt, options: q.options, points: q.points },
    ]);
    expect(result.answers).toEqual([-1]);
    tx.quizAttempt.findMany.mockResolvedValue([
      {
        id: 'same',
        questions: [q],
        answers: [1],
        number: 1,
        expiresAt: new Date(),
        submittedAt: null,
      },
    ]);
    expect((await service.startQuiz('evaluation', student)).id).toBe('same');
  });
  it('enforces attempt limits', async () => {
    const { service, prisma, evaluation, tx } = setup();
    prisma.evaluation.findFirst.mockResolvedValue({
      ...evaluation,
      kind: 'QUIZ',
      maxAttempts: 1,
    });
    tx.quizAttempt.findMany.mockResolvedValue([{ submittedAt: new Date() }]);
    await expect(service.startQuiz('evaluation', student)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('scores saved answers after expiry, ignoring a late answer change', async () => {
    const { service, prisma, tx } = setup();
    const attempt = {
      id: 'attempt',
      evaluationId: 'evaluation',
      studentId: 'student',
      questions: [q],
      answers: [-1],
      expiresAt: new Date(0),
      submittedAt: null,
      maxScore: 20,
    };
    prisma.quizAttempt.findUnique.mockResolvedValue(attempt);
    tx.quizAttempt.findUniqueOrThrow.mockResolvedValue(attempt);
    await service.answerQuiz('attempt', [1], student, true);
    expect(tx.quizAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 0,
          answers: [-1],
        }) as jest.AsymmetricMatcher,
      }),
    );
  });
  it('does not permit a student to submit another student attempt', async () => {
    const { service, prisma } = setup();
    prisma.quizAttempt.findUnique.mockResolvedValue({
      studentId: 'someone-else',
    });
    await expect(
      service.answerQuiz('attempt', [1], student, true),
    ).rejects.toThrow('Intento no encontrado');
  });
});
