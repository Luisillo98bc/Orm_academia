#!/usr/bin/env node

/**
 * Smoke load test sin dependencias externas.
 * Ejemplo: node scripts/load-test.mjs --base http://localhost:3003/api/v1 --requests 120 --concurrency 12
 * Con --token se pueden probar endpoints autenticados adicionales mediante --path.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (!value.startsWith('--')) return pairs;
    pairs.push([
      value.slice(2),
      values[index + 1]?.startsWith('--') ? true : values[index + 1] ?? true,
    ]);
    return pairs;
  }, []),
);

const base = String(args.base || 'http://localhost:3003/api/v1').replace(/\/$/, '');
const requests = Math.max(1, Number(args.requests || 100));
const concurrency = Math.max(1, Math.min(requests, Number(args.concurrency || 10)));
const paths = String(args.path || '/health,/academic/public/courses,/academic/public/cohorts')
  .split(',')
  .map((path) => (path.startsWith('/') ? path : `/${path}`));
const headers = args.token ? { Authorization: `Bearer ${args.token}` } : {};
const timeoutMs = Math.max(250, Number(args.timeout || 10_000));
const samples = [];
const statusCounts = {};
let next = 0;
let failures = 0;
const startedAt = performance.now();

async function worker() {
  while (true) {
    const index = next++;
    if (index >= requests) return;
    const path = paths[index % paths.length];
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${base}${path}`, { headers, signal: controller.signal });
      for await (const chunk of response.body || []) {
        // Consume the complete response so latency includes transfer time.
        void chunk;
      }
      const duration = performance.now() - started;
      samples.push(duration);
      statusCounts[response.status] = (statusCounts[response.status] || 0) + 1;
      if (!response.ok) failures += 1;
    } catch (error) {
      samples.push(performance.now() - started);
      const reason = error?.name === 'AbortError' ? 'timeout' : 'network';
      statusCounts[reason] = (statusCounts[reason] || 0) + 1;
      failures += 1;
    } finally {
      clearTimeout(timeout);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
samples.sort((a, b) => a - b);
const percentile = (ratio) =>
  samples[Math.min(samples.length - 1, Math.floor(samples.length * ratio))] || 0;
const elapsedMs = performance.now() - startedAt;
console.log(
  JSON.stringify(
    {
      base,
      requests,
      concurrency,
      failures,
      successRate: `${(((requests - failures) / requests) * 100).toFixed(2)}%`,
      elapsedMs: Math.round(elapsedMs),
      throughputPerSecond: Number((requests / (elapsedMs / 1_000)).toFixed(2)),
      statusCounts,
      p50Ms: percentile(0.5).toFixed(0),
      p95Ms: percentile(0.95).toFixed(0),
      p99Ms: percentile(0.99).toFixed(0),
    },
    null,
    2,
  ),
);
if (failures > 0) process.exitCode = 1;
