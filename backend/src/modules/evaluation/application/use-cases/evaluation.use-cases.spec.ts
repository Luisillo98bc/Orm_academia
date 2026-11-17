import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateEvaluationUseCase } from './create-evaluation.use-case';
import { DeleteEvaluationUseCase } from './delete-evaluation.use-case';
import { GetCohortEvaluationsUseCase } from './get-cohort-evaluations.use-case';
import { GradeDeliverableUseCase } from './grade-deliverable.use-case';
import { SubmitDeliverableUseCase } from './submit-deliverable.use-case';
import { UpdateEvaluationUseCase } from './update-evaluation.use-case';
import {
  DeliverableEntity,
  DeliverableStatusEnum,
} from '../../domain/entities/deliverable.entity';
import { EvaluationEntity } from '../../domain/entities/evaluation.entity';
import {
  GradeEntity,
  GradeStatusEnum,
} from '../../domain/entities/grade.entity';
import type { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import type { NotificationsService } from '../../../communication/notifications.service';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

const dates = {
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

const evaluation = (overrides: Partial<EvaluationEntity> = {}) =>
  new EvaluationEntity({
    id: 'evaluation-1',
    cohortId: 'cohort-1',
    title: 'Project',
    description: 'Description',
    weight: 20,
    maxScore: 20,
    dueDate: new Date('2099-01-01'),
    isPublished: true,
    ...dates,
    ...overrides,
  });

const deliverable = (overrides: Partial<DeliverableEntity> = {}) =>
  new DeliverableEntity({
    id: 'deliverable-1',
    evaluationId: 'evaluation-1',
    studentId: 'student-1',
    fileUrl: 'https://repo/submission',
    fileName: 'submission',
    comment: null,
    status: DeliverableStatusEnum.PENDING,
    submittedAt: new Date('2026-01-03'),
    ...dates,
    ...overrides,
  });

const grade = (overrides: Partial<GradeEntity> = {}) =>
  new GradeEntity({
    id: 'grade-1',
    deliverableId: 'deliverable-1',
    graderId: 'teacher-1',
    score: 18,
    feedback: 'Good work',
    status: GradeStatusEnum.PUBLISHED,
    gradedAt: new Date('2026-01-04'),
    ...dates,
    ...overrides,
  });

describe('Evaluation use cases', () => {
  it('creates evaluations with defaults and converts due dates', async () => {
    const repository = { create: jest.fn().mockResolvedValue(evaluation()) };
    const useCase = new CreateEvaluationUseCase(repository as never);

    await useCase.execute(
      {
        cohortId: 'cohort-1',
        title: 'Project',
        weight: 10,
        dueDate: '2026-05-01',
      },
      'teacher-1',
    );

    expect(repository.create).toHaveBeenCalledWith({
      cohortId: 'cohort-1',
      title: 'Project',
      description: null,
      weight: 10,
      maxScore: 20,
      dueDate: new Date('2026-05-01'),
      isPublished: true,
    });
  });

  it('filters student evaluations and attaches delivery status', async () => {
    const evaluations = [
      evaluation(),
      evaluation({ id: 'draft', isPublished: false }),
    ];
    const evaluationRepository = {
      findByCohortId: jest.fn().mockResolvedValue(evaluations),
    };
    const deliverableRepository = {
      findByEvaluationAndStudent: jest.fn().mockResolvedValue(deliverable()),
      findByEvaluation: jest.fn(),
    };
    const useCase = new GetCohortEvaluationsUseCase(
      evaluationRepository as never,
      deliverableRepository as never,
    );

    const result = (await useCase.execute(
      'cohort-1',
      'student-1',
      'ESTUDIANTE',
    )) as Array<EvaluationEntity & { deliverable?: DeliverableEntity | null }>;

    expect(result).toHaveLength(1);
    expect(result[0].deliverable?.id).toBe('deliverable-1');
    expect(
      deliverableRepository.findByEvaluationAndStudent,
    ).toHaveBeenCalledWith('evaluation-1', 'student-1');
  });

  it('attaches all deliverables for staff roles', async () => {
    const evaluationRepository = {
      findByCohortId: jest.fn().mockResolvedValue([evaluation()]),
    };
    const deliverableRepository = {
      findByEvaluationAndStudent: jest.fn(),
      findByEvaluation: jest.fn().mockResolvedValue([deliverable()]),
    };
    const useCase = new GetCohortEvaluationsUseCase(
      evaluationRepository as never,
      deliverableRepository as never,
    );

    const result = (await useCase.execute(
      'cohort-1',
      'teacher-1',
      'DOCENTE',
    )) as Array<EvaluationEntity & { deliverables?: DeliverableEntity[] }>;

    expect(result[0].deliverables).toHaveLength(1);
    expect(deliverableRepository.findByEvaluation).toHaveBeenCalledWith(
      'evaluation-1',
    );
  });

  it('trims update data and delegates deletion', async () => {
    const repository = {
      update: jest.fn().mockResolvedValue(evaluation()),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    const update = new UpdateEvaluationUseCase(repository as never);
    const remove = new DeleteEvaluationUseCase(repository as never);

    await update.execute('evaluation-1', {
      title: '  New title ',
      description: '  Details  ',
    });
    await remove.execute('evaluation-1');

    expect(repository.update).toHaveBeenCalledWith('evaluation-1', {
      title: 'New title',
      description: 'Details',
    });
    expect(repository.softDelete).toHaveBeenCalledWith('evaluation-1');
  });

  it('grades a new deliverable and updates its status', async () => {
    const deliverableRepository = {
      findById: jest.fn().mockResolvedValue(deliverable()),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const gradeRepository = {
      findByDeliverableId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(grade()),
      update: jest.fn(),
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      evaluation: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const useCase = new GradeDeliverableUseCase(
      deliverableRepository as never,
      gradeRepository,
      { sendNewGradeNotification: jest.fn() } as unknown as MailService,
      prisma as unknown as PrismaService,
      { createNotification: jest.fn() } as unknown as NotificationsService,
    );

    const result = await useCase.execute({
      deliverableId: 'deliverable-1',
      graderId: 'teacher-1',
      score: 18,
      feedback: 'Good work',
    });

    expect(result).toMatchObject({
      gradeId: 'grade-1',
      isNewGrade: true,
      score: 18,
    });
    expect(gradeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: GradeStatusEnum.PUBLISHED }),
    );
    expect(deliverableRepository.updateStatus).toHaveBeenCalledWith(
      'deliverable-1',
      DeliverableStatusEnum.GRADED,
    );
  });

  it('updates existing grades and validates grading errors', async () => {
    const deliverableRepository = {
      findById: jest.fn().mockResolvedValue(deliverable()),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const gradeRepository = {
      findByDeliverableId: jest.fn().mockResolvedValue(grade()),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(grade({ score: 19 })),
    };
    const useCase = new GradeDeliverableUseCase(
      deliverableRepository as never,
      gradeRepository,
      {} as MailService,
      {
        user: { findUnique: jest.fn() },
        evaluation: { findUnique: jest.fn() },
      } as unknown as PrismaService,
      {} as NotificationsService,
    );

    await expect(
      useCase.execute({
        deliverableId: 'deliverable-1',
        graderId: 'teacher-1',
        score: 19,
      }),
    ).resolves.toMatchObject({ isNewGrade: false, score: 19 });
    await expect(
      useCase.execute({
        deliverableId: 'deliverable-1',
        graderId: 'teacher-1',
        score: 21,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    deliverableRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        deliverableId: 'missing',
        graderId: 'teacher-1',
        score: 10,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    deliverableRepository.findById.mockResolvedValue(
      deliverable({ status: DeliverableStatusEnum.GRADED }),
    );
    gradeRepository.findByDeliverableId.mockResolvedValue(null);
    await expect(
      useCase.execute({
        deliverableId: 'deliverable-1',
        graderId: 'teacher-1',
        score: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('notifies the student after grading and tolerates notification failures', async () => {
    const deliverableRepository = {
      findById: jest.fn().mockResolvedValue(deliverable()),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const gradeRepository = {
      findByDeliverableId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(grade()),
      update: jest.fn(),
    };
    const sendNewGradeNotification = jest
      .fn()
      .mockRejectedValue(new Error('mail down'));
    const createNotification = jest
      .fn()
      .mockRejectedValue(new Error('push down'));
    const useCase = new GradeDeliverableUseCase(
      deliverableRepository as never,
      gradeRepository,
      { sendNewGradeNotification } as unknown as MailService,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'student-1',
            email: 'student@example.com',
            firstName: 'Student',
          }),
        },
        evaluation: {
          findUnique: jest.fn().mockResolvedValue({ title: 'Project' }),
        },
      } as unknown as PrismaService,
      { createNotification } as unknown as NotificationsService,
    );

    await expect(
      useCase.execute({
        deliverableId: 'deliverable-1',
        graderId: 'teacher-1',
        score: 17,
      }),
    ).resolves.toMatchObject({ gradeId: 'grade-1' });

    expect(sendNewGradeNotification).toHaveBeenCalledWith(
      'student@example.com',
      'Student',
      'Project',
      17,
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1', type: 'SUCCESS' }),
    );

    const failingPrisma = {
      user: { findUnique: jest.fn().mockRejectedValue(new Error('db down')) },
      evaluation: { findUnique: jest.fn() },
    };
    const tolerantUseCase = new GradeDeliverableUseCase(
      deliverableRepository as never,
      gradeRepository,
      { sendNewGradeNotification: jest.fn() } as unknown as MailService,
      failingPrisma as unknown as PrismaService,
      { createNotification: jest.fn() } as unknown as NotificationsService,
    );

    await expect(
      tolerantUseCase.execute({
        deliverableId: 'deliverable-1',
        graderId: 'teacher-1',
        score: 16,
      }),
    ).resolves.toMatchObject({ gradeId: 'grade-1' });
  });

  it('validates duplicate submissions and creates a late submission', async () => {
    const evaluationRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(evaluation({ dueDate: new Date('2020-01-01') })),
    };
    const deliverableRepository = {
      findByEvaluationAndStudent: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(
        deliverable({
          status: DeliverableStatusEnum.LATE,
          fileUrl: 'stored',
          fileName: 'stored',
        }),
      ),
    };
    const enrollmentRepository = {
      findActiveByUserAndCohort: jest
        .fn()
        .mockResolvedValue({ id: 'enrollment-1' }),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }),
      },
      cohort: {
        findUnique: jest.fn().mockResolvedValue({
          teachers: [
            { id: 'teacher-1', email: 'teacher@example.com', firstName: 'T' },
          ],
        }),
      },
    };
    const mail = {
      sendNewDeliverableNotification: jest.fn().mockResolvedValue(undefined),
    };
    const notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new SubmitDeliverableUseCase(
      evaluationRepository as never,
      deliverableRepository as never,
      {
        upload: jest
          .fn()
          .mockResolvedValue({ url: 'stored', fileName: 'stored' }),
      } as never,
      enrollmentRepository as never,
      mail as unknown as MailService,
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    const result = await useCase.execute({
      evaluationId: 'evaluation-1',
      studentId: 'student-1',
      fileUrl: 'https://repo/submission',
      fileName: 'submission.zip',
    });

    expect(result).toMatchObject({
      deliverableId: 'deliverable-1',
      isLate: true,
      fileUrl: 'stored',
    });
    expect(mail.sendNewDeliverableNotification).toHaveBeenCalled();
    expect(notifications.createNotification).toHaveBeenCalled();

    mail.sendNewDeliverableNotification.mockRejectedValue(
      new Error('mail down'),
    );
    notifications.createNotification.mockRejectedValue(new Error('push down'));
    await expect(
      useCase.execute({
        evaluationId: 'evaluation-1',
        studentId: 'student-1',
        fileUrl: 'https://repo/second-submission',
      }),
    ).resolves.toMatchObject({ isLate: true });
    prisma.user.findUnique.mockRejectedValue(new Error('database down'));
    await expect(
      useCase.execute({
        evaluationId: 'evaluation-1',
        studentId: 'student-1',
        fileUrl: 'https://repo/third-submission',
      }),
    ).resolves.toMatchObject({ isLate: true });
  });

  it('rejects unavailable, unpublished, unregistered and duplicate submissions', async () => {
    const evaluationRepository = { findById: jest.fn() };
    const deliverableRepository = {
      findByEvaluationAndStudent: jest.fn(),
      create: jest.fn(),
    };
    const enrollmentRepository = { findActiveByUserAndCohort: jest.fn() };
    const useCase = new SubmitDeliverableUseCase(
      evaluationRepository as never,
      deliverableRepository as never,
      { upload: jest.fn() } as never,
      enrollmentRepository as never,
      {} as MailService,
      {} as PrismaService,
      {} as NotificationsService,
    );

    evaluationRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        evaluationId: 'missing',
        studentId: 'student-1',
        fileUrl: 'url',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    evaluationRepository.findById.mockResolvedValue(
      evaluation({ isPublished: false }),
    );
    await expect(
      useCase.execute({
        evaluationId: 'evaluation-1',
        studentId: 'student-1',
        fileUrl: 'url',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    evaluationRepository.findById.mockResolvedValue(evaluation());
    enrollmentRepository.findActiveByUserAndCohort.mockResolvedValue(null);
    await expect(
      useCase.execute({
        evaluationId: 'evaluation-1',
        studentId: 'student-1',
        fileUrl: 'url',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    enrollmentRepository.findActiveByUserAndCohort.mockResolvedValue({
      id: 'enrollment-1',
    });
    deliverableRepository.findByEvaluationAndStudent.mockResolvedValue(
      deliverable(),
    );
    await expect(
      useCase.execute({
        evaluationId: 'evaluation-1',
        studentId: 'student-1',
        fileUrl: 'url',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
