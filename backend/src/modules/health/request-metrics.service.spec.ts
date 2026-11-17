import { RequestMetricsService } from './request-metrics.service';

describe('RequestMetricsService', () => {
  it('calculates latency, errors and top routes', () => {
    const service = new RequestMetricsService();
    service.record({
      method: 'GET',
      path: '/health',
      statusCode: 200,
      durationMs: 12,
    });
    service.record({
      method: 'GET',
      path: '/health',
      statusCode: 503,
      durationMs: 48,
    });
    service.record({
      method: 'GET',
      path: '/academic/public/courses',
      statusCode: 200,
      durationMs: 25,
    });

    const snapshot = service.snapshot();
    expect(snapshot).toMatchObject({
      requests: 3,
      errors: 1,
      errorRate: 33.33,
      p50Ms: 25,
    });
    expect(
      snapshot.topRoutes.some(
        (route) =>
          route.path === '/health' &&
          route.requests === 2 &&
          route.errors === 1,
      ),
    ).toBe(true);
  });

  it('retains only the most recent 2000 samples', () => {
    const service = new RequestMetricsService();
    for (let index = 0; index < 2001; index += 1) {
      service.record({
        method: 'GET',
        path: `/route-${index}`,
        statusCode: 200,
        durationMs: index,
      });
    }

    expect(service.snapshot().requests).toBe(2000);
  });
});
