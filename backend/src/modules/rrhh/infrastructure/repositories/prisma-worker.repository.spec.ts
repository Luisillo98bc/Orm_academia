import { PrismaWorkerRepository } from './prisma-worker.repository';

describe('PrismaWorkerRepository', () => {
  const prisma = {
    worker: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'worker-1' }),
    },
    contract: { create: jest.fn().mockResolvedValue({ id: 'contract-1' }) },
    user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    $transaction: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('lists workers and finds a worker with contracts and payrolls', async () => {
    const repository = new PrismaWorkerRepository(prisma as never);
    await repository.findAll();
    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );

    await repository.findById('worker-1');
    expect(prisma.worker.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'worker-1', deletedAt: null },
        include: expect.objectContaining({
          contracts: { orderBy: { startDate: 'desc' } },
          payrolls: { orderBy: { period: 'desc' } },
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('creates users and workers in one transaction', async () => {
    const tx = {
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      worker: {
        create: jest.fn().mockResolvedValue({ id: 'worker-1' }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: typeof tx) => unknown) => callback(tx),
    );
    const repository = new PrismaWorkerRepository(prisma as never);
    await expect(
      repository.createWithUser(
        {
          email: 'worker@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          passwordHash: 'hash',
        },
        { position: 'Teacher' } as never,
        'role-teacher',
      ),
    ).resolves.toEqual({ id: 'worker-1' });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: { create: { roleId: 'role-teacher' } },
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(tx.worker.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { position: 'Teacher', userId: 'user-1' },
      }),
    );
  });

  it('creates worker profiles for existing users and contracts', async () => {
    const repository = new PrismaWorkerRepository(prisma as never);
    await repository.createForExistingUser('user-1', {
      position: 'Teacher',
    } as never);
    expect(prisma.worker.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { position: 'Teacher', userId: 'user-1' },
      }),
    );
    await repository.createContract('worker-1', { type: 'FULL_TIME' } as never);
    expect(prisma.contract.create).toHaveBeenCalledWith({
      data: { type: 'FULL_TIME', workerId: 'worker-1' },
    });
  });
});
