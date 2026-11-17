import { AutomationController } from './automation.controller';
import type { AutomationService } from './automation.service';

describe('AutomationController', () => {
  it('delegates status and manual execution', async () => {
    const automation = {
      status: jest.fn().mockResolvedValue({ enabled: true }),
      runOnce: jest.fn().mockResolvedValue({ executed: 2 }),
    };
    const controller = new AutomationController(
      automation as unknown as AutomationService,
    );

    await expect(controller.status()).resolves.toEqual({ enabled: true });
    await expect(controller.run()).resolves.toEqual({ executed: 2 });
    expect(automation.status).toHaveBeenCalled();
    expect(automation.runOnce).toHaveBeenCalled();
  });
});
