import { of } from 'rxjs';
import { ChatGateway } from './chat.gateway';
import { NotificationsGateway } from './notifications.gateway';
import { AuditInterceptor } from '../audit/audit.interceptor';

describe('communication gateways', () => {
  const jwt = { verifyAsync: jest.fn() };
  const sessions = {
    validateAccessClaims: jest.fn().mockResolvedValue({ id: 'user-1' }),
  };
  const client = (id = 'socket-1') => ({
    id,
    data: {} as { userId?: string },
    handshake: { headers: { cookie: 'av_access=token' } },
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  });

  beforeEach(() => jest.clearAllMocks());

  it('allows background workers to persist notifications without a Socket.IO server', async () => {
    const gateway = new NotificationsGateway(jwt as never, sessions as never);
    await expect(
      gateway.sendNotificationToUser('user-1', { id: 'notification-1' }),
    ).resolves.toBeUndefined();
  });

  it('authenticates notification sockets, sends events and cleans them up', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'a'.repeat(64),
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const gateway = new NotificationsGateway(jwt as never, sessions as never);
    const serverTo = jest.fn();
    gateway.server = {
      to: serverTo,
      in: jest.fn().mockReturnValue({
        fetchSockets: jest
          .fn()
          .mockImplementation(() => Promise.resolve([socket])),
      }),
      // Socket.IO returns a broadcast operator from `to`.
    } as never;
    serverTo.mockReturnValue({ emit: jest.fn() });
    const socket = client();

    await gateway.handleConnection(socket as never);
    expect(socket.join).toHaveBeenCalledWith('user_user-1');
    await gateway.sendNotificationToUser('user-1', { id: 'notification-1' });
    expect(serverTo).toHaveBeenCalledWith(socket.id);
    gateway.handleDisconnect(socket as never);
    expect(socket.data.userId).toBe('user-1');

    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    const rejected = client('socket-2');
    await gateway.handleConnection(rejected as never);
    expect(rejected.disconnect).toHaveBeenCalled();
  });

  it('rejects notification sockets without a cookie or a subject', async () => {
    const gateway = new NotificationsGateway(jwt as never, sessions as never);
    const socket = client();
    socket.handshake.headers.cookie = undefined as never;
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalled();

    socket.disconnect.mockClear();
    socket.handshake.headers.cookie = 'av_access=token';
    jwt.verifyAsync.mockResolvedValue({});
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('handles chat connections, messages and read receipts', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'sender-1',
      sid: 'a'.repeat(64),
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const directMessages = {
      sendMessage: jest.fn().mockResolvedValue({ id: 'message-1' }),
      getConversation: jest.fn().mockResolvedValue([]),
    };
    const gateway = new ChatGateway(
      directMessages as never,
      jwt as never,
      sessions as never,
    );
    const emit = jest.fn();
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit }),
      in: jest
        .fn()
        .mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    } as never;
    const socket = client();

    await gateway.handleConnection(socket as never);
    expect(socket.join).toHaveBeenCalledWith('user:sender-1');
    await expect(
      gateway.handleSendMessage(socket as never, {
        receiverId: 'receiver-1',
        content: ' hello ',
      }),
    ).resolves.toEqual({ id: 'message-1' });
    expect(directMessages.sendMessage).toHaveBeenCalledWith(
      'sender-1',
      'receiver-1',
      'hello',
    );
    await gateway.handleMarkRead(socket as never, {
      otherUserId: 'receiver-1',
    });
    expect(directMessages.getConversation).toHaveBeenCalledWith(
      'sender-1',
      'receiver-1',
    );
    gateway.handleDisconnect(socket as never);

    await expect(
      gateway.handleSendMessage(socket as never, {
        receiverId: '',
        content: 'x',
      }),
    ).resolves.toBeUndefined();
    await expect(
      gateway.handleMarkRead(socket as never, { otherUserId: '' }),
    ).resolves.toBeUndefined();
  });

  it('disconnects unauthenticated chat sockets and handles invalid tokens', async () => {
    const directMessages = {
      sendMessage: jest.fn(),
      getConversation: jest.fn(),
    };
    const gateway = new ChatGateway(
      directMessages as never,
      jwt as never,
      sessions as never,
    );
    const socket = client();
    socket.handshake.headers.cookie = undefined as never;
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalled();
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    socket.handshake.headers.cookie = 'av_access=token';
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalledTimes(2);
  });

  it('disconnects each socket when its access token expires', async () => {
    jest.useFakeTimers();
    try {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) + 5,
      });
      const chat = new ChatGateway(
        {} as never,
        jwt as never,
        sessions as never,
      );
      const notifications = new NotificationsGateway(
        jwt as never,
        sessions as never,
      );
      const chatSocket = client('chat');
      const notificationSocket = client('notification');
      await chat.handleConnection(chatSocket as never);
      await notifications.handleConnection(notificationSocket as never);
      jest.advanceTimersByTime(6000);
      expect(chatSocket.disconnect).toHaveBeenCalledWith(true);
      expect(notificationSocket.disconnect).toHaveBeenCalledWith(true);
      chat.handleDisconnect(chatSocket as never);
      notifications.handleDisconnect(notificationSocket as never);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('AuditInterceptor', () => {
  it('audits mutating academic, evaluation and RRHH requests with redaction', (done) => {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditInterceptor(audit as never);
    const request = {
      method: 'post',
      path: '/api/v1/rrhh/workers/worker-1',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
      user: { id: 'user-1' },
      body: { salary: 1000, safe: true },
      params: { workerId: 'worker-1', token: 'secret' },
      query: { email: 'secret@example.com' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };
    interceptor
      .intercept(context as never, {
        handle: () => of({ id: 'result', value: true }),
      })
      .subscribe({
        complete: () => {
          setImmediate(() => {
            expect(audit.log).toHaveBeenCalledWith(
              expect.objectContaining({ userId: 'user-1' }),
              'POST_RRHH_WORKERS_WORKER_1',
              'RRHH',
              'worker-1',
              undefined,
              expect.objectContaining({
                body: { salary: '[REDACTED]', safe: true },
                params: { workerId: 'worker-1', token: '[REDACTED]' },
                query: { email: '[REDACTED]' },
                response: { keys: ['id', 'value'] },
              }),
            );
            done();
          });
        },
      });
  });

  it('passes through non-auditable requests and primitive responses', () => {
    const audit = { log: jest.fn() };
    const interceptor = new AuditInterceptor(audit as never);
    const handle = jest.fn(() => of('ok'));
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          path: '/health',
          user: { id: 'u' },
        }),
      }),
    };
    expect(
      interceptor.intercept(context as never, { handle } as never),
    ).toBeDefined();
    expect(handle).toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
