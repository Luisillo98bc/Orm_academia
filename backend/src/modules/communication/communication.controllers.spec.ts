import { ForbiddenException } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import type { CommunicationService } from './communication.service';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

const user = {
  id: 'user-1',
  email: 'user@example.com',
  roles: ['ADMIN'],
  permissions: [],
};

describe('CommunicationController', () => {
  let controller: CommunicationController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      getLandingAnnouncements: jest.fn().mockResolvedValue([]),
      getAnnouncements: jest.fn().mockResolvedValue([]),
      createAnnouncement: jest.fn().mockResolvedValue({ id: 'announcement-1' }),
      updateAnnouncement: jest.fn().mockResolvedValue({ id: 'announcement-1' }),
      deleteAnnouncement: jest.fn().mockResolvedValue(undefined),
      getForums: jest.fn().mockResolvedValue([]),
      createForum: jest.fn().mockResolvedValue({ id: 'forum-1' }),
      updateForum: jest.fn().mockResolvedValue({ id: 'forum-1' }),
      deleteForum: jest.fn().mockResolvedValue(undefined),
      getForumMessages: jest.fn().mockResolvedValue([]),
      createMessage: jest.fn().mockResolvedValue({ id: 'message-1' }),
      getForumDetail: jest.fn().mockResolvedValue({ id: 'forum-1' }),
      deleteForumMessage: jest.fn().mockResolvedValue(undefined),
    };
    controller = new CommunicationController(
      service as unknown as CommunicationService,
    );
  });

  it('selects announcement audiences by role', async () => {
    await controller.getLandingAnnouncements();
    await controller.getAnnouncements({ ...user, roles: ['DOCENTE'] });
    await controller.getAnnouncements({ ...user, roles: ['ESTUDIANTE'] });
    await controller.getAnnouncements(user);
    expect(service.getAnnouncements).toHaveBeenNthCalledWith(1, 'TEACHERS');
    expect(service.getAnnouncements).toHaveBeenNthCalledWith(2, 'STUDENTS');
    expect(service.getAnnouncements).toHaveBeenNthCalledWith(3, 'ALL');
  });

  it('delegates announcement and forum operations', async () => {
    await controller.createAnnouncement(user, { title: 'News' } as never);
    await controller.updateAnnouncement('announcement-1', { title: 'Updated' });
    await expect(
      controller.deleteAnnouncement('announcement-1'),
    ).resolves.toMatchObject({ statusCode: 200 });
    await controller.getForums('cohort-1', user);
    await controller.createForum(
      'cohort-1',
      { title: 'Forum', description: 'Desc' },
      user,
    );
    await controller.updateForum('forum-1', { title: 'Updated' }, user);
    await controller.deleteForum('forum-1', user);
    await controller.getForumMessages('forum-1', user);
    await controller.createMessage(user, 'forum-1', {
      content: 'Hello',
      parentId: 'parent-1',
    });
    await controller.getForumDetail('forum-1', user);
    expect(service.createAnnouncement).toHaveBeenCalledWith('user-1', {
      title: 'News',
    });
    expect(service.createForum).toHaveBeenCalledWith(
      'cohort-1',
      'Forum',
      'user-1',
      'Desc',
      user,
    );
    expect(service.createMessage).toHaveBeenCalledWith(
      'forum-1',
      'user-1',
      'Hello',
      'parent-1',
      user,
    );
  });

  it('maps forum deletion failures to forbidden errors', async () => {
    service.deleteForumMessage.mockRejectedValue(new Error('forbidden'));
    await expect(
      controller.deleteForumMessage('message-1', user),
    ).rejects.toBeInstanceOf(ForbiddenException);
    service.deleteForumMessage.mockResolvedValue(undefined);
    await expect(
      controller.deleteForumMessage('message-1', user),
    ).resolves.toMatchObject({ statusCode: 200 });
  });
});

describe('DirectMessagesService and Controller', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;
  let service: DirectMessagesService;
  let controller: DirectMessagesController;
  const actor = {
    id: 'user-1',
    email: 'user@example.com',
    roles: ['ESTUDIANTE'],
    permissions: [],
  };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'admin-user', roles: [{ role: { name: 'ADMIN' } }] },
          ]),
      },
      cohort: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cohort-1' }),
        findMany: jest.fn().mockResolvedValue([
          {
            enrollments: [
              {
                user: {
                  id: 'student-1',
                  firstName: 'S',
                  lastName: 'One',
                  email: 's@example.com',
                  profilePicture: null,
                },
              },
            ],
          },
        ]),
      },
      enrollment: {
        findMany: jest.fn().mockResolvedValue([
          {
            cohort: {
              teachers: [
                {
                  id: 'teacher-1',
                  firstName: 'T',
                  lastName: 'One',
                  email: 't@example.com',
                  profilePicture: null,
                },
              ],
            },
          },
        ]),
      },
      directMessage: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'message-1' }),
        count: jest.fn().mockResolvedValue(3),
      },
    };
    service = new DirectMessagesService(prisma as unknown as PrismaService);
    controller = new DirectMessagesController(service);
  });

  it('gets contacts for admin, teacher and student roles', async () => {
    await expect(service.getContacts('admin-1', 'ADMIN')).resolves.toEqual([
      { id: 'admin-user', roles: ['ADMIN'] },
    ]);
    await expect(
      service.getContacts('teacher-1', 'DOCENTE'),
    ).resolves.toMatchObject([{ id: 'student-1', roles: ['ESTUDIANTE'] }]);
    await expect(
      service.getContacts('student-1', 'ESTUDIANTE'),
    ).resolves.toMatchObject([{ id: 'teacher-1', roles: ['DOCENTE'] }]);
  });

  it('manages conversations, sending and unread counts', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', roles: [{ role: { name: 'ESTUDIANTE' } }] },
      { id: 'user-2', roles: [{ role: { name: 'DOCENTE' } }] },
    ]);
    await service.getConversation('user-1', 'user-2');
    await service.sendMessage('user-1', 'user-2', 'Hello');
    await service.markAsRead('message-1', 'user-2');
    await expect(service.getUnreadCount('user-2')).resolves.toBe(3);
    await expect(controller.getContacts(actor)).resolves.toBeDefined();
    await expect(controller.getUnread(actor)).resolves.toEqual({ unread: 3 });
    await controller.getConversation(actor, 'user-2');
    await controller.sendMessage(actor, {
      receiverId: 'user-2',
      content: 'Hi',
    });
    await controller.markAsRead(actor, 'message-1');
    expect(prisma.directMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { senderId: 'user-1', receiverId: 'user-2', content: 'Hi' },
      }),
    );
  });

  it('rejects messages to users without an authorized relationship', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ]);
    prisma.cohort.findFirst.mockResolvedValue(null);
    await expect(
      service.sendMessage('user-1', 'user-2', 'Hello'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.directMessage.create).not.toHaveBeenCalled();
  });

  it('loads the latest messages in bounded pages and returns them chronologically', async () => {
    prisma.directMessage.findMany.mockResolvedValueOnce([
      { id: 'new' },
      { id: 'old' },
    ]);
    await expect(
      service.getConversation('user-1', 'user-2', 'cursor-1'),
    ).resolves.toEqual([{ id: 'old' }, { id: 'new' }]);
    expect(prisma.directMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        cursor: { id: 'cursor-1' },
        skip: 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});
