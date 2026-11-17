import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export async function runStage(base, clients, { durationMs, pauseMs, timeoutMs = 10_000 }, progress = () => {}) {
  assert.ok(clients.length > 0 && Number.isFinite(durationMs) && durationMs > 0);
  assert.ok(Number.isFinite(pauseMs) && pauseMs > 0);
  const started = performance.now();
  const samples = [];
  const byRoute = {};
  const statuses = {};
  let failures = 0;
  let bytes = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  let nextProgress = started + 15_000;
  await Promise.all(clients.map(async (client, index) => {
    assert.ok(client.steps.length);
    let round = 0;
    while (performance.now() - started < durationMs) {
      const step = client.steps[(round + index) % client.steps.length];
      const began = performance.now();
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      let status;
      try {
        const response = await fetch(`${base}${step.path}`, {
          method: step.method || 'GET',
          headers: {
            ...(client.token ? { authorization: `Bearer ${client.token}` } : {}),
            ...(step.body ? { 'content-type': 'application/json' } : {}),
          },
          body: step.body ? JSON.stringify(step.body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'error',
        });
        bytes += (await response.arrayBuffer()).byteLength;
        status = String(response.status);
        if (!response.ok) failures++;
      } catch (error) {
        status = ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'network';
        failures++;
      } finally {
        inFlight--;
      }
      const elapsed = performance.now() - began;
      samples.push(elapsed);
      statuses[status] = (statuses[status] || 0) + 1;
      const route = byRoute[step.name || step.path] ||= { requests: 0, failures: 0, maxMs: 0 };
      route.requests++;
      if (!/^2\d\d$/.test(status)) route.failures++;
      route.maxMs = Math.max(route.maxMs, Math.round(elapsed));
      if (performance.now() >= nextProgress) {
        nextProgress = performance.now() + 15_000;
        progress({ users: clients.length, elapsedSeconds: Math.round((performance.now() - started) / 1000), requests: samples.length, failures });
      }
      round++;
      const remaining = durationMs - (performance.now() - started);
      if (remaining > 0) await delay(Math.min(Math.max(1, pauseMs - elapsed), remaining));
    }
  }));
  samples.sort((a, b) => a - b);
  const percentile = ratio => Math.round(samples[Math.min(samples.length - 1, Math.floor(samples.length * ratio))] || 0);
  const elapsedMs = Math.round(performance.now() - started);
  return {
    users: clients.length, elapsedMs, requests: samples.length, failures, statuses, bytes,
    maxInFlight, throughputPerSecond: Number((samples.length / (elapsedMs / 1000)).toFixed(2)),
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), byRoute,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const origin = new URL(fixture.base);
  assert.ok(fixture.isolated === true && ['127.0.0.1', 'localhost'].includes(origin.hostname), 'Use an explicitly isolated loopback fixture');
  for (const client of fixture.clients) {
    for (const step of client.steps) assert.ok(step.path.startsWith('/') && !step.path.startsWith('//'));
  }
  for (const stage of fixture.stages) {
    assert.ok(Number.isInteger(stage.users) && stage.users > 0 && stage.users <= fixture.clients.length);
    const result = await runStage(fixture.base, fixture.clients.slice(0, stage.users), stage, progress => console.log(JSON.stringify({ progress })));
    console.log(JSON.stringify({ result }));
    if (result.failures || result.p95Ms > (fixture.maxP95Ms || 1000)) process.exitCode = 1;
  }
}
