import { Injectable } from '@nestjs/common';

interface RequestSample {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  finishedAt: number;
}

@Injectable()
export class RequestMetricsService {
  private readonly maxSamples = 2_000;
  private readonly samples: RequestSample[] = [];

  record(sample: Omit<RequestSample, 'finishedAt'>) {
    this.samples.push({ ...sample, finishedAt: Date.now() });
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
  }

  snapshot(windowMs = 5 * 60 * 1_000) {
    const since = Date.now() - windowMs;
    const samples = this.samples.filter((sample) => sample.finishedAt >= since);
    const durations = samples
      .map((sample) => sample.durationMs)
      .sort((a, b) => a - b);
    const errors = samples.filter((sample) => sample.statusCode >= 500).length;
    const byRoute = new Map<
      string,
      { requests: number; errors: number; totalMs: number }
    >();

    for (const sample of samples) {
      const current = byRoute.get(sample.path) || {
        requests: 0,
        errors: 0,
        totalMs: 0,
      };
      current.requests += 1;
      current.errors += sample.statusCode >= 500 ? 1 : 0;
      current.totalMs += sample.durationMs;
      byRoute.set(sample.path, current);
    }

    const percentile = (ratio: number) =>
      durations.length
        ? durations[
            Math.min(durations.length - 1, Math.floor(durations.length * ratio))
          ]
        : 0;

    return {
      windowMinutes: Math.round(windowMs / 60_000),
      requests: samples.length,
      errors,
      errorRate: samples.length
        ? Number(((errors / samples.length) * 100).toFixed(2))
        : 0,
      p50Ms: Math.round(percentile(0.5)),
      p95Ms: Math.round(percentile(0.95)),
      p99Ms: Math.round(percentile(0.99)),
      topRoutes: [...byRoute.entries()]
        .map(([path, value]) => ({
          path,
          ...value,
          averageMs: Math.round(value.totalMs / value.requests),
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 10),
    };
  }
}
