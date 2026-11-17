import { ReportsController } from './reports.controller';
import type { ReportsService } from '../../application/services/reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      getSummary: jest.fn().mockResolvedValue({}),
      getEnrollmentsReport: jest.fn().mockResolvedValue({}),
      getEnrollmentsByMonth: jest.fn().mockResolvedValue([]),
      getRevenueByMonth: jest.fn().mockResolvedValue([]),
      getCoursesRanking: jest.fn().mockResolvedValue([]),
      getAttendanceSummary: jest.fn().mockResolvedValue([]),
      getGradesDistribution: jest.fn().mockResolvedValue([]),
      getPaymentMethodsDistribution: jest.fn().mockResolvedValue([]),
      getFinancialProfitability: jest.fn().mockResolvedValue({}),
      listOperatingCosts: jest.fn().mockResolvedValue([]),
      createOperatingCost: jest.fn().mockResolvedValue({}),
      deleteOperatingCost: jest.fn().mockResolvedValue(undefined),
      exportStudentsCsv: jest.fn().mockResolvedValue('students'),
      exportGradesCsv: jest.fn().mockResolvedValue('grades'),
      exportAttendanceCsv: jest.fn().mockResolvedValue('attendance'),
      exportPaymentsCsv: jest.fn().mockResolvedValue('payments'),
    };
    controller = new ReportsController(service as unknown as ReportsService);
  });

  it('delegates dashboard report queries', async () => {
    await controller.getSummary('2026-01-01', '2026-01-31');
    await controller.getEnrollments({ page: 2, limit: 5, search: 'Ada' });
    await controller.getEnrollmentsByMonth('start', 'end');
    await controller.getRevenueByMonth('start', 'end');
    await controller.getCoursesRanking();
    await controller.getAttendanceSummary();
    await controller.getGradesDistribution('cohort-1');
    await controller.getPaymentMethodsDistribution();
    await controller.getFinancialProfitability('start', 'end');

    expect(service.getSummary).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
    expect(service.getEnrollmentsReport).toHaveBeenCalledWith(2, 5, 'Ada');
    expect(service.getEnrollmentsByMonth).toHaveBeenCalledWith('start', 'end');
    expect(service.getRevenueByMonth).toHaveBeenCalledWith('start', 'end');
    expect(service.getCoursesRanking).toHaveBeenCalled();
    expect(service.getAttendanceSummary).toHaveBeenCalled();
    expect(service.getGradesDistribution).toHaveBeenCalledWith('cohort-1');
    expect(service.getFinancialProfitability).toHaveBeenCalledWith(
      'start',
      'end',
    );
  });

  it('delegates operating cost administration', async () => {
    await controller.listOperatingCosts();
    await controller.createOperatingCost(
      { id: 'admin-1' },
      { label: 'Hosting', amount: 100, periodStart: '2026-01-01' },
    );
    await controller.deleteOperatingCost('cost-1');

    expect(service.listOperatingCosts).toHaveBeenCalled();
    expect(service.createOperatingCost).toHaveBeenCalledWith('admin-1', {
      label: 'Hosting',
      amount: 100,
      periodStart: '2026-01-01',
    });
    expect(service.deleteOperatingCost).toHaveBeenCalledWith('cost-1');
  });

  it('writes CSV responses with BOM and download headers', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportStudents(
      'cohort-123456789',
      'start',
      'end',
      response as never,
    );
    await controller.exportGrades(
      'cohort-123456789',
      'start',
      'end',
      response as never,
    );
    await controller.exportAttendance(
      'cohort-123456789',
      'start',
      'end',
      response as never,
    );
    await controller.exportPayments('start', 'end', response as never);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=alumnos_cohort-1.csv',
    );
    expect(response.send).toHaveBeenNthCalledWith(1, '\uFEFFstudents');
    expect(response.send).toHaveBeenNthCalledWith(4, '\uFEFFpayments');
    expect(service.exportStudentsCsv).toHaveBeenCalledWith(
      'cohort-123456789',
      'start',
      'end',
    );
    expect(service.exportPaymentsCsv).toHaveBeenCalledWith('start', 'end');
  });
});
