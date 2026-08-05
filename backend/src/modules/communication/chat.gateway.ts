import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DirectMessagesService } from './direct-messages.service';
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
  cors: { origin: allowConfiguredOrigin, credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Map userId -> Set of socket IDs (un usuario puede tener varias pestañas)
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly directMessagesService: DirectMessagesService,
    private readonly jwtService: JwtService,
  ) {}

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
    const senderId = client.data.userId;
    if (!senderId || !payload.receiverId || !payload.content?.trim()) {
      return;
    }

    // Guardar en la base de datos
    const message = await this.directMessagesService.sendMessage(
      senderId,
      payload.receiverId,
      payload.content.trim(),
    );

    // Emitir al remitente (todas sus pestañas)
    this.server.to(`user:${senderId}`).emit('newMessage', message);

    // Emitir al destinatario (todas sus pestañas)
    this.server.to(`user:${payload.receiverId}`).emit('newMessage', message);

    return message;
  }

  // ── MARCAR COMO LEÍDO ──
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { otherUserId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !payload.otherUserId) return;

    // Marcar como leídos en la base de datos (llamando a getConversation que ya lo hace)
    await this.directMessagesService.getConversation(
      userId,
      payload.otherUserId,
    );

    // Notificar al otro usuario que sus mensajes fueron leídos
    this.server.to(`user:${payload.otherUserId}`).emit('messagesRead', {
      readBy: userId,
    });
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
