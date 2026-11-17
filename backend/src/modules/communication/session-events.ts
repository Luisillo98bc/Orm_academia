import type { Namespace } from 'socket.io';
import type { RefreshSessionService } from '../auth/infrastructure/refresh-session.service';

/** Revisa la sesión antes de entregar datos, incluso si otro proceso la revocó. */
export async function emitToActiveSessions(
  server: Namespace,
  room: string,
  event: string,
  payload: unknown,
  sessions: RefreshSessionService,
): Promise<void> {
  const sockets = await server.in(room).fetchSockets();
  for (const socket of sockets) {
    const data = socket.data as {
      userId?: string;
      sid?: string;
      expiresAt?: number;
    };
    try {
      if (!data.expiresAt || data.expiresAt <= Date.now()) {
        socket.disconnect(true);
        continue;
      }
      await sessions.validateAccessClaims({ sub: data.userId, sid: data.sid });
    } catch {
      socket.disconnect(true);
      continue;
    }
    server.to(socket.id).emit(event, payload);
  }
}
