import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly sensitiveKeys = new Set([
    'password',
    'passwordHash',
    'dni',
    'salary',
    'amount',
    'token',
    'tokenId',
    'email',
    'phone',
    'address',
    'district',
    'province',
    'department',
    'profilePicture',
    'twoFactorSecret',
  ]);

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [
          key,
          this.sensitiveKeys.has(key) ? '[REDACTED]' : this.redact(nested),
        ]),
      );
    }
    return value;
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(
      JSON.stringify(this.redact(value)),
    ) as Prisma.InputJsonValue;
  }

  log(
    context: AuditContext,
    action: string,
    entity: string,
    entityId?: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: context.userId,
        action,
        entity,
        entityId,
        oldValue: this.json(oldValue),
        newValue: this.json(newValue),
        ipAddress: context.ipAddress?.slice(0, 45),
        userAgent: context.userAgent?.slice(0, 500),
      },
    });
  }

  list(
    page = 1,
    limit = 25,
    action?: string,
    entity?: string,
    fromDate?: string,
    toDate?: string,
    search?: string,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where: Prisma.AuditLogWhereInput = {
      action: action || undefined,
      entity: entity || undefined,
      createdAt: {
        gte: fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : undefined,
        lte: toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined,
      },
      ...(search?.trim()
        ? {
            OR: [
              { action: { contains: search.trim(), mode: 'insensitive' } },
              { entity: { contains: search.trim(), mode: 'insensitive' } },
              {
                user: {
                  is: {
                    email: { contains: search.trim(), mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([data, total]) => ({
      data,
      total,
      page: Math.max(page, 1),
      limit: take,
    }));
  }

  async getSecuritySummary(days = 30) {
    const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const [
      failedLogins,
      successfulLogins,
      activeSessions,
      adminsWithoutTwoFactor,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: { action: 'LOGIN_FAILED', createdAt: { gte: since } },
      }),
      this.prisma.auditLog.count({
        where: { action: 'LOGIN', createdAt: { gte: since } },
      }),
      this.prisma.refreshSession.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.user.count({
        where: {
          isActive: true,
          deletedAt: null,
          twoFactorEnabled: false,
          roles: { some: { role: { name: 'ADMIN' } } },
        },
      }),
    ]);
    return {
      days: safeDays,
      failedLogins,
      successfulLogins,
      activeSessions,
      adminsWithoutTwoFactor,
      riskLevel:
        failedLogins >= 10 || adminsWithoutTwoFactor > 0 ? 'REVIEW' : 'NORMAL',
    };
  }
}
