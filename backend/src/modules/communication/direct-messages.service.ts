import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

interface DirectContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
  roles: string[];
}

@Injectable()
export class DirectMessagesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtener contactos disponibles para el usuario.
   * - ESTUDIANTE: ve a sus docentes de cohortes activas.
   * - DOCENTE: ve a sus alumnos de cohortes activas.
   * - ADMIN: ve a todos los usuarios.
   */
  async getContacts(userId: string, role: string) {
    if (role === 'ADMIN') {
      const users = await this.prisma.user.findMany({
        where: { id: { not: userId }, deletedAt: null, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
          roles: { select: { role: { select: { name: true } } } },
        },
        orderBy: { firstName: 'asc' },
      });
      return users.map((u) => ({
        ...u,
        roles: u.roles.map((r) => r.role.name),
      }));
    }

    if (role === 'DOCENTE') {
      // Obtener estudiantes de las cohortes del docente
      const cohorts = await this.prisma.cohort.findMany({
        where: { teachers: { some: { id: userId } }, isActive: true },
        include: {
          enrollments: {
            where: { status: 'ACTIVE', deletedAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      });

      const contactMap = new Map<string, DirectContact>();
      cohorts.forEach((c) =>
        c.enrollments.forEach((e) => {
          if (!contactMap.has(e.user.id)) {
            contactMap.set(e.user.id, { ...e.user, roles: ['ESTUDIANTE'] });
          }
        }),
      );
      return Array.from(contactMap.values());
    }

    // ESTUDIANTE: ver docentes de sus cohortes
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      include: {
        cohort: {
          include: {
            teachers: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    const contactMap = new Map<string, DirectContact>();
    enrollments.forEach((e) =>
      e.cohort.teachers.forEach((t) => {
        if (!contactMap.has(t.id)) {
          contactMap.set(t.id, { ...t, roles: ['DOCENTE'] });
        }
      }),
    );
    return Array.from(contactMap.values());
  }

  /**
   * Obtener historial de conversación entre dos usuarios.
   */
  async getConversation(userId: string, otherUserId: string, before?: string) {
    // Marcar como leídos los mensajes recibidos
    await this.prisma.directMessage.updateMany({
      where: { senderId: otherUserId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    const messages = await this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });
    return messages.reverse();
  }

  /**
   * Enviar un mensaje directo.
   */
  async sendMessage(senderId: string, receiverId: string, content: string) {
    if (
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > 5000 ||
      senderId === receiverId
    ) {
      throw new BadRequestException(
        'El mensaje o el destinatario no son válidos',
      );
    }
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: [senderId, receiverId] },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        roles: {
          where: { role: { isActive: true, deletedAt: null } },
          select: { role: { select: { name: true } } },
        },
      },
    });
    if (users.length !== 2)
      throw new ForbiddenException('Contacto no disponible');
    const adminInvolved = users.some((user) =>
      user.roles.some(({ role }) => role.name === 'ADMIN'),
    );
    if (!adminInvolved) {
      const sharedCohort = await this.prisma.cohort.findFirst({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            {
              teachers: { some: { id: senderId } },
              enrollments: {
                some: { userId: receiverId, status: 'ACTIVE', deletedAt: null },
              },
            },
            {
              teachers: { some: { id: receiverId } },
              enrollments: {
                some: { userId: senderId, status: 'ACTIVE', deletedAt: null },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!sharedCohort)
        throw new ForbiddenException(
          'No puedes enviar mensajes a este usuario',
        );
    }
    return this.prisma.directMessage.create({
      data: { senderId, receiverId, content: content.trim() },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });
  }

  /**
   * Marcar un mensaje como leído.
   */
  async markAsRead(messageId: string, userId: string) {
    return this.prisma.directMessage.updateMany({
      where: { id: messageId, receiverId: userId },
      data: { isRead: true },
    });
  }

  /**
   * Obtener conteo de mensajes no leídos por usuario.
   */
  async getUnreadByContact(userId: string) {
    const counts = await this.prisma.directMessage.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, isRead: false },
      _count: { id: true },
    });
    return Object.fromEntries(
      counts.map((item) => [item.senderId, item._count.id]),
    );
  }

  async getUnreadCount(userId: string) {
    return this.prisma.directMessage.count({
      where: { receiverId: userId, isRead: false },
    });
  }
}
