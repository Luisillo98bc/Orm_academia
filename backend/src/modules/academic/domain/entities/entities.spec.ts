import {
  CohortEntity,
  CourseEntity,
  CourseLevelEnum,
  EnrollmentEntity,
  EnrollmentStatusEnum,
} from './index';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

function course(
  overrides: Partial<ConstructorParameters<typeof CourseEntity>[0]> = {},
) {
  return new CourseEntity({
    id: 'course-1',
    code: 'COURSE-1',
    name: 'Curso de prueba',
    level: CourseLevelEnum.INTERMEDIATE,
    durationHours: 20,
    isPublished: true,
    createdAt,
    updatedAt,
    ...overrides,
  });
}

function cohort(
  overrides: Partial<ConstructorParameters<typeof CohortEntity>[0]> = {},
) {
  return new CohortEntity({
    id: 'cohort-1',
    courseId: 'course-1',
    teacherIds: [],
    name: 'Cohorte de prueba',
    maxStudents: 10,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 60_000),
    isActive: true,
    createdAt,
    updatedAt,
    ...overrides,
  });
}

describe('academic domain entities', () => {
  it('determines whether a course is available', () => {
    expect(course().isAvailable).toBe(true);
    expect(course({ isPublished: false }).isAvailable).toBe(false);
    expect(course({ deletedAt: new Date() }).isAvailable).toBe(false);
  });

  it('evaluates cohort operation, progress and capacity', () => {
    expect(cohort({ enrollmentCount: 3 }).isOperational).toBe(true);
    expect(cohort({ enrollmentCount: 3 }).isInProgress).toBe(true);
    expect(cohort({ enrollmentCount: 10 }).hasCapacity).toBe(false);
    expect(cohort({ isActive: false }).isOperational).toBe(false);
    expect(cohort({ deletedAt: new Date() }).isInProgress).toBe(false);
    expect(
      cohort({ startDate: new Date(Date.now() + 120_000) }).isInProgress,
    ).toBe(false);
    expect(
      cohort({ endDate: new Date(Date.now() - 120_000) }).isInProgress,
    ).toBe(false);
  });

  it('determines whether an enrollment is active', () => {
    const base = {
      id: 'enrollment-1',
      userId: 'user-1',
      cohortId: 'cohort-1',
      enrolledAt: createdAt,
      createdAt,
      updatedAt,
    };
    expect(
      new EnrollmentEntity({ ...base, status: EnrollmentStatusEnum.ACTIVE })
        .isActive,
    ).toBe(true);
    expect(
      new EnrollmentEntity({ ...base, status: EnrollmentStatusEnum.COMPLETED })
        .isActive,
    ).toBe(false);
    expect(
      new EnrollmentEntity({
        ...base,
        status: EnrollmentStatusEnum.ACTIVE,
        deletedAt: new Date(),
      }).isActive,
    ).toBe(false);
  });
});
