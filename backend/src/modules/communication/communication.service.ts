import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TargetAudience } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dtos/announcement.dto';

type ForumUser = { id: string; roles?: string[] };
type AnnouncementDateInput = string | null | undefined;

@Injectable()
export class CommunicationService {
  constructor(private prisma: PrismaService) {}

  private async assertCohortForumAccess(
    cohortId: string,
    user: ForumUser,
    canManage = false,
  ) {
    if (user.roles?.includes('ADMIN')) return;

    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, deletedAt: null },
      select: {
        id: true,
        teachers: { select: { id: true } },
        enrollments: {
          where: {
            userId: user.id,
            status: { in: ['ACTIVE', 'COMPLETED'] },
            deletedAt: null,
          },
          select: { id: true },
        },
      },
    });

    if (!cohort) throw new NotFoundException('Cohorte no encontrada');

    const isAssignedTeacher =
      user.roles?.includes('DOCENTE') &&
      cohort.teachers.some((teacher) => teacher.id === user.id);
    const isEnrolledStudent =
      user.roles?.includes('ESTUDIANTE') && cohort.enrollments.length > 0;

    if (
      canManage ? !isAssignedTeacher : !isAssignedTeacher && !isEnrolledStudent
    ) {
      throw new ForbiddenException(
        canManage
          ? 'Solo un docente asignado puede administrar los foros de esta cohorte'
          : 'Solo los estudiantes matriculados y docentes asignados pueden acceder a este foro',
      );
    }
  }

  private async getForumForAuthorizedUser(
    forumId: string,
    user: ForumUser,
    canManage = false,
  ) {
    const forum = await this.prisma.forum.findFirst({
      where: { id: forumId, isActive: true },
      select: { id: true, cohortId: true },
    });

    if (!forum) throw new NotFoundException('Foro no encontrado');
    await this.assertCohortForumAccess(forum.cohortId, user, canManage);
    return forum;
  }

  // ── ANUNCIOS ──
  async getAnnouncementManagement() {
    return this.prisma.announcement.findMany({
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

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
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        isActive: true,
        showOnLanding: true,
        AND: [
          {
            OR: [{ landingStartsAt: null }, { landingStartsAt: { lte: now } }],
          },
          {
            OR: [{ landingEndsAt: null }, { landingEndsAt: { gt: now } }],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async createAnnouncement(authorId: string, data: CreateAnnouncementDto) {
    const {
      targetAudience,
      landingStartsAt,
      landingEndsAt,
      showOnLanding,
      ...rest
    } = data;
    const startsAt = this.parseAnnouncementDate(
      landingStartsAt,
      'landingStartsAt',
    );
    const endsAt = this.parseAnnouncementDate(landingEndsAt, 'landingEndsAt');
    this.validateAnnouncementSchedule(showOnLanding ?? false, startsAt, endsAt);

    return this.prisma.announcement.create({
      data: {
        ...rest,
        ...(showOnLanding !== undefined ? { showOnLanding } : {}),
        ...(startsAt !== undefined ? { landingStartsAt: startsAt } : {}),
        ...(endsAt !== undefined ? { landingEndsAt: endsAt } : {}),
        ...(targetAudience
          ? { targetAudience: targetAudience as TargetAudience }
          : {}),
        authorId,
      },
    });
  }

  async updateAnnouncement(id: string, data: UpdateAnnouncementDto) {
    const current = await this.prisma.announcement.findUnique({
      where: { id },
      select: {
        showOnLanding: true,
        landingStartsAt: true,
        landingEndsAt: true,
      },
    });
    if (!current) throw new NotFoundException('Anuncio no encontrado');

    const {
      targetAudience,
      landingStartsAt,
      landingEndsAt,
      showOnLanding,
      ...rest
    } = data;
    const startsAt =
      landingStartsAt === undefined
        ? current.landingStartsAt
        : this.parseAnnouncementDate(landingStartsAt, 'landingStartsAt');
    const endsAt =
      landingEndsAt === undefined
        ? current.landingEndsAt
        : this.parseAnnouncementDate(landingEndsAt, 'landingEndsAt');
    const landingEnabled = showOnLanding ?? current.showOnLanding;
    this.validateAnnouncementSchedule(landingEnabled, startsAt, endsAt);

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...rest,
        ...(showOnLanding !== undefined ? { showOnLanding } : {}),
        ...(landingStartsAt !== undefined ? { landingStartsAt: startsAt } : {}),
        ...(landingEndsAt !== undefined ? { landingEndsAt: endsAt } : {}),
        ...(targetAudience
          ? { targetAudience: targetAudience as TargetAudience }
          : {}),
      },
    });
  }

  async deleteAnnouncement(id: string) {
    return this.prisma.announcement.delete({
      where: { id },
    });
  }

  private parseAnnouncementDate(
    value: AnnouncementDateInput,
    field: string,
  ): Date | null | undefined {
    if (value === undefined || value === null) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} no contiene una fecha válida`);
    }
    return parsed;
  }

  private validateAnnouncementSchedule(
    showOnLanding: boolean,
    startsAt: Date | null | undefined,
    endsAt: Date | null | undefined,
  ): void {
    if (showOnLanding && !endsAt) {
      throw new BadRequestException(
        'Los anuncios de la landing deben tener una fecha de término',
      );
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        'La fecha de término debe ser posterior al inicio',
      );
    }
  }

  // ── FOROS ──
  async getForums(cohortId: string, user: ForumUser) {
    await this.assertCohortForumAccess(cohortId, user);
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
    authorId: string,
    description?: string,
    user?: ForumUser,
  ) {
    const cleanTitle = title?.trim();
    if (!cleanTitle) {
      throw new BadRequestException('El título del foro es obligatorio');
    }
    await this.assertCohortForumAccess(
      cohortId,
      user || { id: authorId, roles: ['DOCENTE'] },
      true,
    );
    return this.prisma.forum.create({
      data: {
        cohortId,
        title: cleanTitle,
        ...(description ? { description } : {}),
        ...(authorId ? { authorId } : {}),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateForum(
    forumId: string,
    title: string,
    description: string | undefined,
    user: ForumUser,
  ) {
    const forum = await this.getForumForAuthorizedUser(forumId, user, true);
    const cleanTitle = title?.trim();
    if (!cleanTitle) {
      throw new BadRequestException('El título del foro es obligatorio');
    }

    return this.prisma.forum.update({
      where: { id: forum.id },
      data: {
        title: cleanTitle,
        description: description?.trim() || null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deleteForum(forumId: string, user: ForumUser) {
    const forum = await this.getForumForAuthorizedUser(forumId, user, true);
    return this.prisma.forum.delete({ where: { id: forum.id } });
  }

  async getForumMessages(forumId: string, user: ForumUser) {
    await this.getForumForAuthorizedUser(forumId, user);
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
    user?: ForumUser,
  ) {
    await this.getForumForAuthorizedUser(
      forumId,
      user || { id: authorId, roles: ['ESTUDIANTE'] },
    );
    const cleanContent = content?.trim();
    if (!cleanContent) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }
    return this.prisma.forumMessage.create({
      data: {
        forumId,
        authorId,
        content: cleanContent,
        ...(parentId ? { parentId } : {}),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getForumDetail(forumId: string, user: ForumUser) {
    await this.getForumForAuthorizedUser(forumId, user);
    return this.prisma.forum.findFirst({
      where: { id: forumId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        cohort: { select: { name: true, course: { select: { name: true } } } },
      },
    });
  }

  async deleteForumMessage(messageId: string, user: ForumUser) {
    const msg = await this.prisma.forumMessage.findUnique({
      where: { id: messageId },
    });
    const isAdmin = Boolean(user.roles?.includes('ADMIN'));
    if (!msg || (msg.authorId !== user.id && !isAdmin)) {
      throw new ForbiddenException('No autorizado para eliminar este mensaje');
    }
    await this.getForumForAuthorizedUser(msg.forumId, user);
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
