import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_COOKIE_NAME,
  readCookie,
} from '../auth/infrastructure/auth-cookies.service';

interface SocketData {
  userId?: string;
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
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Mapa de userId a socketId para enviar mensajes directos
  private userSockets: Map<string, string[]> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = await this.authenticate(client);
    if (userId) {
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

  sendNotificationToUser(userId: string, notification: unknown) {
    this.server.to(`user_${userId}`).emit('newNotification', notification);
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
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      if (!payload.sub) return null;
      client.data.userId = payload.sub;
      return payload.sub;
    } catch {
      return null;
    }
  }
}
