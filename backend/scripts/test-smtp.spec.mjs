import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

test('verify-only autentica sin enviar; el envío exige aceptación SMTP y falla con credenciales rechazadas', async () => {
  let deliveries = 0;
  let rejectAuth = false;
  let rejectRecipient = false;
  const server = createServer(socket => {
    socket.setEncoding('utf8');
    socket.write('220 fixture ESMTP\r\n');
    let buffer = '';
    let inData = false;
    socket.on('data', chunk => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') { inData = false; deliveries++; socket.write('250 queued\r\n'); }
        } else if (/^EHLO|^HELO/.test(line)) socket.write('250-fixture\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH/.test(line)) socket.write(rejectAuth ? '535 invalid credentials\r\n' : '235 authenticated\r\n');
        else if (/^QUIT/.test(line)) socket.end('221 bye\r\n');
        else if (/^DATA/.test(line)) { inData = true; socket.write('354 send data\r\n'); }
        else if (/^RCPT/.test(line) && rejectRecipient) socket.write('550 recipient rejected\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const run = (...args) => new Promise(resolve => {
    execFile(process.execPath, [fileURLToPath(new URL('./test-smtp.mjs', import.meta.url)), ...args], {
      cwd: tmpdir(), timeout: 10_000,
      env: {
        ...process.env, MAIL_HOST: '127.0.0.1', MAIL_PORT: String(server.address().port),
        MAIL_USER: 'fixture', MAIL_PASS: 'fixture', MAIL_FROM: 'fixture@example.invalid', MAIL_TEST_TO: '',
      },
    }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr }));
  });
  try {
    assert.equal((await run('--verify-only')).code, 0);
    assert.equal(deliveries, 0);
    const sent = await run('receiver@example.invalid');
    assert.equal(sent.code, 0, sent.stderr);
    assert.equal(deliveries, 1);
    assert.equal((await run('--self')).code, 0);
    assert.equal(deliveries, 2);
    rejectRecipient = true;
    assert.notEqual((await run('receiver@example.invalid')).code, 0);
    assert.equal(deliveries, 2);
    rejectRecipient = false;
    rejectAuth = true;
    assert.notEqual((await run('--verify-only')).code, 0);
    assert.equal(deliveries, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
