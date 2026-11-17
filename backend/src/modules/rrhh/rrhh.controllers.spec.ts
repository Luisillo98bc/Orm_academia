import { RrhhController } from './rrhh.controller';
import { RrhhContractController } from './rrhh-contract.controller';
import type { RrhhService } from './rrhh.service';

describe('RRHH controllers', () => {
  let service: Record<string, jest.Mock>;
  let controller: RrhhController;
  let contracts: RrhhContractController;
  const request = { user: { id: 'worker-1', roles: ['DOCENTE'] } } as never;

  beforeEach(() => {
    service = {
      getDashboardStats: jest.fn().mockResolvedValue({}),
      findAllWorkers: jest.fn().mockResolvedValue([]),
      createWorker: jest.fn().mockResolvedValue({ id: 'worker-1' }),
      getAvailableUsers: jest.fn().mockResolvedValue([]),
      findWorkerById: jest.fn().mockResolvedValue({ id: 'worker-1' }),
      createContract: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      findAllPayrolls: jest.fn().mockResolvedValue([]),
      generatePayroll: jest.fn().mockResolvedValue([]),
      payPayroll: jest.fn().mockResolvedValue({ id: 'payroll-1' }),
      exportPayrollCsv: jest.fn().mockResolvedValue('csv'),
      getDailyAttendance: jest.fn().mockResolvedValue([]),
      markAttendance: jest.fn().mockResolvedValue({}),
      findAllContracts: jest.fn().mockResolvedValue([]),
      findMyContracts: jest.fn().mockResolvedValue([]),
      sendContract: jest.fn().mockResolvedValue({}),
      signContract: jest.fn().mockResolvedValue({}),
      rejectContract: jest.fn().mockResolvedValue({}),
      approveContract: jest.fn().mockResolvedValue({}),
      generateContractPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    controller = new RrhhController(service as unknown as RrhhService);
    contracts = new RrhhContractController(service as unknown as RrhhService);
  });

  it('delegates worker, payroll and attendance operations', async () => {
    await controller.getDashboardStats();
    await controller.findAllWorkers({ search: 'Ada' } as never);
    await controller.createWorker({ firstName: 'Ada' } as never);
    await controller.getAvailableUsers();
    await controller.findWorkerById('worker-1');
    await controller.createContract('worker-1', {
      startDate: '2026-01-01',
    } as never);
    await controller.findAllPayrolls({ page: 2, limit: 10, period: '2026-01' });
    await controller.generatePayroll('2026-01');
    await controller.payPayroll('payroll-1');
    await controller.getDailyAttendance('2026-01-01');
    await controller.getDailyAttendance();
    await controller.markAttendance({
      workerId: 'worker-1',
      date: '2026-01-01',
      status: 'PRESENT',
    });
    expect(service.findAllPayrolls).toHaveBeenCalledWith(
      2,
      10,
      '2026-01',
      undefined,
    );
    expect(service.getDailyAttendance).toHaveBeenCalledWith(expect.any(String));
  });

  it('exports payroll as CSV', async () => {
    const response = { setHeader: jest.fn(), send: jest.fn() };
    await controller.exportPayroll(response as never);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=nominas.csv',
    );
    expect(response.send).toHaveBeenCalledWith('\uFEFFcsv');
  });

  it('delegates contract operations and PDF responses', async () => {
    await contracts.findAll({ page: 1, limit: 10, status: 'PENDING' } as never);
    await contracts.findMine(request, { page: 1, limit: 10 });
    await contracts.send('contract-1', request);
    await contracts.sign('contract-1', { signatureName: 'Ada' }, request);
    await contracts.reject('contract-1', { reason: 'Correction' }, request);
    await contracts.approve('contract-1', request);
    const response = { set: jest.fn(), end: jest.fn() };
    await contracts.pdf('contract-1', request, response as never);
    expect(service.signContract).toHaveBeenCalledWith(
      'contract-1',
      'worker-1',
      'Ada',
    );
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/pdf' }),
    );
    expect(response.end).toHaveBeenCalledWith(Buffer.from('pdf'));
  });
});
