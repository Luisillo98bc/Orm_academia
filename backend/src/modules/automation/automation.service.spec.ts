import { AutomationService } from './automation.service';

describe('AutomationService', () => {
  const prisma = {
    notification: { count: jest.fn() },
    prospect: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
    enrollment: { findMany: jest.fn() },
  };
  const notifications = {
    retryFailedDeliveries: jest.fn(),
    createNotification: jest.fn(),
  };
  const config = { get: jest.fn() };
  const lock = { runExclusive: jest.fn(), logSkipped: jest.fn() };
  let service: AutomationService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'NODE_ENV') return 'test';
      return fallback;
    });
    prisma.notification.count.mockResolvedValue(0);
    notifications.retryFailedDeliveries.mockResolvedValue({ sent: 2 });
    notifications.createNotification.mockResolvedValue({
      id: 'notification-1',
    });
    lock.runExclusive.mockImplementation(
      async (_key: string, callback: () => Promise<void>) => {
        await callback();
        return true;
      },
    );
    service = new AutomationService(
      prisma as never,
      notifications as never,
      config as never,
      lock as never,
    );
  });

  it('no inicia intervalos en entorno de pruebas y expone estado inicial', () => {
    service.onModuleInit();
    expect(service.status()).toEqual({
      enabled: false,
      lastRunAt: null,
      lastResult: null,
      nextRunAt: null,
      history: [],
    });
    service.onModuleDestroy();
  });

  it('inicia y libera el intervalo cuando las tareas están habilitadas', () => {
    jest.useFakeTimers();
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'ENABLE_SCHEDULED_JOBS') return 'true';
      if (key === 'SCHEDULED_JOBS_MODE') return 'inline';
      if (key === 'AUTOMATION_INTERVAL_MS') return 60_000;
      return fallback;
    });
    jest.spyOn(service, 'runOnce').mockResolvedValue({
      executed: true,
      lastRunAt: new Date().toISOString(),
    });
    service.onModuleInit();
    expect(service.status().enabled).toBe(true);
    jest.advanceTimersByTime(60_000);
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('ejecuta seguimientos de prospectos, pagos y alumnos inactivos', async () => {
    prisma.prospect.findMany.mockResolvedValue([
      { id: 'prospect-1', name: 'Ana', assignedToId: 'seller-1' },
      { id: 'prospect-2', name: 'Luis', assignedToId: null },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'payment-1',
        enrollment: { userId: 'student-1', cohort: { name: 'Curso 1' } },
      },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        cohort: { name: 'Curso 1' },
        user: { materialProgress: [] },
      },
      {
        userId: 'student-2',
        cohort: { name: 'Curso 2' },
        user: { materialProgress: [{ updatedAt: new Date() }] },
      },
    ]);

    const result = await service.runOnce();

    expect(result).toEqual(
      expect.objectContaining({
        executed: true,
        prospects: 2,
        payments: 1,
        inactiveStudents: 1,
        notificationRetries: 2,
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledTimes(4);
    expect(lock.runExclusive).toHaveBeenCalledWith(
      'academia:scheduled:automations',
      expect.any(Function),
    );
    expect(service.status()).toEqual(
      expect.objectContaining({
        enabled: false,
        lastResult: expect.any(Object) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('registra cuando otra instancia posee el bloqueo', async () => {
    lock.runExclusive.mockResolvedValue(false);
    const result = await service.runOnce();

    expect(result).toEqual(
      expect.objectContaining({
        executed: false,
        prospects: 0,
        payments: 0,
        inactiveStudents: 0,
        notificationRetries: 0,
      }),
    );
    expect(lock.logSkipped).toHaveBeenCalledWith(
      'academia:scheduled:automations',
    );
    expect(service.status().history[0]).toMatchObject({
      executed: false,
      result: { prospects: 0, payments: 0 },
    });
  });

  it('recorre todas las páginas sin omitir prospectos, pagos ni matrículas', async () => {
    const prospects = Array.from({ length: 201 }, (_, i) => ({
      id: `prospect-${String(i).padStart(4, '0')}`,
      name: `Prospecto ${i}`,
      assignedToId: 'seller',
    }));
    const payments = Array.from({ length: 201 }, (_, i) => ({
      id: `payment-${String(i).padStart(4, '0')}`,
      enrollment: { userId: `payer-${i}`, cohort: { name: `Curso ${i}` } },
    }));
    const enrollments = Array.from({ length: 501 }, (_, i) => ({
      id: `enrollment-${String(i).padStart(4, '0')}`,
      userId: `student-${i}`,
      cohort: { name: `Curso ${i}` },
      user: { materialProgress: [] },
    }));
    prisma.user.findMany.mockResolvedValue([]);
    prisma.prospect.findMany
      .mockResolvedValueOnce(prospects.slice(0, 200))
      .mockResolvedValueOnce(prospects.slice(200));
    prisma.payment.findMany
      .mockResolvedValueOnce(payments.slice(0, 200))
      .mockResolvedValueOnce(payments.slice(200));
    prisma.enrollment.findMany
      .mockResolvedValueOnce(enrollments.slice(0, 500))
      .mockResolvedValueOnce(enrollments.slice(500));

    expect(await service.runOnce()).toEqual(
      expect.objectContaining({
        prospects: 201,
        payments: 201,
        inactiveStudents: 501,
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledTimes(903);
    for (const [model, lastId] of [
      [prisma.prospect, prospects[199].id],
      [prisma.payment, payments[199].id],
      [prisma.enrollment, enrollments[499].id],
    ] as const) {
      expect(model.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            id: { gt: lastId },
          }) as jest.AsymmetricMatcher,
          orderBy: { id: 'asc' },
        }),
      );
    }
  });
});
