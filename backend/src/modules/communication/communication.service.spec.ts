/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';

describe('CommunicationService', () => {
  const prisma = {
    announcement: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cohort: { findFirst: jest.fn() },
    forum: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    forumMessage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    notification: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  let service: CommunicationService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CommunicationService(prisma as never);
  });

  it('consulta y valida anuncios de landing', async () => {
    prisma.announcement.findMany.mockResolvedValue([{ id: 'announcement-1' }]);
    await expect(service.getAnnouncements('STUDENTS')).resolves.toEqual([
      { id: 'announcement-1' },
    ]);
    await expect(service.getLandingAnnouncements()).resolves.toEqual([
      { id: 'announcement-1' },
    ]);

    prisma.announcement.create.mockResolvedValue({ id: 'announcement-1' });
    await expect(
      service.createAnnouncement('admin-1', {
        title: 'Bienvenida',
        content: 'Mensaje',
        targetAudience: 'ALL',
        showOnLanding: true,
        landingStartsAt: '2026-08-01',
        landingEndsAt: '2026-08-31',
      } as never),
    ).resolves.toEqual({ id: 'announcement-1' });
    await expect(
      service.createAnnouncement('admin-1', {
        title: 'Sin fecha',
        content: 'Mensaje',
        showOnLanding: true,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createAnnouncement('admin-1', {
        title: 'Fechas invertidas',
        content: 'Mensaje',
        landingStartsAt: '2026-09-01',
        landingEndsAt: '2026-08-01',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createAnnouncement('admin-1', {
        title: 'Fecha inválida',
        content: 'Mensaje',
        landingStartsAt: 'not-a-date',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza y elimina anuncios existentes', async () => {
    prisma.announcement.findUnique.mockResolvedValue({
      showOnLanding: false,
      landingStartsAt: null,
      landingEndsAt: null,
    });
    prisma.announcement.update.mockResolvedValue({ id: 'announcement-1' });
    prisma.announcement.delete.mockResolvedValue({ id: 'announcement-1' });
    await expect(
      service.updateAnnouncement('announcement-1', {
        title: 'Actualizado',
      } as never),
    ).resolves.toEqual({ id: 'announcement-1' });
    await expect(service.deleteAnnouncement('announcement-1')).resolves.toEqual(
      {
        id: 'announcement-1',
      },
    );
    prisma.announcement.findUnique.mockResolvedValue(null);
    await expect(
      service.updateAnnouncement('missing', {} as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('protege foros por matrícula y rol docente', async () => {
    prisma.cohort.findFirst.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
      enrollments: [{ id: 'enrollment-1' }],
    });
    prisma.forum.findMany.mockResolvedValue([{ id: 'forum-1' }]);
    await expect(
      service.getForums('cohort-1', { id: 'student-1', roles: ['ESTUDIANTE'] }),
    ).resolves.toEqual([{ id: 'forum-1' }]);
    prisma.cohort.findFirst.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
      enrollments: [],
    });
    await expect(
      service.getForums('cohort-1', { id: 'outsider', roles: ['ESTUDIANTE'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getForums('cohort-1', { id: 'admin-1', roles: ['ADMIN'] }),
    ).resolves.toEqual([{ id: 'forum-1' }]);
    prisma.cohort.findFirst.mockResolvedValue(null);
    await expect(
      service.getForums('missing', { id: 'student-1', roles: ['ESTUDIANTE'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea, actualiza, consulta y elimina foros y mensajes', async () => {
    prisma.cohort.findFirst.mockResolvedValue({
      id: 'cohort-1',
      teachers: [{ id: 'teacher-1' }],
      enrollments: [{ id: 'enrollment-1' }],
    });
    prisma.forum.findFirst.mockResolvedValue({
      id: 'forum-1',
      cohortId: 'cohort-1',
    });
    prisma.forum.create.mockResolvedValue({ id: 'forum-1' });
    prisma.forum.update.mockResolvedValue({
      id: 'forum-1',
      title: 'Nuevo foro',
    });
    prisma.forum.delete.mockResolvedValue({ id: 'forum-1' });
    prisma.forumMessage.findMany.mockResolvedValue([{ id: 'message-1' }]);
    prisma.forumMessage.create.mockResolvedValue({ id: 'message-1' });
    prisma.forumMessage.findUnique.mockResolvedValue({
      id: 'message-1',
      forumId: 'forum-1',
      authorId: 'student-1',
    });
    prisma.forumMessage.deleteMany.mockResolvedValue({ count: 1 });
    prisma.forumMessage.delete.mockResolvedValue({ id: 'message-1' });

    await expect(
      service.createForum('cohort-1', '  Foro  ', 'teacher-1', 'Descripción', {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).resolves.toEqual({ id: 'forum-1' });
    await expect(
      service.updateForum('forum-1', '  Nuevo foro  ', ' Desc ', {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).resolves.toEqual({ id: 'forum-1', title: 'Nuevo foro' });
    await expect(
      service.getForumMessages('forum-1', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).resolves.toEqual([{ id: 'message-1' }]);
    await expect(
      service.createMessage('forum-1', 'student-1', '  Hola  ', undefined, {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).resolves.toEqual({ id: 'message-1' });
    prisma.forum.findFirst.mockResolvedValueOnce({
      id: 'forum-1',
      cohortId: 'cohort-1',
      title: 'Foro',
    });
    await expect(
      service.getForumDetail('forum-1', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).resolves.toEqual({ id: 'forum-1', cohortId: 'cohort-1' });
    await expect(
      service.deleteForumMessage('message-1', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).resolves.toEqual({ id: 'message-1' });
    await expect(
      service.deleteForum('forum-1', { id: 'teacher-1', roles: ['DOCENTE'] }),
    ).resolves.toEqual({ id: 'forum-1' });
    await expect(
      service.createForum('cohort-1', ' ', 'teacher-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createMessage('forum-1', 'student-1', ' ', undefined, {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.forum.findFirst.mockResolvedValue(null);
    await expect(
      service.getForumMessages('missing', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.forum.findFirst.mockResolvedValue({
      id: 'forum-1',
      cohortId: 'cohort-1',
    });
    await expect(
      service.updateForum('forum-1', ' ', undefined, {
        id: 'teacher-1',
        roles: ['DOCENTE'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.forumMessage.findUnique.mockResolvedValue({
      id: 'message-1',
      forumId: 'forum-1',
      authorId: 'other-student',
    });
    await expect(
      service.deleteForumMessage('message-1', {
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toThrow('No autorizado');
  });

  it('consulta y marca notificaciones', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'notification-1' }]);
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.getUserNotifications('user-1')).resolves.toEqual([
      { id: 'notification-1' },
    ]);
    await expect(
      service.markNotificationAsRead('notification-1', 'user-1'),
    ).resolves.toEqual({ count: 1 });
    await expect(service.markAllNotificationsAsRead('user-1')).resolves.toEqual(
      { count: 1 },
    );
  });
});
