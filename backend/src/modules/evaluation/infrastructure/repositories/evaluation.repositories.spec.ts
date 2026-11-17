import { PrismaEvaluationRepository } from './prisma-evaluation.repository';
import { PrismaDeliverableRepository } from './prisma-deliverable.repository';
import { PrismaGradeRepository } from './prisma-grade.repository';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

const timestamps = {
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};
const evaluationRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'evaluation-1',
  cohortId: 'cohort-1',
  title: 'Project',
  description: 'Description',
  weight: 20,
  maxScore: 20,
  dueDate: new Date('2026-05-01'),
  isPublished: true,
  deletedAt: null,
  ...timestamps,
  ...overrides,
});
const deliverableRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'deliverable-1',
  evaluationId: 'evaluation-1',
  studentId: 'student-1',
  fileUrl: 'url',
  fileName: 'submission',
  comment: null,
  status: 'PENDING',
  submittedAt: new Date('2026-01-03'),
  deletedAt: null,
  ...timestamps,
  ...overrides,
});
const gradeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'grade-1',
  deliverableId: 'deliverable-1',
  graderId: 'teacher-1',
  score: 18,
  feedback: 'Good',
  status: 'PUBLISHED',
  gradedAt: new Date('2026-01-04'),
  deletedAt: null,
  ...timestamps,
  ...overrides,
});

describe('Evaluation Prisma repositories', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      evaluation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      deliverable: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      grade: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
  });

  it('persists and maps evaluations with soft delete filters', async () => {
    const repository = new PrismaEvaluationRepository(
      prisma as unknown as PrismaService,
    );
    prisma.evaluation.findFirst
      .mockResolvedValueOnce(evaluationRow())
      .mockResolvedValueOnce(null);
    prisma.evaluation.findMany.mockResolvedValue([evaluationRow()]);
    prisma.evaluation.create.mockResolvedValue(evaluationRow());
    prisma.evaluation.update.mockResolvedValue(
      evaluationRow({ title: 'Updated' }),
    );

    await expect(repository.findById('evaluation-1')).resolves.toMatchObject({
      title: 'Project',
    });
    await expect(repository.findById('missing')).resolves.toBeNull();
    await expect(repository.findByCohortId('cohort-1')).resolves.toHaveLength(
      1,
    );
    await expect(
      repository.create({
        cohortId: 'cohort-1',
        title: 'Project',
        description: null,
        weight: 20,
        maxScore: 20,
        dueDate: null,
        isPublished: true,
      }),
    ).resolves.toMatchObject({ id: 'evaluation-1' });
    await expect(
      repository.update('evaluation-1', { title: 'Updated' }),
    ).resolves.toMatchObject({ title: 'Updated' });
    await expect(
      repository.softDelete('evaluation-1'),
    ).resolves.toBeUndefined();
    expect(prisma.evaluation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          deletedAt: expect.any(Date) as jest.AsymmetricMatcher,
          isPublished: false,
        },
      }),
    );
  });

  it('persists and maps deliverables with all query variants', async () => {
    const repository = new PrismaDeliverableRepository(
      prisma as unknown as PrismaService,
    );
    prisma.deliverable.findFirst
      .mockResolvedValueOnce(deliverableRow())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(deliverableRow());
    prisma.deliverable.findMany.mockResolvedValue([deliverableRow()]);
    prisma.deliverable.create.mockResolvedValue(deliverableRow());

    await expect(repository.findById('deliverable-1')).resolves.toMatchObject({
      id: 'deliverable-1',
    });
    await expect(repository.findById('missing')).resolves.toBeNull();
    await expect(
      repository.findByEvaluation('evaluation-1'),
    ).resolves.toHaveLength(1);
    await expect(
      repository.findByEvaluationAndStudent('evaluation-1', 'student-1'),
    ).resolves.toBeNull();
    await expect(
      repository.findByEvaluationAndStudent('evaluation-1', 'student-1'),
    ).resolves.toMatchObject({ id: 'deliverable-1' });
    await expect(
      repository.create({
        evaluationId: 'evaluation-1',
        studentId: 'student-1',
        fileUrl: 'url',
        status: 'PENDING',
      }),
    ).resolves.toMatchObject({ id: 'deliverable-1' });
    await expect(
      repository.updateStatus('deliverable-1', 'GRADED'),
    ).resolves.toBeUndefined();
  });

  it('persists and maps grades, including partial updates', async () => {
    const repository = new PrismaGradeRepository(
      prisma as unknown as PrismaService,
    );
    prisma.grade.findFirst
      .mockResolvedValueOnce(gradeRow())
      .mockResolvedValueOnce(null);
    prisma.grade.create.mockResolvedValue(gradeRow());
    prisma.grade.update.mockResolvedValue(gradeRow({ score: 19 }));

    await expect(
      repository.findByDeliverableId('deliverable-1'),
    ).resolves.toMatchObject({ score: 18 });
    await expect(repository.findByDeliverableId('missing')).resolves.toBeNull();
    await expect(
      repository.create({
        deliverableId: 'deliverable-1',
        graderId: 'teacher-1',
        score: 18,
        status: 'PUBLISHED',
      }),
    ).resolves.toMatchObject({ id: 'grade-1' });
    await expect(
      repository.update('grade-1', { score: 19 }),
    ).resolves.toMatchObject({ score: 19 });
    expect(prisma.grade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 19,
          gradedAt: expect.any(Date) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });
});
