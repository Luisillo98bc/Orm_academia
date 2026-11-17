import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function runLoad(handler, timeout = 2000) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(new URL('./load-test.mjs', import.meta.url)), '--base', `http://127.0.0.1:${server.address().port}`, '--path', '/fixture', '--requests', '1', '--concurrency', '1', '--timeout', String(timeout)]);
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.on('error', reject);
      child.on('exit', (code) => { try { resolve({ code, result: JSON.parse(output) }); } catch (error) { reject(error); } });
    });
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('incluye el tiempo del cuerpo completo y no solo las cabeceras', async () => {
  const { code, result } = await runLoad((_request, response) => {
    response.writeHead(200); response.flushHeaders();
    setTimeout(() => response.end('respuesta completa'), 150);
  });
  assert.equal(code, 0);
  assert.equal(result.failures, 0);
  assert.ok(Number(result.p50Ms) >= 140);
});

test('un cuerpo interrumpido por timeout cuenta como fallo', async () => {
  const { code, result } = await runLoad((_request, response) => {
    response.writeHead(200); response.flushHeaders();
    const timer = setTimeout(() => response.end('demasiado tarde'), 1500);
    response.on('close', () => clearTimeout(timer));
  }, 250);
  assert.equal(code, 1);
  assert.equal(result.failures, 1);
  assert.equal(result.statusCounts.timeout, 1);
});
