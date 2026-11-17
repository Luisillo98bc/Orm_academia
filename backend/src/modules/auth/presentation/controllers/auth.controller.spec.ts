/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { Prisma } from '@prisma/client';

describe('AuthController', () => {
  const loginUseCase = { execute: jest.fn() };
  const googleLoginUseCase = { execute: jest.fn() };
  const registerUseCase = { execute: jest.fn() };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const mailService = { sendPasswordResetEmail: jest.fn() };
  const authCookies = {
    getRefreshToken: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  };
  const refreshSessions = {
    bindAccessToken: jest.fn(),
    create: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  };
  const twoFactorService = {
    setup: jest.fn(),
    status: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    verifyStoredCode: jest.fn(),
    upgradeLegacySecret: jest.fn(),
  };
  const audit = { log: jest.fn() };
  let controller: AuthController;
  const request = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest-agent'),
  };
  const response = {};
  const result = {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    user: { id: 'user-1', email: 'user@test.com' },
    permissions: ['READ'],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    request.get = jest.fn().mockReturnValue('jest-agent');
    loginUseCase.execute.mockResolvedValue(result);
    googleLoginUseCase.execute.mockResolvedValue(result);
    registerUseCase.execute.mockResolvedValue({ id: 'user-1' });
    refreshSessions.create.mockResolvedValue('refresh-token');
    refreshSessions.bindAccessToken.mockResolvedValue('access-token');
    refreshSessions.rotate.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    twoFactorService.verifyStoredCode.mockReturnValue(true);
    prisma.user.findUnique.mockResolvedValue(null);
    controller = new AuthController(
      loginUseCase as never,
      googleLoginUseCase as never,
      registerUseCase as never,
      prisma as never,
      mailService as never,
      authCookies as never,
      refreshSessions as never,
      twoFactorService as never,
      audit as never,
    );
  });

  it('inicia sesión, crea sesión renovable y registra auditoría', async () => {
    await expect(
      controller.login(
        { email: 'user@test.com', password: 'secret' } as never,
        request as never,
        response as never,
      ),
    ).resolves.toEqual({ user: result.user, permissions: ['READ'] });
    expect(refreshSessions.create).toHaveBeenCalledWith('user-1', {
      userAgent: 'jest-agent',
      ipAddress: '127.0.0.1',
    });
    expect(authCookies.set).toHaveBeenCalledWith(
      response,
      'access-token',
      'refresh-token',
    );

    loginUseCase.execute.mockRejectedValue(new UnauthorizedException());
    await expect(
      controller.login(
        { email: 'bad@test.com', password: 'bad' } as never,
        request as never,
        response as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      'LOGIN_FAILED',
      'Auth',
      undefined,
      undefined,
      { email: 'bad@test.com' },
    );
  });

  it('maneja Google con credencial, 2FA requerido y código inválido', async () => {
    await expect(
      controller.googleLogin({}, request as never, response as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.user.findUnique.mockResolvedValue({
      twoFactorEnabled: true,
      twoFactorSecret: 'secret',
    });
    await expect(
      controller.googleLogin(
        { credential: 'google-token' },
        request as never,
        response as never,
      ),
    ).resolves.toEqual({ twoFactorRequired: true, user: result.user });

    twoFactorService.verifyStoredCode.mockReturnValue(false);
    await expect(
      controller.googleLogin(
        { credential: 'google-token', otpCode: '000000' },
        request as never,
        response as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    twoFactorService.verifyStoredCode.mockReturnValue(true);
    await expect(
      controller.googleLogin(
        { credential: 'google-token', otpCode: '123456' },
        request as never,
        response as never,
      ),
    ).resolves.toEqual({ user: result.user, permissions: ['READ'] });
    expect(twoFactorService.upgradeLegacySecret).toHaveBeenCalled();
  });

  it('delega operaciones de 2FA y registro de usuarios', async () => {
    twoFactorService.setup.mockResolvedValue({ secret: 'secret' });
    twoFactorService.status.mockResolvedValue({ enabled: false });
    twoFactorService.enable.mockResolvedValue({ enabled: true });
    twoFactorService.disable.mockResolvedValue({ enabled: false });

    await expect(
      controller.setupTwoFactor({
        user: { id: 'admin-1', email: 'admin@test.com' },
      } as never),
    ).resolves.toEqual({ secret: 'secret' });
    await expect(
      controller.twoFactorStatus({ user: { id: 'admin-1' } } as never),
    ).resolves.toEqual({ enabled: false });
    await expect(
      controller.enableTwoFactor({ user: { id: 'admin-1' } } as never, {}),
    ).resolves.toEqual({ enabled: true });
    await expect(
      controller.disableTwoFactor({ user: { id: 'admin-1' } } as never, {
        code: '123456',
      }),
    ).resolves.toEqual({ enabled: false });
    await expect(
      controller.register({ email: 'new@test.com' } as never),
    ).resolves.toEqual({ id: 'user-1' });
    expect(registerUseCase.execute).toHaveBeenCalled();
    expect(controller.getProfile({ user: { id: 'user-1' } } as never)).toEqual({
      statusCode: 200,
      data: { id: 'user-1' },
    });
  });

  it('renueva y cierra sesiones usando cookies seguras', async () => {
    authCookies.getRefreshToken.mockReturnValue(undefined);
    await expect(
      controller.refresh(request as never, response as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authCookies.clear).toHaveBeenCalledWith(response);

    authCookies.getRefreshToken.mockReturnValue('old-refresh');
    await expect(
      controller.refresh(request as never, response as never),
    ).resolves.toEqual({
      message: 'Sesión renovada',
    });
    expect(refreshSessions.rotate).toHaveBeenCalledWith(
      'old-refresh',
      expect.any(Object),
    );

    refreshSessions.rotate.mockRejectedValue(new UnauthorizedException());
    await expect(
      controller.refresh(request as never, response as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authCookies.clear).toHaveBeenCalledWith(response);

    await controller.logout(request as never, response as never);
    expect(refreshSessions.revoke).toHaveBeenCalledWith('old-refresh');
    expect(authCookies.clear).toHaveBeenCalledWith(response);
  });

  it('solicita recuperación sin revelar si el correo existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      controller.forgotPassword({ email: ' USER@TEST.COM ' }),
    ).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'Si el correo existe',
        ) as jest.AsymmetricMatcher,
      }),
    );
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      firstName: 'Ana',
    });
    await expect(
      controller.forgotPassword({ email: ' USER@TEST.COM ' }),
    ).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'Si el correo existe',
        ) as jest.AsymmetricMatcher,
      }),
    );
    expect(prisma.user.update).toHaveBeenCalled();
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('restablece contraseña solo con token vigente', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      controller.resetPassword({ token: 'expired', newPassword: 'new-secret' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    await expect(
      controller.resetPassword({ token: 'valid', newPassword: 'new-secret' }),
    ).resolves.toEqual({ message: 'Contraseña actualizada exitosamente' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-1',
          resetToken: expect.any(String) as jest.AsymmetricMatcher,
          resetTokenExpires: {
            gte: expect.any(Date) as jest.AsymmetricMatcher,
          },
        }) as jest.AsymmetricMatcher,
        data: expect.objectContaining({
          resetToken: null,
          resetTokenExpires: null,
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refreshSessions: {
            updateMany: {
              where: { revokedAt: null },
              data: { revokedAt: expect.any(Date) as jest.AsymmetricMatcher },
            },
          },
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('rechaza un token de recuperación consumido por otra petición concurrente', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Already consumed', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );
    await expect(
      controller.resetPassword({
        token: 'used-token',
        newPassword: 'new-secret',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revoca la sesión del JWT al cerrar sesión sin cookie de renovación', async () => {
    const cookies = {
      ...authCookies,
      getAccessToken: jest.fn().mockReturnValue('access-token'),
    };
    const sessions = {
      ...refreshSessions,
      revokeAccessSession: jest.fn().mockResolvedValue('user-1'),
    };
    const claims = { sub: 'user-1', sid: 'a'.repeat(64) };
    const revocations = { revoke: jest.fn() };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(claims) };
    const fallback = new AuthController(
      loginUseCase as never,
      googleLoginUseCase as never,
      registerUseCase as never,
      prisma as never,
      mailService as never,
      cookies as never,
      sessions as never,
      twoFactorService as never,
      audit as never,
      revocations as never,
      jwt as never,
    );
    await fallback.logout(request as never, response as never);
    expect(sessions.revokeAccessSession).toHaveBeenCalledWith(claims);
    expect(revocations.revoke).toHaveBeenCalledWith('user-1');
    expect(cookies.clear).toHaveBeenCalledWith(response);
  });
});
