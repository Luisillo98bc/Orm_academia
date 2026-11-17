import {
  SettingsService,
  DEFAULT_CERTIFICATE_TEMPLATE,
} from './settings.service';

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'settings-1',
    academyName: 'Academia Virtual',
    legalName: null,
    taxId: null,
    tagline: null,
    description: null,
    logoUrl: null,
    faviconUrl: null,
    primaryColor: null,
    whatsappNumber: null,
    supportEmail: null,
    salesEmail: null,
    address: null,
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
    youtubeUrl: null,
    tiktokUrl: null,
    xUrl: null,
    heroEyebrow: null,
    heroTitle: null,
    heroSubtitle: null,
    termsUrl: null,
    privacyUrl: null,
    certificateTemplate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SettingsService', () => {
  it('creates default settings when the platform has not been configured', async () => {
    const created = settingsRow();
    const prisma = {
      platformSettings: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn(),
      },
    };
    const service = new SettingsService(prisma as never);

    await expect(service.getSettings()).resolves.toMatchObject({
      id: 'settings-1',
      academyName: 'Academia Virtual',
      certificateTemplate: DEFAULT_CERTIFICATE_TEMPLATE,
    });
    expect(prisma.platformSettings.create).toHaveBeenCalledWith({
      data: { academyName: 'Academia Virtual' },
    });
  });

  it('cleans legacy contact placeholders and merges certificate defaults', async () => {
    const legacy = settingsRow({
      whatsappNumber: '51999999999',
      supportEmail: 'soporte@academia.com',
      certificateTemplate: { primaryColor: '#111827' },
    });
    const prisma = {
      platformSettings: {
        findFirst: jest.fn().mockResolvedValue(legacy),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...legacy,
          whatsappNumber: null,
          supportEmail: null,
        }),
      },
    };
    const service = new SettingsService(prisma as never);

    const result = await service.getSettings();

    expect(result.whatsappNumber).toBeUndefined();
    expect(result.supportEmail).toBeUndefined();
    expect(result.certificateTemplate).toMatchObject({
      ...DEFAULT_CERTIFICATE_TEMPLATE,
      primaryColor: '#111827',
    });
    expect(prisma.platformSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'settings-1' },
        data: { whatsappNumber: null, supportEmail: null },
      }),
    );
  });

  it('exposes only public fields and normalizes update values', async () => {
    const current = settingsRow({ academyName: '  Academia  ' });
    const updated = settingsRow({
      academyName: 'Academia',
      primaryColor: '#2563eb',
    });
    const updateMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue(updated);
    const prisma = {
      platformSettings: {
        findFirst: jest.fn().mockResolvedValue(current),
        create: jest.fn(),
        update: updateMock,
      },
    };
    const service = new SettingsService(prisma as never);

    const publicSettings = await service.getPublicSettings();
    const result = await service.updateSettings({
      academyName: '  Academia  ',
      description: '   ',
      certificateTemplate: { academyLabel: 'MI ACADEMIA' },
    });

    expect(publicSettings).toEqual(
      expect.objectContaining({
        academyName: '  Academia  ',
        logoUrl: undefined,
      }),
    );
    const updateCall = updateMock.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateCall.where).toEqual({ id: 'settings-1' });
    expect(updateCall.data).toMatchObject({
      academyName: 'Academia',
      description: null,
    });
    const certificateTemplate = updateCall.data.certificateTemplate as Record<
      string,
      unknown
    >;
    expect(certificateTemplate).toMatchObject({
      version: 'v2',
      academyLabel: 'MI ACADEMIA',
    });
    expect(result.academyName).toBe('Academia');
  });
});
