import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { NotificationsService } from '../communication/notifications.service';

type Actor = { id: string; roles?: string[] };

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private isStaff(actor: Actor) {
    return Boolean(
      actor.roles?.some((role) => ['ADMIN', 'RRHH', 'DOCENTE'].includes(role)),
    );
  }

  async list(
    actor: Actor,
    query: {
      status?: string;
      priority?: string;
      search?: string;
      page?: string;
    } = {},
  ) {
    const status = Object.values(SupportTicketStatus).includes(
      query.status as SupportTicketStatus,
    )
      ? (query.status as SupportTicketStatus)
      : undefined;
    const priority = Object.values(SupportTicketPriority).includes(
      query.priority as SupportTicketPriority,
    )
      ? (query.priority as SupportTicketPriority)
      : undefined;
    const term = query.search?.trim().slice(0, 100);
    const requestedPage = Number(query.page);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, 10000)
        : 1;
    const where: Prisma.SupportTicketWhereInput = {
      status,
      priority,
      ...(this.isStaff(actor) ? {} : { requesterId: actor.id }),
      ...(term
        ? {
            OR: [
              { subject: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.supportTicket.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: {
            messages: this.isStaff(actor)
              ? true
              : { where: { internalNote: false } },
          },
        },
      },
      skip: (page - 1) * 20,
      take: 21,
    });
  }

  async get(id: string, actor: Actor) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        messages: {
          where: this.isStaff(actor) ? undefined : { internalNote: false },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                roles: { select: { role: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    if (!this.isStaff(actor) && ticket.requesterId !== actor.id)
      throw new ForbiddenException('No puedes ver este ticket');
    return ticket;
  }

  async create(
    actor: Actor,
    input: {
      subject: string;
      description: string;
      category?: string;
      priority?: string;
    },
  ) {
    const subject = input.subject?.trim().slice(0, 200);
    const description = input.description?.trim().slice(0, 10000);
    if (
      !subject ||
      subject.length < 4 ||
      !description ||
      description.length < 10
    ) {
      throw new BadRequestException(
        'El asunto y la descripción son obligatorios',
      );
    }
    const priority = Object.values(SupportTicketPriority).includes(
      input.priority as SupportTicketPriority,
    )
      ? (input.priority as SupportTicketPriority)
      : SupportTicketPriority.NORMAL;
    const ticket = await this.prisma.supportTicket.create({
      data: {
        requesterId: actor.id,
        subject,
        description,
        category: input.category?.trim().slice(0, 50) || 'GENERAL',
        priority,
      },
    });
    const admins = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { name: 'ADMIN' } } },
      },
      select: { id: true },
      take: 10,
    });
    await Promise.all(
      admins.map((admin) =>
        this.notifications.createNotification({
          userId: admin.id,
          title: 'Nuevo ticket de soporte',
          message: subject,
          type: 'support',
          actionUrl: `/dashboard/support?ticket=${ticket.id}`,
        }),
      ),
    );
    return this.get(ticket.id, actor);
  }

  async addMessage(
    id: string,
    actor: Actor,
    body: string,
    internalNote = false,
  ) {
    const ticket = await this.get(id, actor);
    if (internalNote && !this.isStaff(actor))
      throw new ForbiddenException('Solo el equipo puede crear notas internas');
    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        authorId: actor.id,
        body: body.trim().slice(0, 10000),
        internalNote: Boolean(internalNote),
      },
    });
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        status:
          actor.id === ticket.requesterId
            ? SupportTicketStatus.OPEN
            : SupportTicketStatus.IN_PROGRESS,
      },
    });
    const recipientId =
      actor.id === ticket.requesterId ? ticket.assigneeId : ticket.requesterId;
    if (recipientId && !internalNote)
      await this.notifications.createNotification({
        userId: recipientId,
        title: `Actualización de ticket: ${ticket.subject}`,
        message: body.trim().slice(0, 500),
        type: 'support',
        actionUrl: `/dashboard/support?ticket=${id}`,
      });
    return message;
  }

  async update(
    id: string,
    actor: Actor,
    input: { status?: string; priority?: string; assigneeId?: string | null },
  ) {
    if (!this.isStaff(actor))
      throw new ForbiddenException('Solo el equipo puede actualizar tickets');
    const status = Object.values(SupportTicketStatus).includes(
      input.status as SupportTicketStatus,
    )
      ? (input.status as SupportTicketStatus)
      : undefined;
    const priority = Object.values(SupportTicketPriority).includes(
      input.priority as SupportTicketPriority,
    )
      ? (input.priority as SupportTicketPriority)
      : undefined;
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        priority,
        assigneeId: input.assigneeId === '' ? null : input.assigneeId,
        closedAt: ['RESOLVED', 'CLOSED'].includes(status || '')
          ? new Date()
          : undefined,
      },
    });
    if (updated.requesterId)
      await this.notifications.createNotification({
        userId: updated.requesterId,
        title: `Ticket ${updated.status === 'RESOLVED' ? 'resuelto' : 'actualizado'}`,
        message: updated.subject,
        type: 'support',
        actionUrl: `/dashboard/support?ticket=${id}`,
      });
    return updated;
  }
}
