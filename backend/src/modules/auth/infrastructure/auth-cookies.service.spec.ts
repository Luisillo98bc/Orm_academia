import {
  ACCESS_COOKIE_NAME,
  AuthCookiesService,
  REFRESH_COOKIE_NAME,
  readCookie,
} from './auth-cookies.service';

describe('auth cookie helpers', () => {
  it('reads and decodes the requested cookie safely', () => {
    expect(readCookie(undefined, ACCESS_COOKIE_NAME)).toBeNull();
    expect(
      readCookie('other=value; av_access=token%20one', ACCESS_COOKIE_NAME),
    ).toBe('token one');
    expect(readCookie('av_access=token', REFRESH_COOKIE_NAME)).toBeNull();
    expect(readCookie('av_access=%E0%A4%A', ACCESS_COOKIE_NAME)).toBeNull();
    expect(
      readCookie('invalid-part; av_access', ACCESS_COOKIE_NAME),
    ).toBeNull();
  });

  it('reads tokens from requests and applies secure cookie options', () => {
    const config = {
      get: jest.fn(
        (key: string, fallback?: unknown) =>
          ({
            COOKIE_SECURE: 'true',
            COOKIE_SAME_SITE: 'strict',
            JWT_EXPIRES_IN: '2h',
            REFRESH_TOKEN_TTL_DAYS: 7,
          })[key] ?? fallback,
      ),
    };
    const service = new AuthCookiesService(config as never);
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    const request = {
      headers: { cookie: 'av_access=access; av_refresh=refresh' },
    };

    expect(service.getAccessToken(request as never)).toBe('access');
    expect(service.getRefreshToken(request as never)).toBe('refresh');
    service.set(response as never, 'access-token', 'refresh-token');
    service.clear(response as never);

    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      ACCESS_COOKIE_NAME,
      'access-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 7_200_000,
      }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ path: '/api/v1/auth', maxAge: 7 * 86_400_000 }),
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      1,
      ACCESS_COOKIE_NAME,
      expect.objectContaining({ path: '/', secure: true }),
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      2,
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: '/api/v1/auth' }),
    );
  });

  it('uses safe defaults for invalid durations and production cookies', () => {
    const config = {
      get: jest.fn(
        (key: string, fallback?: unknown) =>
          ({
            NODE_ENV: 'production',
            JWT_EXPIRES_IN: 'invalid',
            REFRESH_TOKEN_TTL_DAYS: 'invalid',
          })[key] ?? fallback,
      ),
    };
    const service = new AuthCookiesService(config as never);
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };

    service.set(response as never, 'a', 'b');

    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_COOKIE_NAME,
      'a',
      expect.objectContaining({ secure: true, maxAge: 15 * 60_000 }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'b',
      expect.objectContaining({ maxAge: 30 * 86_400_000 }),
    );
  });
});
