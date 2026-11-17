import {
  DeliverableEntity,
  DeliverableStatusEnum,
  EvaluationEntity,
  GradeEntity,
  GradeStatusEnum,
} from './index';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

function evaluation(
  overrides: Partial<ConstructorParameters<typeof EvaluationEntity>[0]> = {},
) {
  return new EvaluationEntity({
    id: 'evaluation-1',
    cohortId: 'cohort-1',
    title: 'Evaluación de prueba',
    weight: 20,
    maxScore: 20,
    isPublished: true,
    createdAt,
    updatedAt,
    ...overrides,
  });
}

function deliverable(
  overrides: Partial<ConstructorParameters<typeof DeliverableEntity>[0]> = {},
) {
  return new DeliverableEntity({
    id: 'deliverable-1',
    evaluationId: 'evaluation-1',
    studentId: 'student-1',
    fileUrl: 'https://example.com/repo',
    status: DeliverableStatusEnum.PENDING,
    submittedAt: createdAt,
    createdAt,
    updatedAt,
    ...overrides,
  });
}

function grade(
  overrides: Partial<ConstructorParameters<typeof GradeEntity>[0]> = {},
) {
  return new GradeEntity({
    id: 'grade-1',
    deliverableId: 'deliverable-1',
    graderId: 'teacher-1',
    score: 18,
    status: GradeStatusEnum.DRAFT,
    gradedAt: createdAt,
    createdAt,
    updatedAt,
    ...overrides,
  });
}

describe('evaluation domain entities', () => {
  it('opens only published, non-deleted evaluations before their deadline', () => {
    expect(evaluation().isOpen).toBe(true);
    expect(evaluation({ isPublished: false }).isOpen).toBe(false);
    expect(evaluation({ deletedAt: new Date() }).isOpen).toBe(false);
    expect(evaluation({ dueDate: new Date(Date.now() + 60_000) }).isOpen).toBe(
      true,
    );
    expect(evaluation({ dueDate: new Date(Date.now() - 60_000) }).isOpen).toBe(
      false,
    );
  });

  it('detects overdue evaluations', () => {
    expect(evaluation().isOverdue).toBe(false);
    expect(
      evaluation({ dueDate: new Date(Date.now() + 60_000) }).isOverdue,
    ).toBe(false);
    expect(
      evaluation({ dueDate: new Date(Date.now() - 60_000) }).isOverdue,
    ).toBe(true);
  });

  it('determines which deliverables can be graded', () => {
    expect(deliverable().isGradeable).toBe(true);
    expect(
      deliverable({ status: DeliverableStatusEnum.LATE }).isGradeable,
    ).toBe(true);
    expect(
      deliverable({ status: DeliverableStatusEnum.RETURNED }).isGradeable,
    ).toBe(false);
    expect(deliverable({ deletedAt: new Date() }).isGradeable).toBe(false);
    expect(deliverable({ status: DeliverableStatusEnum.GRADED }).isGraded).toBe(
      true,
    );
    expect(deliverable().isGraded).toBe(false);
  });

  it('shows grades only after publication and while active', () => {
    expect(grade().isVisibleToStudent).toBe(false);
    expect(
      grade({ status: GradeStatusEnum.PUBLISHED }).isVisibleToStudent,
    ).toBe(true);
    expect(
      grade({ status: GradeStatusEnum.PUBLISHED, deletedAt: new Date() })
        .isVisibleToStudent,
    ).toBe(false);
  });
});
