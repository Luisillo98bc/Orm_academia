import { Prisma } from '@prisma/client';
import { PrismaCourseRepository } from './prisma-course.repository';
import { PrismaCohortRepository } from './prisma-cohort.repository';
import { PrismaEnrollmentRepository } from './prisma-enrollment.repository';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

const times = {
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};
const course = (overrides: Record<string, unknown> = {}) => ({
  id: 'course-1',
  code: 'MATH-1',
  name: 'Math',
  description: 'Desc',
  promotionalVideoUrl: null,
  whatYouWillLearn: null,
  requirements: null,
  targetAudience: null,
  level: 'BEGINNER',
  durationHours: 10,
  imageUrl: null,
  isPublished: true,
  deletedAt: null,
  ...times,
  ...overrides,
});
const cohort = (overrides: Record<string, unknown> = {}) => ({
  id: 'cohort-1',
  courseId: 'course-1',
  name: 'Cohort 1',
  modality: 'ONLINE',
  schedule: 'Mon',
  googleMeetLink: null,
  price: new Prisma.Decimal('100'),
  maxStudents: 20,
  startDate: new Date('2026-02-01'),
  endDate: new Date('2026-04-01'),
  isActive: true,
  discountPercentage: null,
  discountEndsAt: null,
  imageUrl: null,
  deletedAt: null,
  course: course(),
  teachers: [
    {
      id: 'teacher-1',
      firstName: 'Ada',
      lastName: 'T',
      profilePicture: null,
      department: 'Math',
      workerProfile: { position: 'Teacher', department: 'Math' },
    },
  ],
  _count: { enrollments: 3 },
  ...times,
  ...overrides,
});
const enrollment = (overrides: Record<string, unknown> = {}) => ({
  id: 'enrollment-1',
  userId: 'student-1',
  cohortId: 'cohort-1',
  status: 'ACTIVE',
  enrolledAt: new Date('2026-01-03'),
  completedAt: null,
  deletedAt: null,
  ...times,
  ...overrides,
});

describe('Academic Prisma repositories', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      course: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cohort: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      enrollment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
  });

  it('covers course queries, mutations and trash restoration', async () => {
    const repository = new PrismaCourseRepository(
      prisma as unknown as PrismaService,
    );
    prisma.course.findMany.mockResolvedValue([course()]);
    prisma.course.findFirst
      .mockResolvedValueOnce(course())
      .mockResolvedValueOnce(null);
    prisma.course.create.mockResolvedValue(course());
    prisma.course.update.mockResolvedValue(course({ name: 'Updated' }));
    await expect(repository.findAll()).resolves.toHaveLength(1);
    await expect(repository.findPublic()).resolves.toHaveLength(1);
    await expect(repository.findById('course-1')).resolves.toMatchObject({
      name: 'Math',
    });
    await expect(repository.findById('missing')).resolves.toBeNull();
    await expect(
      repository.create({
        code: 'MATH-1',
        name: 'Math',
        level: 'BEGINNER',
        durationHours: 10,
      }),
    ).resolves.toMatchObject({ id: 'course-1' });
    await expect(
      repository.update('course-1', { name: 'Updated' }),
    ).resolves.toMatchObject({ name: 'Updated' });
    await expect(repository.softDelete('course-1')).resolves.toBeUndefined();
    await expect(repository.findTrash()).resolves.toHaveLength(1);
    await expect(repository.restore('course-1')).resolves.toMatchObject({
      id: 'course-1',
    });
  });

  it('covers cohort queries, teacher filtering, mutations and restoration', async () => {
    const repository = new PrismaCohortRepository(
      prisma as unknown as PrismaService,
    );
    prisma.cohort.findMany.mockResolvedValue([cohort()]);
    prisma.cohort.findFirst
      .mockResolvedValueOnce(cohort())
      .mockResolvedValueOnce(null);
    prisma.cohort.create.mockResolvedValue(cohort());
    prisma.cohort.update.mockResolvedValue(cohort({ name: 'Updated' }));
    await expect(repository.findAll()).resolves.toHaveLength(1);
    await expect(repository.findByTeacherId('teacher-1')).resolves.toHaveLength(
      1,
    );
    await expect(repository.findById('cohort-1')).resolves.toMatchObject({
      name: 'Cohort 1',
      price: '100.00',
    });
    await expect(repository.findById('missing')).resolves.toBeNull();
    await expect(
      repository.create({
        courseId: 'course-1',
        teacherIds: ['teacher-1'],
        name: 'Cohort 1',
        maxStudents: 20,
        startDate: new Date(),
        endDate: new Date(),
      }),
    ).resolves.toMatchObject({ id: 'cohort-1' });
    await expect(
      repository.update('cohort-1', {
        name: 'Updated',
        teacherIds: ['teacher-1'],
      }),
    ).resolves.toMatchObject({ name: 'Updated' });
    await expect(repository.softDelete('cohort-1')).resolves.toBeUndefined();
    await expect(repository.findTrash()).resolves.toHaveLength(1);
    await expect(repository.restore('cohort-1')).resolves.toMatchObject({
      id: 'cohort-1',
    });
  });

  it('covers enrollment active lookup, user lookup and creation', async () => {
    const repository = new PrismaEnrollmentRepository(
      prisma as unknown as PrismaService,
    );
    prisma.enrollment.findFirst
      .mockResolvedValueOnce(enrollment())
      .mockResolvedValueOnce(null);
    prisma.enrollment.findMany.mockResolvedValue([enrollment()]);
    prisma.enrollment.create.mockResolvedValue(enrollment());
    await expect(
      repository.findActiveByUserAndCohort('student-1', 'cohort-1'),
    ).resolves.toMatchObject({ id: 'enrollment-1' });
    await expect(
      repository.findActiveByUserAndCohort('missing', 'cohort-1'),
    ).resolves.toBeNull();
    await expect(repository.findByUserId('student-1')).resolves.toHaveLength(1);
    await expect(
      repository.create({ studentId: 'student-1', cohortId: 'cohort-1' }),
    ).resolves.toMatchObject({ id: 'enrollment-1' });
  });
});
