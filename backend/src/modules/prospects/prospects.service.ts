import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProspectStatus } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import {
  normalizePagination,
  paginatedResult,
} from '../../shared/pagination/pagination';

interface CreateProspectInput {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  cohortId?: string;
  source?: string;
  privacyConsent?: boolean;
}

@Injectable()
export class ProspectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const prospect = await this.prisma.prospect.findUnique({ where: { id } });
    if (!prospect) throw new NotFoundException('Prospecto no encontrado');
    return prospect;
  }

  async create(input: CreateProspectInput) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase() || undefined;
    const phone = input.phone?.replace(/[^0-9+]/g, '') || undefined;
    if (!name || name.length < 2)
      throw new BadRequestException('Ingresa tu nombre');
    if (!email && !phone)
      throw new BadRequestException('Ingresa un correo o teléfono');
    if (input.privacyConsent !== true) {
      throw new BadRequestException(
        'Debes aceptar la política de privacidad para continuar',
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('Correo inválido');
    if (phone && phone.replace(/\D/g, '').length < 8)
      throw new BadRequestException('Teléfono inválido');

    if (input.cohortId) {
      const cohortExists = await this.prisma.cohort.count({
        where: { id: input.cohortId, deletedAt: null },
      });
      if (!cohortExists) throw new BadRequestException('Programa inválido');
    }

    const duplicateConditions: Prisma.ProspectWhereInput[] = [];
    if (email) duplicateConditions.push({ email });
    if (phone) duplicateConditions.push({ phone });

    const existing = await this.prisma.prospect.findFirst({
      where: {
        status: { in: ['NEW', 'CONTACTED', 'INTERESTED'] },
        cohortId: input.cohortId || null,
        OR: duplicateConditions,
        createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await this.prisma.prospect.update({
        where: { id: existing.id },
        data: {
          message: input.message?.trim().slice(0, 3000) || existing.message,
        },
      });
      return { received: true, duplicate: true };
    }

    await this.prisma.prospect.create({
      data: {
        name: name.slice(0, 200),
        email,
        phone,
        message: input.message?.trim().slice(0, 3000),
        cohortId: input.cohortId,
        source: (input.source || 'LANDING')
          .replace(/[^A-Z0-9_-]/gi, '')
          .slice(0, 50),
        privacyConsentAt: new Date(),
        privacyConsentVersion: '2026-09-05',
      },
    });
    return { received: true, duplicate: false };
  }

  async list(
    query: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      assignedToId?: string;
      cohortId?: string;
    } = {},
  ) {
    const pagination = normalizePagination(query.page, query.limit);
    const { page, limit, skip } = pagination;
    const { status, search, assignedToId, cohortId } = query;
    const validStatus = Object.values(ProspectStatus).includes(
      status as ProspectStatus,
    )
      ? (status as ProspectStatus)
      : undefined;
    const term = search?.trim().slice(0, 100);
    const where: Prisma.ProspectWhereInput = {
      status: validStatus,
      assignedToId: assignedToId || undefined,
      cohortId: cohortId || undefined,
      OR: term
        ? [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
          ]
        : undefined,
    };
    const [prospects, total] = await Promise.all([
      this.prisma.prospect.findMany({
        where,
        include: {
          cohort: {
            select: {
              id: true,
              name: true,
              course: { select: { name: true } },
            },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
            include: {
              author: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ nextFollowUpAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.prospect.count({ where }),
    ]);
    return paginatedResult(prospects, page, limit, total);
  }

  async stats() {
    const [grouped, overdue] = await Promise.all([
      this.prisma.prospect.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.prospect.count({
        where: {
          nextFollowUpAt: { lt: new Date() },
          status: { in: ['NEW', 'CONTACTED', 'INTERESTED'] },
        },
      }),
    ]);
    return {
      byStatus: Object.fromEntries(
        grouped.map((row) => [row.status, row._count._all]),
      ),
      overdue,
    };
  }

  async update(id: string, input: Record<string, unknown>) {
    const exists = await this.prisma.prospect.count({ where: { id } });
    if (!exists) throw new NotFoundException('Prospecto no encontrado');
    const status =
      typeof input.status === 'string' &&
      Object.values(ProspectStatus).includes(input.status as ProspectStatus)
        ? (input.status as ProspectStatus)
        : undefined;
    const assignedToId =
      input.assignedToId === null || input.assignedToId === ''
        ? null
        : typeof input.assignedToId === 'string'
          ? input.assignedToId
          : undefined;
    const nextFollowUpAt =
      input.nextFollowUpAt === null || input.nextFollowUpAt === ''
        ? null
        : typeof input.nextFollowUpAt === 'string'
          ? new Date(input.nextFollowUpAt)
          : undefined;
    return this.prisma.prospect.update({
      where: { id },
      data: {
        status,
        assignedToId,
        nextFollowUpAt,
        lastContactAt: input.markContacted ? new Date() : undefined,
      },
    });
  }

  async addNote(prospectId: string, authorId: string, content: string) {
    const text = content?.trim();
    if (!text || text.length < 2)
      throw new BadRequestException('Escribe una nota');
    const exists = await this.prisma.prospect.count({
      where: { id: prospectId },
    });
    if (!exists) throw new NotFoundException('Prospecto no encontrado');
    return this.prisma.prospectNote.create({
      data: { prospectId, authorId, content: text.slice(0, 5000) },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async createManual(input: {
    name: string;
    email?: string;
    phone?: string;
    message?: string;
    cohortId?: string;
    source?: string;
    status?: ProspectStatus;
    assignedToId?: string;
    nextFollowUpAt?: Date | string;
  }) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase() || undefined;
    const phone = input.phone?.replace(/[^0-9+]/g, '') || undefined;
    if (!name || name.length < 2)
      throw new BadRequestException('Ingresa el nombre del prospecto');
    if (!email && !phone)
      throw new BadRequestException('Ingresa al menos un correo o teléfono');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('Correo inválido');

    if (input.cohortId) {
      const cohortExists = await this.prisma.cohort.count({
        where: { id: input.cohortId, deletedAt: null },
      });
      if (!cohortExists) throw new BadRequestException('Programa inválido');
    }

    if (input.assignedToId) {
      const userExists = await this.prisma.user.count({
        where: { id: input.assignedToId, isActive: true },
      });
      if (!userExists)
        throw new BadRequestException('Asesor comercial inválido');
    }

    const status =
      input.status && Object.values(ProspectStatus).includes(input.status)
        ? input.status
        : ProspectStatus.NEW;

    const nextFollowUpAt = input.nextFollowUpAt
      ? new Date(input.nextFollowUpAt)
      : undefined;

    return this.prisma.prospect.create({
      data: {
        name: name.slice(0, 200),
        email,
        phone,
        message: input.message?.trim().slice(0, 3000),
        cohortId: input.cohortId || null,
        source: (input.source || 'MANUAL')
          .replace(/[^A-Z0-9_-]/gi, '')
          .slice(0, 50),
        status,
        assignedToId: input.assignedToId || null,
        nextFollowUpAt,
        privacyConsentAt: new Date(),
        privacyConsentVersion: 'admin-created',
      },
      include: {
        cohort: {
          select: {
            id: true,
            name: true,
            course: { select: { name: true } },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        notes: true,
      },
    });
  }

  async recordCheckoutIntent(params: {
    userId: string;
    cohortId: string;
    method: string;
  }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { firstName: true, lastName: true, email: true, phone: true },
      });
      if (!user) return;

      const name =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Alumno';
      const email = user.email?.trim().toLowerCase() || undefined;
      const phone = user.phone?.replace(/[^0-9+]/g, '') || undefined;
      if (!email && !phone) return;

      const duplicateConditions: Prisma.ProspectWhereInput[] = [];
      if (email) duplicateConditions.push({ email });
      if (phone) duplicateConditions.push({ phone });

      const existing = await this.prisma.prospect.findFirst({
        where: {
          status: {
            in: [
              ProspectStatus.NEW,
              ProspectStatus.CONTACTED,
              ProspectStatus.INTERESTED,
            ],
          },
          cohortId: params.cohortId,
          OR: duplicateConditions,
        },
        orderBy: { createdAt: 'desc' },
      });

      const methodLabel = params.method || 'CHECKOUT';
      const source = `CHECKOUT_${params.method}`.slice(0, 50);

      if (existing) {
        await this.prisma.prospect.update({
          where: { id: existing.id },
          data: {
            status: ProspectStatus.INTERESTED,
            source: existing.source.startsWith('CHECKOUT')
              ? existing.source
              : source,
            message: existing.message
              ? `${existing.message}\n[Reserva checkout: método ${methodLabel}]`.slice(
                  0,
                  3000,
                )
              : `Reserva iniciada en checkout con método ${methodLabel}`,
          },
        });
      } else {
        await this.prisma.prospect.create({
          data: {
            name: name.slice(0, 200),
            email,
            phone,
            cohortId: params.cohortId,
            source,
            status: ProspectStatus.INTERESTED,
            message: `Reserva de vacante iniciada en checkout con método ${methodLabel}`,
            privacyConsentAt: new Date(),
            privacyConsentVersion: 'checkout',
          },
        });
      }
    } catch (err) {
      console.error(
        'Error al registrar intención de checkout en prospectos:',
        err,
      );
    }
  }

  async recordEnrollmentCompleted(params: {
    email?: string | null;
    phone?: string | null;
    cohortId?: string | null;
  }) {
    try {
      const email = params.email?.trim().toLowerCase() || undefined;
      const phone = params.phone?.replace(/[^0-9+]/g, '') || undefined;
      if (!email && !phone) return;

      const duplicateConditions: Prisma.ProspectWhereInput[] = [];
      if (email) duplicateConditions.push({ email });
      if (phone) duplicateConditions.push({ phone });

      const matched = await this.prisma.prospect.findMany({
        where: {
          status: {
            in: [
              ProspectStatus.NEW,
              ProspectStatus.CONTACTED,
              ProspectStatus.INTERESTED,
            ],
          },
          OR: duplicateConditions,
          ...(params.cohortId ? { cohortId: params.cohortId } : {}),
        },
        select: { id: true },
      });

      if (matched.length > 0) {
        await this.prisma.prospect.updateMany({
          where: { id: { in: matched.map((p) => p.id) } },
          data: {
            status: ProspectStatus.ENROLLED,
          },
        });
      }
    } catch (err) {
      console.error('Error al sincronizar prospecto a matriculado:', err);
    }
  }
}
