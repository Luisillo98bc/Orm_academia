import { SettingsController } from './settings.controller';

describe('SettingsController', () => {
  it('delegates public and protected reads', async () => {
    const settingsService = {
      getPublicSettings: jest
        .fn()
        .mockResolvedValue({ academyName: 'Academia' }),
      getSettings: jest.fn().mockResolvedValue({ id: 'settings-1' }),
      updateSettings: jest.fn(),
    };
    const audit = { log: jest.fn() };
    const controller = new SettingsController(
      settingsService as never,
      audit as never,
    );

    await expect(controller.getPublicSettings()).resolves.toEqual({
      academyName: 'Academia',
    });
    await expect(controller.getSettings()).resolves.toEqual({
      id: 'settings-1',
    });
    expect(settingsService.getSettings).toHaveBeenCalled();
  });

  it('updates settings and records the audit event', async () => {
    const previous = { id: 'settings-1', academyName: 'Old' };
    const updated = { id: 'settings-1', academyName: 'New' };
    const settingsService = {
      getSettings: jest.fn().mockResolvedValue(previous),
      updateSettings: jest.fn().mockResolvedValue(updated),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const controller = new SettingsController(
      settingsService as never,
      audit as never,
    );
    const request = {
      user: { id: 'admin-1' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test' },
    };

    await expect(
      controller.updateSettings({ academyName: 'New' }, request as never),
    ).resolves.toEqual(updated);
    expect(audit.log).toHaveBeenCalledWith(
      { userId: 'admin-1', ipAddress: '127.0.0.1', userAgent: 'test' },
      'UPDATE_SETTINGS',
      'PlatformSettings',
      'settings-1',
      previous,
      updated,
    );
  });
});
