import { emitToActiveSessions } from './session-events';

describe('private socket event delivery', () => {
  it('delivers only to sockets with a live, unrevoked database session', async () => {
    const socket = (id: string, expiresAt = Date.now() + 60_000) => ({
      id,
      data: { userId: 'user-1', sid: id, expiresAt },
      disconnect: jest.fn(),
    });
    const active = socket('active');
    const revoked = socket('revoked');
    const expired = socket('expired', 0);
    const emit = jest.fn();
    const server = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([active, revoked, expired]),
      }),
      to: jest.fn().mockReturnValue({ emit }),
    };
    const sessions = {
      validateAccessClaims: jest
        .fn()
        .mockImplementation(({ sid }: { sid: string }) =>
          sid === 'revoked'
            ? Promise.reject(new Error('revoked'))
            : Promise.resolve({ id: 'user-1' }),
        ),
    };
    await emitToActiveSessions(
      server as never,
      'user:user-1',
      'newMessage',
      { private: true },
      sessions as never,
    );
    expect(server.to).toHaveBeenCalledTimes(1);
    expect(server.to).toHaveBeenCalledWith('active');
    expect(emit).toHaveBeenCalledWith('newMessage', { private: true });
    expect(revoked.disconnect).toHaveBeenCalledWith(true);
    expect(expired.disconnect).toHaveBeenCalledWith(true);
  });
});
