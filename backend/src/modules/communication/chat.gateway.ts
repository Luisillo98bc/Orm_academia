import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { DirectMessagesService } from './direct-messages.service';
import { AuthRevocationService } from '../auth/infrastructure/auth-revocation.service';
import { JwtService } from '@nestjs/jwt';
import { RefreshSessionService } from '../auth/infrastructure/refresh-session.service';
import { emitToActiveSessions } from './session-events';
import {
  ACCESS_COOKIE_NAME,
  readCookie,
} from '../auth/infrastructure/auth-cookies.service';

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
  cors: { origin: allowConfiguredOrigin, credentials: true },
  namespace: '/chat',
})
export class ChatGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(ChatGateway.name);

  // Map userId -> Set of socket IDs (un usuario puede tener varias pestañas)
  private userSockets = new Map<string, Set<string>>();
  private expiryTimers = new Map<string, NodeJS.Timeout>();
  private unsubscribeRevocation?: () => void;

  constructor(
    private readonly directMessagesService: DirectMessagesService,
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

  // ── CONEXIÓN ──
  async handleConnection(client: AuthenticatedSocket) {
    const userId = await this.authenticate(client);
    if (!userId) {
      this.logger.warn(
        `Socket ${client.id} rechazado por falta de autenticaciÃ³n`,
      );
      client.disconnect();
      return;
    }

    if (client.data.expiresAt) {
      this.expiryTimers.set(
        client.id,
        setTimeout(
          () => client.disconnect(true),
          Math.max(0, client.data.expiresAt - Date.now()),
        ),
      );
    }

    // Registrar el socket para el usuario
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    // Unirse a una room personal para poder recibir mensajes dirigidos
    await client.join(`user:${userId}`);

    this.logger.log(`✅ Usuario ${userId} conectado (socket: ${client.id})`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const expiryTimer = this.expiryTimers.get(client.id);
    if (expiryTimer) clearTimeout(expiryTimer);
    this.expiryTimers.delete(client.id);
    const userId = client.data.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`❌ Socket ${client.id} desconectado`);
  }

  // ── ENVIAR MENSAJE ──
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { receiverId: string; content: string },
  ) {
    if (
      !payload ||
      typeof payload.receiverId !== 'string' ||
      !payload.receiverId ||
      typeof payload.content !== 'string' ||
      !payload.content.trim()
    ) {
      return;
    }
    const senderId = await this.authenticate(client);
    if (!senderId) {
      client.disconnect(true);
      return;
    }

    // Guardar en la base de datos
    const message = await this.directMessagesService.sendMessage(
      senderId,
      payload.receiverId,
      payload.content.trim(),
    );

    // Emitir al remitente (todas sus pestañas)
    await emitToActiveSessions(
      this.server,
      `user:${senderId}`,
      'newMessage',
      message,
      this.sessions,
    );

    // Emitir al destinatario (todas sus pestañas)
    await emitToActiveSessions(
      this.server,
      `user:${payload.receiverId}`,
      'newMessage',
      message,
      this.sessions,
    );

    return message;
  }

  // ── MARCAR COMO LEÍDO ──
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { otherUserId: string },
  ) {
    if (
      !payload ||
      typeof payload.otherUserId !== 'string' ||
      !payload.otherUserId
    )
      return;
    const userId = await this.authenticate(client);
    if (!userId) {
      client.disconnect(true);
      return;
    }

    // Marcar como leídos en la base de datos (llamando a getConversation que ya lo hace)
    await this.directMessagesService.getConversation(
      userId,
      payload.otherUserId,
    );

    // Notificar al otro usuario que sus mensajes fueron leídos
    await emitToActiveSessions(
      this.server,
      `user:${payload.otherUserId}`,
      'messagesRead',
      {
        readBy: userId,
      },
      this.sessions,
    );
  }

  private async authenticate(
    client: AuthenticatedSocket,
  ): Promise<string | null> {
    const authToken =
      typeof client.handshake.auth?.token === 'string' &&
      client.handshake.auth.token.trim()
        ? client.handshake.auth.token.trim()
        : null;
    const headerAuth = client.handshake.headers.authorization;
    const bearerToken =
      typeof headerAuth === 'string' &&
      headerAuth.toLowerCase().startsWith('bearer ')
        ? headerAuth.slice(7).trim()
        : null;
    const token =
      authToken ||
      bearerToken ||
      readCookie(client.handshake.headers.cookie, ACCESS_COOKIE_NAME);
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
