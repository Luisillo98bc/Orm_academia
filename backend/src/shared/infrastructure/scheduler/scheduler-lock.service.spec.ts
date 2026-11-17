import { SchedulerLockService } from './scheduler-lock.service';

describe('SchedulerLockService', () => {
  const setup = (locked = true) => {
    const database = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ locked }])
        .mockResolvedValue([{ unlocked: true }]),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
    return { database, service: new SchedulerLockService(database as never) };
  };

  it('ejecuta la tarea cuando PostgreSQL concede el bloqueo', async () => {
    const { service, database } = setup();
    const task = jest.fn().mockResolvedValue(undefined);

    await expect(service.runExclusive('academia:test', task)).resolves.toBe(
      true,
    );
    expect(task).toHaveBeenCalledTimes(1);
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('omite la tarea si otra instancia ya tiene el bloqueo', async () => {
    const { service, database } = setup(false);
    const task = jest.fn().mockResolvedValue(undefined);

    await expect(service.runExclusive('academia:test', task)).resolves.toBe(
      false,
    );
    expect(task).not.toHaveBeenCalled();
    expect(database.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('no adquiere dos veces el mismo bloqueo de sesión mientras la tarea sigue activa', async () => {
    const { service, database } = setup();
    let finish!: () => void;
    const running = service.runExclusive(
      'job',
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    expect(await service.runExclusive('job', jest.fn())).toBe(false);
    expect(database.$queryRaw).toHaveBeenCalledTimes(1);
    finish();
    expect(await running).toBe(true);
  });

  it('libera el bloqueo aunque la tarea falle', async () => {
    const { service, database } = setup();
    await expect(
      service.runExclusive('job', () => Promise.reject(new Error('failed'))),
    ).rejects.toThrow('failed');
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('conserva el error original si también falla la liberación del bloqueo', async () => {
    const { service, database } = setup();
    database.$queryRaw.mockRejectedValueOnce(new Error('unlock failed'));
    await expect(
      service.runExclusive('job', () =>
        Promise.reject(new Error('task failed')),
      ),
    ).rejects.toThrow('task failed');
    expect(await service.runExclusive('next-job', jest.fn())).toBe(false);
  });

  it('no acepta nuevos trabajos si se perdió la sesión del bloqueo', async () => {
    const { service, database } = setup();
    database.$queryRaw.mockResolvedValueOnce([{ unlocked: false }]);
    await expect(
      service.runExclusive('job', () => Promise.resolve()),
    ).rejects.toThrow('Se perdió');
    expect(await service.runExclusive('other-job', jest.fn())).toBe(false);
  });

  it('espera los trabajos activos antes de desconectar y rechaza trabajo al cerrar', async () => {
    const { service, database } = setup();
    let finish!: () => void;
    const running = service.runExclusive(
      'job',
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    const closing = service.onModuleDestroy();
    expect(database.$disconnect).not.toHaveBeenCalled();
    expect(await service.runExclusive('new-job', jest.fn())).toBe(false);
    finish();
    await running;
    await closing;
    expect(database.$disconnect).toHaveBeenCalledTimes(1);
  });
});
