import { Prisma } from '@prisma/client';
import { AcademicMetricsService } from './academic-metrics.service';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

function createPrismaMock() {
  return {
    $queryRaw: jest.fn(),
    course: { count: jest.fn(), findMany: jest.fn() },
    cohort: { count: jest.fn(), findMany: jest.fn() },
    enrollment: { count: jest.fn(), findMany: jest.fn() },
    certificate: { count: jest.fn() },
    payment: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    user: { count: jest.fn() },
  };
}

describe('AcademicMetricsService', () => {
  let service: AcademicMetricsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AcademicMetricsService(prisma as unknown as PrismaService);
  });

  it('returns public statistics from published active records', async () => {
    prisma.course.count.mockResolvedValue(4);
    prisma.cohort.count.mockResolvedValue(3);
    prisma.enrollment.count.mockResolvedValue(40);
    prisma.certificate.count.mockResolvedValue(12);

    await expect(service.getPublicStats()).resolves.toEqual({
      courses: 4,
      cohorts: 3,
      students: 40,
      certificates: 12,
    });
    expect(prisma.course.count).toHaveBeenCalledWith({
      where: { isPublished: true, deletedAt: null },
    });
  });

  it('builds dashboard metrics and monthly revenue', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { amount: new Prisma.Decimal('1234.5') },
    ]);
    prisma.enrollment.count.mockResolvedValue(25);
    prisma.cohort.count.mockResolvedValue(2);
    prisma.$queryRaw.mockResolvedValueOnce([
      { total: new Prisma.Decimal('100.25'), month: '2026-11' },
    ]);

    const result = await service.getDashboardMetrics();

    expect(result.totalRevenue).toBe('1234.50');
    expect(result.totalStudents).toBe(25);
    expect(result.activeCohorts).toBe(2);
    expect(result.revenueByMonth).toHaveLength(6);
  });

  it('keeps six different months on the last day of a long month', async () => {
    jest.useFakeTimers({ now: new Date('2027-03-31T12:00:00Z') });
    try {
      prisma.$queryRaw.mockResolvedValueOnce([
        { amount: new Prisma.Decimal(0) },
      ]);
      prisma.$queryRaw.mockResolvedValueOnce([]);
      const metrics = await service.getDashboardMetrics();
      expect(metrics.revenueByMonth.map((row) => row.month)).toEqual([
        'Oct 26',
        'Nov 26',
        'Dic 26',
        'Ene 27',
        'Feb 27',
        'Mar 27',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('calculates data quality score and returns problematic records', async () => {
    prisma.course.findMany.mockResolvedValue([
      { id: 'course-1' },
      { id: 'course-2' },
    ]);
    prisma.cohort.findMany.mockResolvedValue([{ id: 'cohort-1' }]);
    prisma.user.count.mockResolvedValue(3);
    prisma.payment.count.mockResolvedValue(1);

    await expect(service.getDataQualitySummary()).resolves.toMatchObject({
      score: 90,
      counts: { courses: 2, cohorts: 1, users: 3, payments: 1 },
    });
  });

  it('exports students and paginates enrollments with search filters', async () => {
    prisma.enrollment.findMany
      .mockResolvedValueOnce([
        {
          id: 'enrollment-1',
          enrolledAt: new Date('2026-02-03'),
          status: 'ACTIVE',
          user: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
          },
          cohort: { name: 'Cohort 1', course: { name: 'Math' } },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'enrollment-1',
          enrolledAt: new Date('2026-02-03'),
          status: 'ACTIVE',
          user: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
          },
          cohort: { name: 'Cohort 1', course: null },
        },
      ]);
    prisma.enrollment.count.mockResolvedValue(7);

    await expect(service.getStudentsExportData()).resolves.toEqual([
      expect.objectContaining({
        Alumno: 'Ada Lovelace',
        Curso: 'Math',
        FechaInscripcion: '2026-02-03',
      }),
    ]);
    const result = await service.getEnrollmentsPage(2, 3, 'Ada');
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 3,
      total: 7,
      totalPages: 3,
    });
    expect(result.data[0]).toMatchObject({
      Alumno: 'Ada Lovelace',
      Curso: 'Desconocido',
    });
  });
});
