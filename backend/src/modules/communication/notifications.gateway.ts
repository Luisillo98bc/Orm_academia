import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_COOKIE_NAME,
  readCookie,
} from '../auth/infrastructure/auth-cookies.service';
import { AuthRevocationService } from '../auth/infrastructure/auth-revocation.service';
import { RefreshSessionService } from '../auth/infrastructure/refresh-session.service';
import { emitToActiveSessions } from './session-events';

interface SocketData {
  userId?: string;
  expiresAt?: number;
  sid?: string;
}

type AuthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

function allowConfiguredOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) {
  const configured = process.env.CORS_ORIGIN ?? '*';
  const allowed = configured.split(',').map((value) => value.trim());
  callback(null, !origin || configured === '*' || allowed.includes(origin));
}

@WebSocketGateway({
  cors: {
    origin: allowConfiguredOrigin,
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Mapa de userId a socketId para enviar mensajes directos
  private userSockets: Map<string, string[]> = new Map();
  private expiryTimers = new Map<string, NodeJS.Timeout>();
  private unsubscribeRevocation?: () => void;

  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: RefreshSessionService,
    @Optional() private readonly authRevocations?: AuthRevocationService,
  ) {}

  onModuleInit() {
    this.unsubscribeRevocation = this.authRevocations?.subscribe((userId) =>
      this.disconnectUser(userId),
    );
  }

  onModuleDestroy() {
    this.unsubscribeRevocation?.();
    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
    this.expiryTimers.clear();
  }

  private disconnectUser(userId: string) {
    for (const socketId of this.userSockets.get(userId) ?? []) {
      this.server.sockets.get(socketId)?.disconnect(true);
    }
  }

  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = await this.authenticate(client);
    if (userId) {
      if (client.data.expiresAt) {
        this.expiryTimers.set(
          client.id,
          setTimeout(
            () => client.disconnect(true),
            Math.max(0, client.data.expiresAt - Date.now()),
          ),
        );
      }
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)?.push(client.id);
      await client.join(`user_${userId}`);
      this.logger.log(
        `Client connected to notifications: ${client.id} for user ${userId}`,
      );
    } else {
      this.logger.warn(`Socket ${client.id} rechazado por autenticaciÃ³n`);
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    const expiryTimer = this.expiryTimers.get(client.id);
    if (expiryTimer) clearTimeout(expiryTimer);
    this.expiryTimers.delete(client.id);
    const userId = client.data.userId;
    if (userId && this.userSockets.has(userId)) {
      const sockets = this.userSockets.get(userId) || [];
      this.userSockets.set(
        userId,
        sockets.filter((id) => id !== client.id),
      );
      if (this.userSockets.get(userId)?.length === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client disconnected from notifications: ${client.id}`);
  }

  async sendNotificationToUser(userId: string, notification: unknown) {
    // El contexto del worker persiste notificaciones sin iniciar Socket.IO.
    if (!this.server) return;
    await emitToActiveSessions(
      this.server,
      `user_${userId}`,
      'newNotification',
      notification,
      this.sessions,
    );
    this.logger.log(`Notification sent to user ${userId}`);
  }

  private async authenticate(
    client: AuthenticatedSocket,
  ): Promise<string | null> {
    const token = readCookie(
      client.handshake.headers.cookie,
      ACCESS_COOKIE_NAME,
    );
    if (!token) return null;

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        sid?: string;
        exp?: number;
      }>(token);
      if (!payload.sub || !payload.exp) return null;
      await this.sessions.validateAccessClaims(payload);
      client.data.userId = payload.sub;
      client.data.sid = payload.sid;
      if (payload.exp) client.data.expiresAt = payload.exp * 1000;
      return payload.sub;
    } catch {
      return null;
    }
  }
}
