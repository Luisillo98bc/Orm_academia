import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './modules/academic/application/services/payments.service';
import { PrismaUserRepository } from './modules/auth/infrastructure/repositories/prisma-user.repository';
import { RrhhService } from './modules/rrhh/rrhh.service';
import { DirectMessagesService } from './modules/communication/direct-messages.service';
import { CommunicationService } from './modules/communication/communication.service';
import { CommunicationController } from './modules/communication/communication.controller';

describe('Administrative workspace queries', () => {
  it('combines directory search with role and soft-delete filters in both data and total', async () => {
    const user = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const repository = new PrismaUserRepository({ user } as never);
    await repository.findPage('DOCENTE', 2, 20, '  Ana  ');
    const query = (user.findMany.mock.calls[0] as [unknown])[0] as {
      where: Record<string, unknown>;
      skip: number;
    };
    expect(query.skip).toBe(20);
    expect(query.where).toMatchObject({
      deletedAt: null,
      roles: { some: { role: { name: 'DOCENTE' } } },
      OR: expect.arrayContaining([
        { email: { contains: 'Ana', mode: 'insensitive' } },
      ]) as jest.AsymmetricMatcher,
    });
    expect(user.count).toHaveBeenCalledWith({ where: query.where });
  });

  it('searches payments without losing history or method filters and uses exact UUIDs', async () => {
    const payment = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const service = new PaymentsService(
      { payment } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.getAllPendingPayments(1, 20, true, {
      search: 'Luis',
      method: 'YAPE',
    });
    const where = (
      (payment.findMany.mock.calls[0] as [unknown])[0] as {
        where: Record<string, unknown>;
      }
    ).where;
    expect(where).toMatchObject({
      status: { in: ['COMPLETED', 'REJECTED'] },
      method: 'YAPE',
    });
    expect(payment.count).toHaveBeenLastCalledWith({ where });
    expect(where.OR).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.anything() as jest.AsymmetricMatcher,
        }),
      ]),
    );
    const id = 'd27cad72-c510-41de-950a-f87f132986d5';
    await service.getAllPendingPayments(1, 20, false, { search: id });
    expect(payment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          OR: expect.arrayContaining([{ id }]) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
    await service.getAllPendingPayments(1, 20, false, { search: 'Yape' });
    const methodQuery = (
      payment.findMany.mock.calls.at(-1) as [unknown]
    )[0] as { where: { OR: unknown[] } };
    expect(methodQuery.where.OR).toContainEqual({ method: 'YAPE' });
  });

  it('rejects invalid attendance months and handles February in a leap year', async () => {
    const workAttendance = {
      groupBy: jest.fn().mockResolvedValue([
        { workerId: 'worker-1', status: 'PRESENT', _count: { id: 10 } },
        { workerId: 'worker-1', status: 'LATE', _count: { id: 2 } },
      ]),
    };
    const worker = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'worker-1',
          department: 'Académico',
          position: 'Docente',
          user: { firstName: 'Ana', lastName: 'Torres' },
        },
      ]),
    };
    const service = new RrhhService(
      {} as never,
      { workAttendance, worker } as never,
    );
    await expect(
      service.getMonthlyAttendance('2026-13'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(workAttendance.groupBy).not.toHaveBeenCalled();
    await expect(service.getMonthlyAttendance('2028-02')).resolves.toEqual([
      {
        id: 'worker-1',
        name: 'Ana Torres',
        department: 'Académico',
        position: 'Docente',
        counts: { PRESENT: 10, LATE: 2 },
      },
    ]);
    expect(workAttendance.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2028-02-01T00:00:00Z'),
            lt: new Date('2028-03-01T00:00:00Z'),
          },
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('counts unread messages only for the authenticated recipient', async () => {
    const directMessage = {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ senderId: 'sender-1', _count: { id: 3 } }]),
    };
    const service = new DirectMessagesService({ directMessage } as never);
    await expect(service.getUnreadByContact('receiver-1')).resolves.toEqual({
      'sender-1': 3,
    });
    expect(directMessage.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { receiverId: 'receiver-1', isRead: false },
      }),
    );
  });

  it('keeps drafts behind the administrative endpoint and public campus lists active', async () => {
    const announcement = { findMany: jest.fn().mockResolvedValue([]) };
    const service = new CommunicationService({ announcement } as never);
    await service.getAnnouncements('STUDENTS');
    expect(announcement.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
        }) as jest.AsymmetricMatcher,
      }),
    );
    await service.getAnnouncementManagement();
    expect(
      Reflect.getMetadata(
        'roles',
        Object.getOwnPropertyDescriptor(
          CommunicationController.prototype,
          'getAnnouncementManagement',
        )?.value as object,
      ),
    ).toEqual(['ADMIN']);
    expect(announcement.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });
});
