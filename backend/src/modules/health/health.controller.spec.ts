import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

describe('HealthController', () => {
  it('delegates public and authenticated health endpoints', () => {
    const service = {
      check: jest.fn().mockReturnValue({ status: 'ok' }),
      details: jest.fn().mockReturnValue({ status: 'ok', integrations: {} }),
      metrics: jest.fn().mockReturnValue({ requests: 1 }),
    };
    const controller = new HealthController(
      service as unknown as HealthService,
    );

    expect(controller.check()).toEqual({ status: 'ok' });
    expect(controller.details()).toMatchObject({ status: 'ok' });
    expect(controller.metrics()).toEqual({ requests: 1 });
    expect(service.check).toHaveBeenCalled();
    expect(service.details).toHaveBeenCalled();
    expect(service.metrics).toHaveBeenCalled();
  });
});
