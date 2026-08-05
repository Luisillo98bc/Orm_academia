import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class CommunicationService {
  constructor(private prisma: PrismaService) {}

  // ── ANUNCIOS ──
  async getAnnouncements(targetAudience: 'ALL' | 'TEACHERS' | 'STUDENTS') {
    return this.prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [{ targetAudience: 'ALL' }, { targetAudience }],
      },
      include: {
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getLandingAnnouncements() {
    return this.prisma.announcement.findMany({
      where: { isActive: true, showOnLanding: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async createAnnouncement(authorId: string, data: any) {
    return this.prisma.announcement.create({
      data: {
        ...data,
        authorId,
      },
    });
  }

  async updateAnnouncement(id: string, data: any) {
    return this.prisma.announcement.update({
      where: { id },
      data,
    });
  }

  async deleteAnnouncement(id: string) {
    return this.prisma.announcement.delete({
      where: { id },
    });
  }

  // ── FOROS ──
  async getForums(cohortId: string) {
    return this.prisma.forum.findMany({
      where: { cohortId, isActive: true },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            author: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForum(
    cohortId: string,
    title: string,
    description?: string,
    authorId?: string,
  ) {
    return this.prisma.forum.create({
      data: {
        cohortId,
        title,
        ...(description ? { description } : {}),
        ...(authorId ? { authorId } : {}),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getForumMessages(forumId: string) {
    return this.prisma.forumMessage.findMany({
      where: { forumId, parentId: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(
    forumId: string,
    authorId: string,
    content: string,
    parentId?: string,
  ) {
    return this.prisma.forumMessage.create({
      data: {
        forumId,
        authorId,
        content,
        ...(parentId ? { parentId } : {}),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getForumDetail(forumId: string) {
    return this.prisma.forum.findUnique({
      where: { id: forumId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        cohort: { select: { name: true, course: { select: { name: true } } } },
      },
    });
  }

  async deleteForumMessage(messageId: string, userId: string) {
    // Only the author can delete their own message
    const msg = await this.prisma.forumMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg || msg.authorId !== userId) {
      throw new Error('No autorizado para eliminar este mensaje');
    }
    // Delete replies first, then the message
    await this.prisma.forumMessage.deleteMany({
      where: { parentId: messageId },
    });
    return this.prisma.forumMessage.delete({ where: { id: messageId } });
  }

  // ── NOTIFICATIONS ──
  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
