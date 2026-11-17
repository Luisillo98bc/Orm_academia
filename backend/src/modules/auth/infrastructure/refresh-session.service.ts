import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

interface AccessClaims {
  sub: string;
  sid?: string;
}

interface RotatedSession {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshSessionService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.refreshTtlMs =
      Number(config.get('REFRESH_TOKEN_TTL_DAYS', 30)) * 86_400_000;
  }

  async create(userId: string, metadata: SessionMetadata): Promise<string> {
    const refreshToken = this.generateToken();
    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        userAgent: metadata.userAgent?.slice(0, 500),
        ipAddress: metadata.ipAddress?.slice(0, 45),
      },
    });

    return refreshToken;
  }

  async rotate(
    currentToken: string,
    metadata: SessionMetadata,
  ): Promise<RotatedSession> {
    const tokenHash = this.hash(currentToken);

    const result = await this.prisma.$transaction(async (transaction) => {
      const session = await transaction.refreshSession.findUnique({
        where: { tokenHash },
        include: {
          user: { select: { id: true, isActive: true, deletedAt: true } },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Sesión no válida');
      }

      if (session.revokedAt) {
        await transaction.refreshSession.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        // El rechazo debe ocurrir después del commit para conservar la revocación.
        return null;
      }

      if (
        session.expiresAt <= new Date() ||
        !session.user.isActive ||
        session.user.deletedAt
      ) {
        throw new UnauthorizedException('La sesión expiró');
      }

      const revoked = await transaction.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException('La sesión ya fue utilizada');
      }

      const refreshToken = this.generateToken();
      await transaction.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: this.hash(refreshToken),
          expiresAt: new Date(Date.now() + this.refreshTtlMs),
          userAgent: metadata.userAgent?.slice(0, 500),
          ipAddress: metadata.ipAddress?.slice(0, 45),
        },
      });

      const claims: AccessClaims = {
        sub: session.user.id,
        sid: this.hash(refreshToken),
      };

      return {
        accessToken: await this.jwtService.signAsync(claims),
        refreshToken,
      };
    });

    if (!result) {
      throw new UnauthorizedException('La sesión ya fue utilizada');
    }
    return result;
  }

  async bindAccessToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<string> {
    const claims = await this.jwtService.verifyAsync<AccessClaims>(accessToken);
    return this.jwtService.signAsync({
      sub: claims.sub,
      sid: this.hash(refreshToken),
    });
  }

  async validateAccessClaims(claims: { sub?: string; sid?: string }) {
    if (!claims.sub || !claims.sid || !/^[a-f0-9]{64}$/.test(claims.sid)) {
      throw new UnauthorizedException('Sesión no válida');
    }
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: claims.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            deletedAt: true,
            roles: {
              where: { role: { isActive: true, deletedAt: null } },
              select: {
                role: {
                  select: {
                    name: true,
                    permissions: {
                      where: { permission: { deletedAt: null } },
                      select: {
                        permission: { select: { subject: true, action: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException('Sesión no válida');
    }
    return {
      id: session.user.id,
      email: session.user.email,
      roles: session.user.roles.map(({ role }) => role.name),
      permissions: [
        ...new Set(
          session.user.roles.flatMap(({ role }) =>
            role.permissions.map(
              ({ permission }) => `${permission.subject}:${permission.action}`,
            ),
          ),
        ),
      ],
    };
  }

  async revoke(token: string): Promise<string | null> {
    if (typeof this.prisma.refreshSession.findUnique !== 'function') {
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash: this.hash(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.hash(token) },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!session) return null;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return session.userId;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAccessSession(claims: {
    sub?: string;
    sid?: string;
  }): Promise<string | null> {
    if (!claims.sub || !claims.sid || !/^[a-f0-9]{64}$/.test(claims.sid))
      return null;
    const result = await this.prisma.refreshSession.updateMany({
      where: { userId: claims.sub, tokenHash: claims.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1 ? claims.sub : null;
  }

  async list(userId: string) {
    return this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
        ipAddress: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeById(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
