import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { NotificationsService } from '../communication/notifications.service';

describe('SupportService and SupportController', () => {
  let service: SupportService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let notifications: { createNotification: jest.Mock };
  const student = { id: 'student-1', roles: ['ESTUDIANTE'] };
  const admin = { id: 'admin-1', roles: ['ADMIN'] };
  const ticket = {
    id: 'ticket-1',
    requesterId: 'student-1',
    assigneeId: 'admin-1',
    subject: 'Need help',
    description: 'A sufficiently long description',
    status: 'OPEN',
  };

  beforeEach(() => {
    prisma = {
      supportTicket: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(ticket),
        create: jest.fn().mockResolvedValue(ticket),
        update: jest.fn().mockResolvedValue({ ...ticket, status: 'RESOLVED' }),
      },
      supportTicketMessage: {
        create: jest.fn().mockResolvedValue({ id: 'message-1' }),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-2' }]) },
    };
    notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    service = new SupportService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('lists staff tickets and restricts regular users', async () => {
    await service.list(admin, {
      status: 'OPEN',
      priority: 'HIGH',
      search: ' help ',
    });
    await service.list(student);
    expect(prisma.supportTicket.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'OPEN',
          priority: 'HIGH',
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(prisma.supportTicket.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          requesterId: 'student-1',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('paginates filtered tickets without changing the ownership boundary', async () => {
    await service.list(student, { page: '2', search: 'ayuda' });
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 21,
        where: expect.objectContaining({
          requesterId: student.id,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('gets tickets, handles missing records and enforces ownership', async () => {
    await expect(service.get('ticket-1', student)).resolves.toEqual(ticket);
    prisma.supportTicket.findUnique.mockResolvedValueOnce(null);
    await expect(service.get('missing', student)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.supportTicket.findUnique.mockResolvedValueOnce({
      ...ticket,
      requesterId: 'other-user',
    });
    await expect(service.get('ticket-1', student)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.get('ticket-1', admin)).resolves.toEqual(ticket);
  });

  it('excludes internal notes from a student ticket but keeps them for staff', async () => {
    await service.get('ticket-1', student);
    await service.get('ticket-1', admin);
    expect(prisma.supportTicket.findUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        include: expect.objectContaining({
          messages: expect.objectContaining({
            where: { internalNote: false },
          }) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(prisma.supportTicket.findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        include: expect.objectContaining({
          messages: expect.objectContaining({
            where: undefined,
          }) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('validates and creates tickets with admin notifications', async () => {
    await expect(
      service.create(student, { subject: 'bad', description: 'short' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(student, {
        subject: '  Need help  ',
        description: '  A sufficiently long description  ',
        category: ' TECH ',
        priority: 'HIGH',
      }),
    ).resolves.toEqual(ticket);
    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: 'Need help',
          category: 'TECH',
          priority: 'HIGH',
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-2', type: 'support' }),
    );
  });

  it('adds public/internal messages and notifies the other participant', async () => {
    await expect(
      service.addMessage('ticket-1', student, 'Hello'),
    ).resolves.toEqual({ id: 'message-1' });
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OPEN',
        }) as jest.AsymmetricMatcher,
      }),
    );
    await expect(
      service.addMessage('ticket-1', admin, 'Internal', true),
    ).resolves.toEqual({ id: 'message-1' });
    await expect(
      service.addMessage('ticket-1', student, 'Internal', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(notifications.createNotification).toHaveBeenCalled();
  });

  it('allows staff to update tickets and rejects students', async () => {
    await expect(
      service.update('ticket-1', admin, {
        status: 'RESOLVED',
        priority: 'LOW',
        assigneeId: '',
      }),
    ).resolves.toMatchObject({ status: 'RESOLVED' });
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeId: null,
          closedAt: expect.any(Date) as jest.AsymmetricMatcher,
        }) as jest.AsymmetricMatcher,
      }),
    );
    await expect(
      service.update('ticket-1', student, { status: 'CLOSED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates controller endpoints', async () => {
    const controller = new SupportController(service);
    await controller.list(student, {});
    await controller.create(student, {
      subject: 'Need help',
      description: 'A sufficiently long description',
    });
    await controller.get('ticket-1', student);
    await controller.addMessage('ticket-1', student, { body: 'Hello' });
    await controller.update('ticket-1', admin, { status: 'OPEN' });
    expect(prisma.supportTicket.findMany).toHaveBeenCalled();
  });
});
