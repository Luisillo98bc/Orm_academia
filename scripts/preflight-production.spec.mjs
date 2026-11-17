import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const bash = process.platform === 'win32'
  ? join(process.env.ProgramFiles || 'C:/Program Files', 'Git/bin/bash.exe')
  : 'bash';
const runners = [
  ...(process.platform === 'win32' ? [{ name: 'PowerShell', command: 'powershell.exe', script: 'ps1' }] : []),
  ...(process.platform !== 'win32' || existsSync(bash) ? [{ name: 'Bash', command: bash, script: 'sh' }] : []),
];

for (const runner of runners) {
  test(`${runner.name}: valida configuración y rechaza secretos y dominios inválidos`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'academia-preflight-'));
    try {
      const env = join(dir, 'production.env');
      const tunnel = join(dir, 'tunnel.env');
      const script = join(root, `scripts/preflight-production.${runner.script}`);
      const template = readFileSync(join(root, 'deploy/.env.production.example'), 'utf8');
      const values = Object.fromEntries(template.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
        const at = line.indexOf('=');
        return [line.slice(0, at), line.slice(at + 1)];
      }));
      Object.assign(values, {
        POSTGRES_PASSWORD: 'fixture-database-password',
        DATABASE_URL: 'postgresql://fixture:fixture@db:5432/fixture',
        DIRECT_URL: 'postgresql://fixture:fixture@db:5432/fixture',
        JWT_SECRET: 'fixture-jwt-secret-at-least-32-characters',
        TWO_FACTOR_ENCRYPTION_KEY: 'fixture-2fa-key-at-least-32-characters',
        GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
        INITIAL_ADMIN_PASSWORD: 'fixture-admin-password',
        INITIAL_ADMIN_EMAIL: 'fixture@example.invalid',
        MINIO_ROOT_USER: 'fixture-root', MINIO_ROOT_PASSWORD: 'fixture-root-password',
        MINIO_ACCESS_KEY: 'fixture-access', MINIO_SECRET_KEY: 'fixture-secret',
        MAIL_HOST: 'smtp.example.invalid', MAIL_USER: 'fixture', MAIL_PASS: 'fixture-mail-password',
        MAIL_FROM: 'fixture@example.invalid',
      });
      const run = (changes = {}, token = 'fixture-tunnel-token') => {
        writeFileSync(env, Object.entries({ ...values, ...changes }).map(([k, v]) => `${k}=${v}`).join('\n'));
        writeFileSync(tunnel, `CLOUDFLARE_TUNNEL_TOKEN=${token}\n`);
        const args = runner.script === 'ps1'
          ? ['-NoProfile', '-NonInteractive', '-File', script, '-EnvFile', env, '-TunnelEnvFile', tunnel]
          : [script.replaceAll('\\', '/'), env.replaceAll('\\', '/'), tunnel.replaceAll('\\', '/')];
        const result = spawnSync(runner.command, args, { encoding: 'utf8', timeout: 15_000 });
        assert.ifError(result.error);
        return result;
      };
      for (const changes of [{}, {
        CORS_ORIGIN: `${values.CORS_ORIGIN}/`, NEXT_PUBLIC_SITE_URL: `${values.NEXT_PUBLIC_SITE_URL}/`,
        NEXT_PUBLIC_API_URL: `${values.NEXT_PUBLIC_API_URL}/`, NEXT_PUBLIC_WS_URL: `${values.NEXT_PUBLIC_WS_URL}/`,
      }]) {
        const result = run(changes);
        assert.equal(result.status, 0, result.stdout + result.stderr);
      }
      for (const changes of [
        { POSTGRES_PASSWORD: '' }, { JWT_SECRET: 'short' },
        { INITIAL_ADMIN_PASSWORD: values.JWT_SECRET },
        { TWO_FACTOR_ENCRYPTION_KEY: values.JWT_SECRET },
        { NEXT_PUBLIC_SITE_URL: 'https://wrong.example.invalid' },
        { NEXT_PUBLIC_WS_URL: 'https://wrong.example.invalid' },
        { NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'wrong' },
        { STORAGE_BUCKET_QUOTA_BYTES: '0' }, { TRUST_PROXY_HOPS: '6' },
      ]) assert.notEqual(run(changes).status, 0, JSON.stringify(Object.keys(changes)));
      assert.notEqual(run({}, 'configure_me').status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
