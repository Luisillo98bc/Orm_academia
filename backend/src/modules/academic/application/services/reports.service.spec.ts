import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    user: { count: jest.fn() },
    course: { count: jest.fn(), findMany: jest.fn() },
    cohort: { count: jest.fn(), findMany: jest.fn() },
    enrollment: { count: jest.fn(), findMany: jest.fn() },
    payment: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    grade: { findMany: jest.fn() },
    operatingCost: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    classAttendance: { findMany: jest.fn() },
    evaluation: { findMany: jest.fn() },
  };

  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(prisma as never);
  });

  it('calcula el resumen general y aplica el rango de fechas', async () => {
    prisma.user.count.mockResolvedValue(12);
    prisma.course.count.mockResolvedValue(4);
    prisma.cohort.count.mockResolvedValue(3);
    prisma.enrollment.count.mockResolvedValue(25);
    prisma.$queryRaw.mockResolvedValue([
      { amount: new Prisma.Decimal('1250.50') },
    ]);
    prisma.payment.count.mockResolvedValue(2);

    await expect(
      service.getSummary('2026-01-01', '2026-01-31'),
    ).resolves.toEqual({
      totalUsers: 12,
      totalCourses: 4,
      activeCohorts: 3,
      totalEnrollments: 25,
      totalRevenue: '1250.50',
      pendingPayments: 2,
    });
    expect(prisma.enrollment.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrolledAt: expect.any(Object) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('devuelve matrículas paginadas con búsqueda limpia', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{ id: 'enrollment-1' }]);
    prisma.enrollment.count.mockResolvedValue(21);

    const result = await service.getEnrollmentsReport(2, 10, '  ana  ');

    expect(result).toEqual({
      data: [{ id: 'enrollment-1' }],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('agrupa matrículas e ingresos por mes', async () => {
    const now = new Date();
    prisma.enrollment.findMany.mockResolvedValue([
      { enrolledAt: now },
      { enrolledAt: new Date(now.getFullYear(), now.getMonth(), 1) },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      {
        total: new Prisma.Decimal('100.00'),
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      },
    ]);

    const enrollments = await service.getEnrollmentsByMonth();
    const revenue = await service.getRevenueByMonth();

    expect(enrollments).toHaveLength(12);
    expect(enrollments.reduce((sum, item) => sum + item.count, 0)).toBe(2);
    expect(revenue).toHaveLength(12);
    expect(revenue.some((item) => item.total === '100.00')).toBe(true);
  });

  it('ordena cursos y calcula asistencia por cohorte', async () => {
    prisma.course.findMany.mockResolvedValue([
      {
        id: 'course-1',
        name: 'Curso 1',
        code: 'C1',
        cohorts: [{ _count: { enrollments: 2 } }],
      },
      {
        id: 'course-2',
        name: 'Curso 2',
        code: 'C2',
        cohorts: [{ _count: { enrollments: 5 } }],
      },
    ]);
    prisma.cohort.findMany.mockResolvedValue([
      {
        id: 'cohort-1',
        name: 'Cohorte 1',
        classAttendances: [{ isPresent: true }, { isPresent: false }],
        _count: { enrollments: 8 },
      },
      {
        id: 'cohort-2',
        name: 'Cohorte 2',
        classAttendances: [],
        _count: { enrollments: 0 },
      },
    ]);

    await expect(service.getCoursesRanking()).resolves.toEqual([
      { id: 'course-2', name: 'Curso 2', code: 'C2', totalEnrollments: 5 },
      { id: 'course-1', name: 'Curso 1', code: 'C1', totalEnrollments: 2 },
    ]);
    await expect(service.getAttendanceSummary()).resolves.toEqual([
      {
        id: 'cohort-1',
        name: 'Cohorte 1',
        totalStudents: 8,
        attendanceRate: 50,
      },
      {
        id: 'cohort-2',
        name: 'Cohorte 2',
        totalStudents: 0,
        attendanceRate: 0,
      },
    ]);
  });

  it('distribuye notas y métodos de pago', async () => {
    prisma.grade.findMany.mockResolvedValue([
      { score: 4 },
      { score: 8 },
      { score: 12 },
      { score: 15 },
      { score: 17 },
      { score: 20 },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { method: 'CULQI', count: 2 },
      { method: 'BANK_TRANSFER', count: 1 },
    ]);

    await expect(service.getGradesDistribution('cohort-1')).resolves.toEqual([
      { range: '0-5', count: 1 },
      { range: '6-10', count: 1 },
      { range: '11-13', count: 1 },
      { range: '14-16', count: 1 },
      { range: '17-18', count: 1 },
      { range: '19-20', count: 1 },
    ]);
    await expect(service.getPaymentMethodsDistribution()).resolves.toEqual([
      { method: 'CULQI', count: 2 },
      { method: 'BANK_TRANSFER', count: 1 },
    ]);
  });

  it('calcula rentabilidad, costos y proyección por curso', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        amount: new Prisma.Decimal('100.00'),
        courseId: 'course-1',
        course: 'Curso 1',
        enrollmentId: 'enrollment-1',
      },
    ]);
    prisma.operatingCost.findMany.mockResolvedValue([
      { amount: new Prisma.Decimal('25.00'), label: 'Hosting' },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([
      { cohort: { price: new Prisma.Decimal('120.00') } },
    ]);

    await expect(service.getFinancialProfitability()).resolves.toEqual({
      revenue: '100.00',
      costs: '25.00',
      profit: '75.00',
      margin: 75,
      projectedRevenue: '120.00',
      costsCount: 1,
      byCourse: [
        {
          courseId: 'course-1',
          course: 'Curso 1',
          revenue: '100.00',
          enrollments: 1,
        },
      ],
    });
  });

  it('gestiona costos operativos con fechas y límites seguros', async () => {
    prisma.operatingCost.findMany.mockResolvedValue([]);
    prisma.operatingCost.create.mockResolvedValue({ id: 'cost-1' });
    prisma.operatingCost.delete.mockResolvedValue({ id: 'cost-1' });

    await service.listOperatingCosts();
    await expect(
      service.createOperatingCost('admin-1', {
        label: '  Licencias  ',
        amount: 50,
        periodStart: '2026-08-01',
        notes: '  mensual  ',
      }),
    ).resolves.toEqual({ id: 'cost-1' });
    await expect(service.deleteOperatingCost('cost-1')).resolves.toEqual({
      id: 'cost-1',
    });
    expect(prisma.operatingCost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: 'Licencias',
          notes: 'mensual',
          periodEnd: null,
          courseId: null,
          cohortId: null,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('exporta pagos, alumnos, notas y asistencia en CSV', async () => {
    const date = new Date('2026-08-26T00:00:00.000Z');
    prisma.$queryRaw.mockResolvedValue([
      {
        createdAt: date,
        method: 'CULQI',
        amount: new Prisma.Decimal('100.00'),
        status: 'COMPLETED',
        validatedAt: date,
        rejectedAt: null,
        enrollment: {
          user: { firstName: 'Ana', lastName: 'Prueba', email: 'ana@test.com' },
          cohort: { name: 'Cohorte', course: { name: 'Curso' } },
        },
      },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([
      {
        enrolledAt: date,
        status: 'ACTIVE',
        user: {
          id: 'student-1',
          firstName: 'Ana',
          lastName: 'Prueba',
          email: 'ana@test.com',
        },
        payment: {
          method: 'CULQI',
          amount: new Prisma.Decimal('100.00'),
          status: 'COMPLETED',
        },
      },
    ]);
    prisma.evaluation.findMany.mockResolvedValue([
      { id: 'evaluation-1', title: 'Tarea', weight: 50, maxScore: 20 },
    ]);
    prisma.grade.findMany.mockResolvedValue([
      {
        score: 18,
        deliverable: { studentId: 'student-1', evaluationId: 'evaluation-1' },
      },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([
      {
        date,
        isPresent: true,
        isExcused: false,
        observation: 'A tiempo',
        student: {
          firstName: 'Ana',
          lastName: 'Prueba',
          email: 'ana@test.com',
        },
        session: { title: 'Clase 1', module: { title: 'Módulo 1' } },
      },
    ]);

    const payments = await service.exportPaymentsCsv(
      '2026-08-01',
      '2026-08-31',
    );
    const students = await service.exportStudentsCsv('cohort-1');
    const grades = await service.exportGradesCsv('cohort-1');
    const attendance = await service.exportAttendanceCsv('cohort-1');

    expect(payments.startsWith('\uFEFF')).toBe(true);
    expect(payments).toContain('Ana Prueba');
    expect(payments).toContain('100.00');
    expect(students.startsWith('\uFEFF')).toBe(true);
    expect(students).toContain('ACTIVE,CULQI,100.00,COMPLETED');
    expect(grades.startsWith('\uFEFF')).toBe(true);
    expect(grades).toContain('Tarea (50%)');
    expect(grades).toContain('18.0');
    expect(attendance.startsWith('\uFEFF')).toBe(true);
    expect(attendance).toContain('Clase 1');
    expect(attendance).toContain('Sí');
  });
});
