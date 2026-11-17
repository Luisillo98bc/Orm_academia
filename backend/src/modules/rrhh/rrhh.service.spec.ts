import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RrhhService } from './rrhh.service';
import { PrismaWorkerRepository } from './infrastructure/repositories/prisma-worker.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

type MockMethods<T extends string> = Record<T, jest.Mock>;

type WorkerRepositoryMock = MockMethods<
  | 'findAll'
  | 'findById'
  | 'createForExistingUser'
  | 'createWithUser'
  | 'createContract'
>;

type PrismaMock = {
  user: MockMethods<'findMany' | 'findFirst' | 'findUnique'>;
  role: MockMethods<'findUnique'>;
  worker: MockMethods<'findMany' | 'findFirst' | 'findUnique' | 'count'>;
  payroll: MockMethods<
    'findMany' | 'findUnique' | 'create' | 'update' | 'count' | 'aggregate'
  >;
  contract: MockMethods<
    'count' | 'findMany' | 'findFirst' | 'findUnique' | 'updateMany' | 'update'
  >;
  workAttendance: MockMethods<'findMany' | 'findUnique' | 'upsert'>;
  $transaction: jest.Mock;
};

describe('RrhhService', () => {
  let service: RrhhService;
  let workerRepo: WorkerRepositoryMock;
  let prisma: PrismaMock;

  beforeEach(() => {
    workerRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      createForExistingUser: jest.fn(),
      createWithUser: jest.fn(),
      createContract: jest.fn(),
    };
    prisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      role: { findUnique: jest.fn() },
      worker: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      payroll: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      contract: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      workAttendance: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const notifications = { createNotification: jest.fn() };
    const audit = { log: jest.fn() };
    const mail = {
      sendContractExpiryAlert: jest.fn().mockResolvedValue(true),
    };
    prisma.user.findMany.mockResolvedValue([]);
    notifications.createNotification.mockResolvedValue(undefined);
    service = new RrhhService(
      workerRepo as unknown as PrismaWorkerRepository,
      prisma as unknown as PrismaService,
      notifications as never,
      audit as never,
      mail as never,
    );
  });

  it('solo ofrece usuarios activos, no eliminados y sin perfil laboral', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.getAvailableUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          deletedAt: null,
        }) as unknown,
      }),
    );
  });

  it('procesa una alerta de contrato próximo a vencer una sola vez', async () => {
    prisma.contract.findMany.mockResolvedValue([
      {
        id: 'contract-1',
        type: 'FIXED_TERM',
        endDate: new Date('2026-09-01T00:00:00.000Z'),
        worker: {
          userId: 'user-1',
          user: { firstName: 'Ana', lastName: 'Prueba', email: 'ana@test.com' },
        },
      },
    ]);
    prisma.contract.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processExpiringContractAlerts(
      new Date('2026-08-20T00:00:00.000Z'),
    );

    expect(result).toEqual({ processed: 1 });
    expect(prisma.contract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contract-1', expiryAlertSentAt: null },
      }),
    );
    prisma.contract.findMany.mockResolvedValue([
      {
        id: 'contract-unclaimed',
        type: 'FIXED_TERM',
        endDate: new Date('2026-09-01T00:00:00.000Z'),
        worker: {
          userId: 'user-1',
          user: { firstName: 'Ana', lastName: 'Prueba', email: 'ana@test.com' },
        },
      },
    ]);
    prisma.contract.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.processExpiringContractAlerts(
        new Date('2026-08-20T00:00:00.000Z'),
      ),
    ).resolves.toEqual({ processed: 0 });
  });

  it('libera una alerta reclamada cuando el correo no se puede enviar', async () => {
    prisma.contract.findMany.mockResolvedValue([
      {
        id: 'contract-failed-mail',
        type: 'FIXED_TERM',
        endDate: new Date('2026-09-01T00:00:00.000Z'),
        worker: {
          userId: 'user-1',
          user: { firstName: 'Ana', lastName: 'Prueba', email: 'ana@test.com' },
        },
      },
    ]);
    prisma.contract.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    (
      service as unknown as {
        mailService: { sendContractExpiryAlert: jest.Mock };
      }
    ).mailService.sendContractExpiryAlert.mockResolvedValue(false);

    await expect(
      service.processExpiringContractAlerts(
        new Date('2026-08-20T00:00:00.000Z'),
      ),
    ).resolves.toEqual({ processed: 0 });
    expect(prisma.contract.updateMany).toHaveBeenCalledTimes(2);
  });

  it('rechaza periodos de nómina que no tienen formato YYYY-MM', async () => {
    await expect(service.generatePayroll('2026-13')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.worker.findMany).not.toHaveBeenCalled();
  });

  it('genera nómina únicamente para trabajadores operativos', async () => {
    prisma.worker.findMany.mockResolvedValue([
      { id: 'worker-1', baseSalary: '1500.00' },
    ]);
    prisma.payroll.findUnique.mockResolvedValue(null);
    prisma.payroll.create.mockResolvedValue({ id: 'payroll-1' });

    const result = await service.generatePayroll('2026-08');

    expect(result).toEqual([{ id: 'payroll-1' }]);
    expect(prisma.worker.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
    });
  });

  it('no permite pagar una nómina ya pagada', async () => {
    prisma.payroll.findUnique.mockResolvedValue({
      id: 'payroll-1',
      status: 'PAID',
    });

    await expect(service.payPayroll('payroll-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.payroll.update).not.toHaveBeenCalled();
  });

  it('no permite registrar asistencia de una cuenta eliminada o inactiva', async () => {
    prisma.worker.findFirst.mockResolvedValue(null);

    await expect(
      service.markAttendance({
        workerId: 'worker-1',
        date: '2026-08-26',
        status: 'PRESENT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workAttendance.upsert).not.toHaveBeenCalled();
  });

  it('rechaza estados de asistencia desconocidos antes de tocar la base', async () => {
    await expect(
      service.markAttendance({
        workerId: 'worker-1',
        date: '2026-08-26',
        status: 'UNKNOWN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.worker.findFirst).not.toHaveBeenCalled();
  });

  it('marca asistencia válida y conserva el check-in al editar el estado', async () => {
    const originalCheckIn = new Date('2026-08-26T13:00:00.000Z');
    prisma.worker.findFirst.mockResolvedValue({ id: 'worker-1' });
    prisma.workAttendance.findUnique.mockResolvedValue({
      checkInTime: originalCheckIn,
    });
    prisma.workAttendance.upsert.mockResolvedValue({ id: 'attendance-1' });

    await service.markAttendance({
      workerId: 'worker-1',
      date: '2026-08-26',
      status: 'LATE',
      observation: '  Llegó con permiso  ',
    });

    expect(prisma.workAttendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: 'LATE',
          observation: 'Llegó con permiso',
          checkInTime: originalCheckIn,
        }) as unknown,
      }),
    );
  });

  it('devuelve error si se solicita un trabajador inexistente', async () => {
    workerRepo.findById.mockResolvedValue(null);

    await expect(service.findWorkerById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lista trabajadores y crea perfiles para usuarios existentes o nuevos', async () => {
    prisma.worker.findMany.mockResolvedValue([{ id: 'worker-1' }]);
    prisma.worker.count.mockResolvedValue(11);
    await expect(
      service.findAllWorkers({ page: 2, limit: 5, search: '  ana  ' }),
    ).resolves.toEqual({
      data: [{ id: 'worker-1' }],
      pagination: { page: 2, limit: 5, total: 11, totalPages: 3 },
    });

    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    workerRepo.createForExistingUser.mockResolvedValue({ id: 'worker-1' });
    await expect(
      service.createWorker({
        userId: 'user-1',
        dni: '12345678',
        position: ' Docente ',
        department: ' Académico ',
        baseSalary: '1500.00',
        hireDate: '2026-01-01',
      }),
    ).resolves.toEqual({ id: 'worker-1' });

    prisma.role.findUnique.mockResolvedValue({ id: 'role-docente' });
    workerRepo.createWithUser.mockResolvedValue({ id: 'worker-2' });
    await expect(
      service.createWorker({
        email: ' NEW@TEST.COM ',
        firstName: ' Ana ',
        lastName: ' Prueba ',
        password: 'password-123',
        dni: '87654321',
        position: 'Docente',
        department: 'Académico',
        baseSalary: '1700',
        hireDate: '2026-01-01',
      }),
    ).resolves.toEqual({ id: 'worker-2' });
    expect(workerRepo.createWithUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@test.com',
        firstName: 'Ana',
        lastName: 'Prueba',
      }),
      expect.objectContaining({
        baseSalary: expect.anything() as jest.AsymmetricMatcher,
      }),
      'role-docente',
    );
  });

  it('valida y crea contratos laborales', async () => {
    prisma.worker.findFirst.mockResolvedValue({ id: 'worker-1' });
    workerRepo.createContract.mockResolvedValue({ id: 'contract-1' });

    await expect(
      service.createContract('worker-1', {
        type: 'FIXED_TERM',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        agreedSalary: '2200.50',
      }),
    ).resolves.toEqual({ id: 'contract-1' });
    await expect(
      service.createContract('worker-1', {
        type: 'UNKNOWN',
        startDate: '2026-01-01',
        agreedSalary: '2200',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createWorker({
        dni: '12345684',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createContract('worker-1', {
        type: 'FIXED_TERM',
        startDate: '2026-12-31',
        endDate: '2026-01-01',
        agreedSalary: '2200',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.worker.findFirst.mockResolvedValue(null);
    await expect(
      service.createContract('missing', {
        type: 'FIXED_TERM',
        startDate: '2026-01-01',
        agreedSalary: '2200',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista contratos y devuelve los contratos propios del trabajador', async () => {
    prisma.contract.findMany.mockResolvedValue([{ id: 'contract-1' }]);
    prisma.contract.count.mockResolvedValue(1);
    await expect(
      service.findAllContracts(1, 10, 'SIGNED', 'ana'),
    ).resolves.toEqual({
      data: [{ id: 'contract-1' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    prisma.worker.findFirst.mockResolvedValueOnce(null);
    await expect(service.findMyContracts('missing')).resolves.toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    prisma.worker.findFirst.mockResolvedValueOnce({ id: 'worker-1' });
    prisma.contract.findMany.mockResolvedValue([{ id: 'my-contract' }]);
    prisma.contract.count.mockResolvedValue(1);
    await expect(service.findMyContracts('user-1')).resolves.toEqual({
      data: [{ id: 'my-contract' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    prisma.worker.findFirst.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.findMyPayrolls('missing')).resolves.toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      summary: { totalPaid: '0', totalPending: '0', baseSalary: '0' },
    });

    prisma.worker.findFirst.mockResolvedValueOnce({
      id: 'worker-1',
      baseSalary: '4500',
      position: 'Docente',
      department: 'Académico',
    });
    prisma.payroll.findMany.mockResolvedValue([
      { id: 'my-payroll', totalAmount: '4500' },
    ]);
    prisma.payroll.count.mockResolvedValue(1);
    prisma.payroll.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 4500 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 0 } });
    await expect(service.findMyPayrolls('user-1')).resolves.toEqual({
      data: [{ id: 'my-payroll', totalAmount: '4500' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      summary: {
        totalPaid: '4500',
        totalPending: '0',
        baseSalary: '4500',
        position: 'Docente',
        department: 'Académico',
      },
    });
  });

  it('envía, firma, rechaza y aprueba contratos', async () => {
    prisma.contract.findUnique.mockResolvedValue({
      id: 'contract-1',
      status: 'DRAFT',
      worker: { userId: 'user-1', deletedAt: null, user: { deletedAt: null } },
    });
    prisma.contract.update.mockResolvedValue({
      id: 'contract-1',
      status: 'SENT',
    });
    await expect(
      service.sendContract('contract-1', 'admin-1'),
    ).resolves.toEqual({
      id: 'contract-1',
      status: 'SENT',
    });

    prisma.contract.findFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'SENT',
      worker: { userId: 'user-1', deletedAt: null, user: { deletedAt: null } },
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'manager-1' }]);
    prisma.contract.update.mockResolvedValue({
      id: 'contract-1',
      status: 'SIGNED',
    });
    await service.signContract('contract-1', 'user-1', '  Ana   Prueba  ');
    expect(prisma.user.findMany).toHaveBeenCalled();

    prisma.contract.findFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'SENT',
      worker: { userId: 'user-1', deletedAt: null, user: { deletedAt: null } },
    });
    prisma.contract.update.mockResolvedValue({
      id: 'contract-1',
      status: 'REJECTED',
    });
    await expect(
      service.rejectContract('contract-1', 'user-1', '  Falta firma  '),
    ).resolves.toEqual({
      id: 'contract-1',
      status: 'REJECTED',
    });

    prisma.contract.findFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'DRAFT',
      worker: { userId: 'user-1', deletedAt: null, user: { deletedAt: null } },
    });
    await expect(
      service.signContract('contract-1', 'user-1', 'Ana'),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.contract.findFirst.mockResolvedValue(null);
    await expect(
      service.rejectContract('missing', 'user-1', 'reason'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.contract.findUnique.mockResolvedValue({
      id: 'contract-1',
      status: 'SIGNED',
      workerId: 'worker-1',
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) =>
        callback({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'worker-1' }]),
          contract: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest
              .fn()
              .mockResolvedValue({ id: 'contract-1', status: 'APPROVED' }),
          },
        }),
    );
    prisma.worker.findUnique.mockResolvedValue({ userId: 'user-1' });
    await expect(
      service.approveContract('contract-1', 'admin-1'),
    ).resolves.toEqual({
      id: 'contract-1',
      status: 'APPROVED',
    });
    prisma.contract.findUnique.mockResolvedValue(null);
    await expect(
      service.approveContract('missing', 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.contract.findUnique.mockResolvedValue({
      id: 'contract-1',
      status: 'DRAFT',
      workerId: 'worker-1',
    });
    await expect(
      service.approveContract('contract-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('consulta nómina, genera pagos, exporta CSV y muestra dashboard', async () => {
    prisma.payroll.findMany.mockResolvedValue([
      {
        period: '2026-08',
        baseSalary: { toFixed: () => '1500.00' },
        bonuses: { toFixed: () => '100.00' },
        deductions: { toFixed: () => '50.00' },
        totalAmount: { toFixed: () => '1550.00' },
        status: 'PENDING',
        paymentDate: null,
        worker: {
          user: { firstName: 'Ana', lastName: 'Prueba', email: 'ana@test.com' },
        },
      },
    ]);
    prisma.payroll.count.mockResolvedValue(1);
    prisma.payroll.aggregate.mockResolvedValue({
      _sum: { totalAmount: '1550.00' },
    });
    await expect(
      service.findAllPayrolls(1, 20, '2026-08', 'ana'),
    ).resolves.toEqual(
      expect.objectContaining({ summary: { totalAmount: '1550.00' } }),
    );
    await expect(service.exportPayrollCsv()).resolves.toContain('Ana');

    prisma.worker.findMany.mockResolvedValue([
      { id: 'worker-1', baseSalary: '1500.00' },
    ]);
    prisma.payroll.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' });
    prisma.payroll.create.mockResolvedValue({ id: 'payroll-1' });
    await expect(service.generatePayroll('2026-08')).resolves.toEqual([
      { id: 'payroll-1' },
    ]);
    prisma.payroll.findUnique.mockResolvedValue({
      id: 'payroll-1',
      status: 'PENDING',
    });
    prisma.payroll.update.mockResolvedValue({
      id: 'payroll-1',
      status: 'PAID',
    });
    await expect(service.payPayroll('payroll-1')).resolves.toEqual({
      id: 'payroll-1',
      status: 'PAID',
    });

    prisma.worker.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prisma.payroll.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    prisma.payroll.aggregate.mockResolvedValue({
      _sum: { totalAmount: '2500.00' },
    });
    prisma.contract.findMany.mockResolvedValue([
      {
        id: 'contract-expiring',
        workerId: 'worker-1',
        type: 'FIXED_TERM',
        endDate: new Date('2026-09-01'),
        worker: { user: { firstName: 'Ana', lastName: 'Prueba' } },
      },
    ]);
    prisma.worker.findMany.mockResolvedValue([
      { department: 'Académico' },
      { department: 'Académico' },
    ]);
    prisma.contract.count.mockResolvedValue(2);
    await expect(service.getDashboardStats()).resolves.toEqual(
      expect.objectContaining({
        totalWorkers: 3,
        activeWorkers: 2,
        totalPayrollPaid: '2500.00',
        departments: [{ name: 'Académico', count: 2 }],
        activeContracts: 2,
      }),
    );
  });

  it('obtiene y registra asistencia diaria con fechas estrictas', async () => {
    prisma.worker.findMany.mockResolvedValue([
      {
        id: 'worker-1',
        department: 'Académico',
        position: 'Docente',
        user: { firstName: 'Ana', lastName: 'Prueba' },
      },
    ]);
    prisma.workAttendance.findMany.mockResolvedValue([]);
    await expect(service.getDailyAttendance('2026-08-26')).resolves.toEqual([
      expect.objectContaining({
        worker: expect.objectContaining({
          id: 'worker-1',
          name: 'Ana Prueba',
        }) as jest.AsymmetricMatcher,
        attendance: null,
      }),
    ]);
    prisma.workAttendance.findMany.mockResolvedValue([
      { workerId: 'worker-1', status: 'PRESENT' },
    ]);
    await expect(service.getDailyAttendance('2026-08-26')).resolves.toEqual([
      expect.objectContaining({
        worker: expect.objectContaining({
          id: 'worker-1',
        }) as jest.AsymmetricMatcher,
        attendance: { workerId: 'worker-1', status: 'PRESENT' },
      }),
    ]);
    prisma.worker.findFirst.mockResolvedValue({ id: 'worker-1' });
    prisma.workAttendance.findUnique.mockResolvedValue({ checkInTime: null });
    prisma.workAttendance.upsert.mockResolvedValue({ id: 'attendance-1' });
    await expect(
      service.markAttendance({
        workerId: 'worker-1',
        date: '2026-08-26',
        status: 'ABSENT',
        observation: '  Enfermo  ',
      }),
    ).resolves.toEqual({ id: 'attendance-1' });
    await expect(
      service.getDailyAttendance('2026-02-30'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('omite avisos a responsables cuando el servicio de notificaciones no existe', async () => {
    const withoutNotifications = new RrhhService(
      workerRepo as unknown as PrismaWorkerRepository,
      prisma as unknown as PrismaService,
    );
    const notifyContractManagers = (
      withoutNotifications as unknown as {
        notifyContractManagers: (
          title: string,
          message: string,
        ) => Promise<void>;
      }
    ).notifyContractManagers.bind(withoutNotifications);

    await expect(
      notifyContractManagers('Contrato', 'Mensaje'),
    ).resolves.toBeUndefined();
  });

  it('genera el PDF de contrato y respeta el control de acceso', async () => {
    const contract = {
      id: 'contract-1',
      type: 'FIXED_TERM',
      status: 'APPROVED',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      agreedSalary: { toString: () => '2500.00' },
      observations: 'Observaciones del contrato',
      signedAt: new Date('2026-01-02T10:00:00Z'),
      signatureName: 'Ada Lovelace',
      signatureHash: 'hash-1',
      worker: {
        userId: 'user-1',
        dni: '12345678',
        position: 'Docente',
        department: 'Academico',
        user: { firstName: 'Ada', lastName: 'Lovelace' },
      },
      signer: { firstName: 'Ada', lastName: 'Lovelace' },
      approver: { firstName: 'Grace', lastName: 'Hopper' },
      approvedAt: new Date('2026-01-03T10:00:00Z'),
    };
    prisma.contract.findUnique.mockResolvedValue(contract);
    await expect(
      service.generateContractPdf('contract-1', 'user-1', []),
    ).resolves.toEqual(expect.any(Buffer));
    await expect(
      service.generateContractPdf('contract-1', 'other', []),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.contract.findUnique.mockResolvedValue(null);
    await expect(
      service.generateContractPdf('missing', 'user-1', ['ADMIN']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cubre validaciones de trabajadores, contratos, nómina y asistencia', async () => {
    workerRepo.findById.mockResolvedValue({ id: 'worker-1' });
    await expect(service.findWorkerById('worker-1')).resolves.toEqual({
      id: 'worker-1',
    });
    await expect(
      service.createWorker({
        userId: 'user-1',
        dni: '',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createWorker({
        email: 'new@example.com',
        firstName: 'A',
        lastName: 'B',
        password: 'pass',
        dni: '12345678',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
        roleName: 'INVALID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.createWorker({
        userId: 'missing',
        dni: '12345678',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.worker.findFirst.mockResolvedValue({ id: 'worker-1' });
    await expect(
      service.createContract('worker-1', {
        type: 'FIXED_TERM',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        agreedSalary: 'invalid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.generatePayroll('2026-00')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.createWorker({
        email: 'new@example.com',
        firstName: 'A',
        lastName: 'B',
        password: 'pass',
        dni: '12345680',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
        status: 'INVALID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    workerRepo.createForExistingUser.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['userId'] },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    await expect(
      service.createWorker({
        userId: 'user-1',
        dni: '12345681',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    workerRepo.createForExistingUser.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    });
    await expect(
      service.createWorker({
        userId: 'user-1',
        dni: '12345682',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    workerRepo.createForExistingUser.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['dni'] },
    });
    await expect(
      service.createWorker({
        userId: 'user-1',
        dni: '12345683',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(
      service.createWorker({
        email: 'new@example.com',
        firstName: 'A',
        lastName: 'B',
        password: 'pass',
        dni: '12345679',
        position: 'Docente',
        department: 'Academico',
        baseSalary: '1000',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.payroll.findUnique.mockResolvedValue(null);
    await expect(service.payPayroll('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.contract.findUnique.mockResolvedValue(null);
    await expect(
      service.sendContract('missing', 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.contract.findUnique.mockResolvedValue({
      id: 'contract-1',
      status: 'SIGNED',
      worker: { userId: 'user-1', deletedAt: null, user: { deletedAt: null } },
    });
    await expect(
      service.sendContract('contract-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createContract('worker-1', {
        type: 'FIXED_TERM',
        startDate: 'not-a-date',
        agreedSalary: '2200',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createContract('worker-1', {
        type: 'FIXED_TERM',
        startDate: '2026-01-01',
        agreedSalary: '-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getDailyAttendance('not-a-date'),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.contract.findFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'DRAFT',
      worker: { userId: 'user-1', deletedAt: null, user: { deletedAt: null } },
    });
    await expect(
      service.rejectContract('missing', 'user-1', 'x'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
