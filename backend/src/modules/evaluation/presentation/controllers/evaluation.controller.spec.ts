import { EvaluationController } from './evaluation.controller';
import type { AcademicExtrasService } from '../../../academic/application/services/academic-extras.service';
import type { ClassroomService } from '../../application/services/classroom.service';
import type {
  CreateEvaluationUseCase,
  DeleteEvaluationUseCase,
  GetCohortEvaluationsUseCase,
  GradeDeliverableUseCase,
  SubmitDeliverableUseCase,
  UpdateEvaluationUseCase,
} from '../../application/use-cases';

describe('EvaluationController', () => {
  let controller: EvaluationController;
  let submit: Record<string, jest.Mock>;
  let grade: Record<string, jest.Mock>;
  let create: Record<string, jest.Mock>;
  let list: Record<string, jest.Mock>;
  let update: Record<string, jest.Mock>;
  let remove: Record<string, jest.Mock>;
  let academic: Record<string, jest.Mock>;
  let classroom: Record<string, jest.Mock>;
  const user = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    roles: ['DOCENTE'],
    permissions: ['evaluations:update'],
  };

  beforeEach(() => {
    submit = {
      execute: jest
        .fn()
        .mockResolvedValue({ isLate: false, id: 'deliverable-1' }),
    };
    grade = {
      execute: jest.fn().mockResolvedValue({ isNewGrade: true, id: 'grade-1' }),
    };
    create = { execute: jest.fn().mockResolvedValue({ id: 'evaluation-1' }) };
    list = { execute: jest.fn().mockResolvedValue([{ id: 'evaluation-1' }]) };
    update = { execute: jest.fn().mockResolvedValue({ id: 'evaluation-1' }) };
    remove = { execute: jest.fn().mockResolvedValue(undefined) };
    academic = {
      assertCohortManagerAccess: jest.fn().mockResolvedValue(undefined),
      assertEvaluationManagerAccess: jest.fn().mockResolvedValue(undefined),
      assertCohortViewAccess: jest.fn().mockResolvedValue(undefined),
      getCohortGradesSummary: jest.fn().mockResolvedValue({ average: 15 }),
      assertDeliverableManagerAccess: jest.fn().mockResolvedValue(undefined),
    };
    classroom = {
      list: jest
        .fn()
        .mockResolvedValue([{ id: 'evaluation-1', deliverables: [] }]),
      submit: jest
        .fn()
        .mockResolvedValue({ id: 'deliverable-1', status: 'PENDING' }),
      grade: jest.fn().mockResolvedValue({ id: 'grade-1' }),
      legacyUpdate: jest.fn().mockResolvedValue({ id: 'evaluation-1' }),
    };
    controller = new EvaluationController(
      submit as unknown as SubmitDeliverableUseCase,
      grade as unknown as GradeDeliverableUseCase,
      create as unknown as CreateEvaluationUseCase,
      list as unknown as GetCohortEvaluationsUseCase,
      update as unknown as UpdateEvaluationUseCase,
      remove as unknown as DeleteEvaluationUseCase,
      academic as unknown as AcademicExtrasService,
      classroom as unknown as ClassroomService,
    );
  });

  it('creates, updates and deletes evaluations after access checks', async () => {
    await expect(
      controller.createEvaluation(
        { cohortId: 'cohort-1', title: 'Project' } as never,
        user,
      ),
    ).resolves.toMatchObject({ statusCode: 201, data: { id: 'evaluation-1' } });
    await expect(
      controller.updateEvaluation(
        'evaluation-1',
        { title: 'Updated', dueDate: '2026-05-01' },
        user,
      ),
    ).resolves.toMatchObject({ statusCode: 200 });
    await expect(
      controller.deleteEvaluation('evaluation-1', user),
    ).resolves.toMatchObject({ statusCode: 200 });

    expect(create.execute).toHaveBeenCalledWith(
      expect.objectContaining({ cohortId: 'cohort-1' }),
      'teacher-1',
    );
    expect(classroom.legacyUpdate).toHaveBeenCalledWith(
      'evaluation-1',
      expect.objectContaining({
        title: 'Updated',
        dueDate: new Date('2026-05-01'),
      }),
      user,
    );
    expect(remove.execute).toHaveBeenCalledWith('evaluation-1');
  });

  it('gets evaluations and grade summaries after view access', async () => {
    await expect(
      controller.getCohortEvaluations('cohort-1', user),
    ).resolves.toMatchObject({
      statusCode: 200,
      data: [{ id: 'evaluation-1', deliverables: [] }],
    });
    await expect(
      controller.getCohortGradesSummary('cohort-1', user),
    ).resolves.toEqual({ average: 15 });
    expect(classroom.list).toHaveBeenCalledWith('cohort-1', user);
    expect(academic.assertCohortViewAccess).toHaveBeenCalledWith(
      'cohort-1',
      user,
    );
  });

  it('submits on-time and late deliveries with appropriate messages', async () => {
    await expect(
      controller.submitDeliverable(
        {
          evaluationId: 'evaluation-1',
          fileUrl: 'url',
          fileName: 'submission',
        },
        { ...user, roles: ['ESTUDIANTE'] },
      ),
    ).resolves.toMatchObject({
      statusCode: 201,
      message: 'Entrega registrada exitosamente.',
    });
    classroom.submit.mockResolvedValue({ status: 'LATE', id: 'deliverable-2' });
    await expect(
      controller.submitDeliverable(
        { evaluationId: 'evaluation-1', fileUrl: 'url' },
        {
          ...user,
          roles: ['ESTUDIANTE'],
        },
      ),
    ).resolves.toMatchObject({
      message: expect.stringContaining('retraso') as jest.AsymmetricMatcher,
    });
    expect(classroom.submit).toHaveBeenCalledWith(
      'evaluation-1',
      expect.objectContaining({ fileUrl: 'url' }),
      expect.objectContaining({ roles: ['ESTUDIANTE'] }),
    );
  });

  it('grades new and existing deliveries after manager access', async () => {
    await expect(
      controller.gradeDeliverable(
        { deliverableId: 'deliverable-1', score: 18 },
        user,
      ),
    ).resolves.toMatchObject({
      statusCode: 200,
      message: 'Calificación publicada exitosamente.',
    });
    grade.execute.mockResolvedValue({ isNewGrade: false, id: 'grade-1' });
    await expect(
      controller.gradeDeliverable(
        { deliverableId: 'deliverable-1', score: 19 },
        user,
      ),
    ).resolves.toMatchObject({
      message: 'Calificación publicada exitosamente.',
    });
    expect(classroom.grade).toHaveBeenCalledWith(
      'deliverable-1',
      expect.objectContaining({ score: 19 }),
      user,
    );
  });
});
