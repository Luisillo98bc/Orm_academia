import { AuthRevocationService } from './auth-revocation.service';

describe('AuthRevocationService', () => {
  it('notifies subscribed gateways and supports unsubscribe', () => {
    const service = new AuthRevocationService();
    const handler = jest.fn();
    const unsubscribe = service.subscribe(handler);

    service.revoke('user-1');
    expect(handler).toHaveBeenCalledWith('user-1');

    unsubscribe();
    service.revoke('user-1');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
