import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { runStage } from './sustained-load.mjs';

test('repite lecturas y escrituras autenticadas durante la etapa y registra rechazos y timeouts', async () => {
  let writes = 0;
  const server = createServer((request, response) => {
    if (request.headers.authorization !== 'Bearer fixture') return response.writeHead(401).end();
    if (request.url === '/reject') return response.writeHead(429).end();
    if (request.url === '/timeout') return;
    if (request.method === 'PATCH') writes++;
    response.end('ok');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await runStage(`http://127.0.0.1:${server.address().port}`, [{
      token: 'fixture', steps: [
        { path: '/read' }, { path: '/write', method: 'PATCH', body: { completed: true } },
        { path: '/reject' }, { path: '/timeout' },
      ],
    }], { durationMs: 500, pauseMs: 10, timeoutMs: 50 });
    assert.ok(writes > 1);
    assert.ok(result.elapsedMs >= 500);
    assert.ok(result.statuses['200'] > 0 && result.statuses['429'] > 0 && result.statuses.timeout > 0);
    assert.equal(result.failures, result.statuses['429'] + result.statuses.timeout);
    assert.equal(Object.values(result.statuses).reduce((sum, value) => sum + value, 0), result.requests);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
