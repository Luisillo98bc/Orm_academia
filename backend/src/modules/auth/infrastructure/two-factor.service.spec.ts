import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { TwoFactorService } from './two-factor.service';

jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));

const toDataUrl = QRCode.toDataURL as unknown as jest.Mock;

function service(
  options: {
    nodeEnv?: string;
    key?: string;
    jwtSecret?: string;
    user?: unknown;
  } = {},
) {
  const updateMock = jest
    .fn<Promise<unknown>, [unknown]>()
    .mockResolvedValue({});
  const prisma = {
    user: {
      update: updateMock,
      updateMany: jest
        .fn<Promise<{ count: number }>, [unknown]>()
        .mockImplementation(() =>
          Promise.resolve({
            count: (options.user as { twoFactorEnabled?: boolean } | undefined)
              ?.twoFactorEnabled
              ? 0
              : 1,
          }),
        ),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.user !== undefined
            ? options.user
            : { twoFactorSecret: 'legacy-secret', twoFactorEnabled: false },
        ),
    },
  };
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          NODE_ENV: options.nodeEnv ?? 'test',
          TWO_FACTOR_ENCRYPTION_KEY: options.key ?? 'test-encryption-key',
          JWT_SECRET: options.jwtSecret ?? 'test-jwt-secret',
        })[key],
    ),
  };
  return {
    service: new TwoFactorService(prisma as never, config as never),
    prisma,
    updateMock,
  };
}

describe('TwoFactorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toDataUrl.mockResolvedValue('data:image/png;base64,test');
  });

  it('creates an encrypted secret and provisioning QR code', async () => {
    const { service: twoFactor, prisma } = service();

    const result = await twoFactor.setup('user-1', 'user@example.com');

    expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(result.otpauthUrl).toContain(
      'otpauth://totp/Academia%20Virtual%3Auser%40example.com',
    );
    expect(result.qrCodeDataUrl).toContain('data:image/png');
    const setupUpdate = prisma.user.updateMany.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(setupUpdate.where).toEqual({
      id: 'user-1',
      deletedAt: null,
      twoFactorEnabled: false,
    });
    expect(setupUpdate.data).toMatchObject({ twoFactorEnabled: false });
  });

  it('cannot reset an enabled factor, including in production', async () => {
    const current = service({
      nodeEnv: 'production',
      user: { twoFactorEnabled: true, twoFactorSecret: 'existing' },
    });
    await expect(
      current.service.setup('user-1', 'admin@example.com'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(current.updateMock).not.toHaveBeenCalled();
    expect(toDataUrl).not.toHaveBeenCalled();
  });

  it('reports status and rejects unknown users', async () => {
    const current = service({
      user: { twoFactorSecret: 'secret', twoFactorEnabled: true },
    });
    await expect(current.service.status('user-1')).resolves.toEqual({
      enabled: true,
      hasSecret: true,
    });

    const missing = service({ user: null });
    await expect(missing.service.status('missing')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('enables 2FA only after a valid code', async () => {
    const valid = service();
    jest.spyOn(valid.service, 'verifyStoredCode').mockReturnValue(true);
    await expect(valid.service.enable('user-1', '123456')).resolves.toEqual({
      enabled: true,
    });
    const enableUpdate = valid.updateMock.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(enableUpdate.data).toMatchObject({ twoFactorEnabled: true });

    const invalid = service();
    jest.spyOn(invalid.service, 'verifyStoredCode').mockReturnValue(false);
    await expect(
      invalid.service.enable('user-1', '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow disabling 2FA in production', async () => {
    const production = service({ nodeEnv: 'production' });

    await expect(
      production.service.disable('user-1', '123456'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('disables 2FA in non-production and validates enabled accounts', async () => {
    const disabled = service({
      user: { twoFactorSecret: null, twoFactorEnabled: false },
    });
    await expect(disabled.service.disable('user-1', '123456')).resolves.toEqual(
      { enabled: false },
    );

    const invalid = service({
      user: { twoFactorSecret: 'secret', twoFactorEnabled: true },
    });
    jest.spyOn(invalid.service, 'verifyStoredCode').mockReturnValue(false);
    await expect(
      invalid.service.disable('user-1', '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifies current TOTP codes and rejects malformed secrets', () => {
    const { service: twoFactor } = service();
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const counter = Math.floor(now / 1000 / 30);
    const internals = twoFactor as unknown as {
      generateCode: (secret: string, counter: number) => string;
    };
    const code = internals.generateCode('JBSWY3DPEHPK3PXP', counter);

    expect(twoFactor.verifyCode('JBSWY3DPEHPK3PXP', code)).toBe(true);
    expect(twoFactor.verifyCode('JBSWY3DPEHPK3PXP', 'bad')).toBe(false);
    const privateApi = twoFactor as unknown as {
      encryptSecret: (secret: string) => string;
      toBase32: (value: Buffer) => string;
    };
    const encrypted = privateApi.encryptSecret('JBSWY3DPEHPK3PXP');
    expect(twoFactor.verifyStoredCode(encrypted, code)).toBe(true);
    expect(privateApi.toBase32(Buffer.from([1]))).toBe('AE');
    expect(twoFactor.verifyStoredCode('enc:v1:malformed', code)).toBe(false);
    expect(() => twoFactor.verifyCode('invalid!', code)).toThrow(
      BadRequestException,
    );
    jest.restoreAllMocks();
  });

  it('upgrades legacy secrets once and leaves encrypted secrets untouched', async () => {
    const legacy = service();
    await legacy.service.upgradeLegacySecret('user-1', 'legacy-secret');
    const legacyUpdate = legacy.updateMock.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(legacyUpdate.data.twoFactorSecret).toEqual(
      expect.stringContaining('enc:v1:'),
    );

    const encrypted = service();
    await encrypted.service.upgradeLegacySecret(
      'user-1',
      'enc:v1:already-encrypted',
    );
    expect(encrypted.prisma.user.update).not.toHaveBeenCalled();
  });

  it('fails safely when no encryption key exists', async () => {
    const configured = service({ key: '', jwtSecret: '' });

    await expect(
      configured.service.setup('user-1', 'user@example.com'),
    ).rejects.toThrow('TWO_FACTOR_ENCRYPTION_KEY no está configurada');
  });
});
