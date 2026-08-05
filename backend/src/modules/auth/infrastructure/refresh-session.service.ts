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
  email: string;
  roles: string[];
  permissions: string[];
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

    return this.prisma.$transaction(async (transaction) => {
      const session = await transaction.refreshSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              roles: {
                where: { role: { deletedAt: null, isActive: true } },
                include: {
                  role: {
                    include: {
                      permissions: {
                        where: { permission: { deletedAt: null } },
                        include: { permission: true },
                      },
                    },
                  },
                },
              },
            },
          },
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
        throw new UnauthorizedException('La sesión ya fue utilizada');
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

      const roles = session.user.roles.map(({ role }) => role.name);
      const permissions = Array.from(
        new Set(
          session.user.roles.flatMap(({ role }) =>
            role.permissions.map(
              ({ permission }) => `${permission.subject}:${permission.action}`,
            ),
          ),
        ),
      );
      const claims: AccessClaims = {
        sub: session.user.id,
        email: session.user.email,
        roles,
        permissions,
      };

      return {
        accessToken: await this.jwtService.signAsync(claims),
        refreshToken,
      };
    });
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
