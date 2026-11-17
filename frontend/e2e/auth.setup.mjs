import fs from 'node:fs';
import path from 'node:path';
import { request as playwrightRequest, test as setup, expect } from '@playwright/test';

const api = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3003/api/v1';
const password = 'Demo@1234!';
const authDirectory = path.resolve('.auth');

fs.mkdirSync(authDirectory, { recursive: true });

async function hasValidSession(file) {
  if (!fs.existsSync(file)) return false;
  const context = await playwrightRequest.newContext({ storageState: file });
  const response = await context.get(`${api}/auth/profile`);
  await context.dispose();
  return response.ok();
}

setup('create reusable authenticated sessions', async () => {
  for (const [role, email] of [
    ['admin', 'demo100.admin001@academia.local'],
    ['teacher', 'demo100.docente001@academia.local'],
    ['student', 'demo100.estudiante001@academia.local'],
  ]) {
    const stateFile = path.join(authDirectory, `${role}.json`);
    if (await hasValidSession(stateFile)) continue;
    const context = await playwrightRequest.newContext();
    let response = await context.post(`${api}/auth/login`, { data: { email, password } });
    if (response.status() === 429) {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      response = await context.post(`${api}/auth/login`, { data: { email, password } });
    }
    expect(response.ok(), `${role}: ${await response.text()}`).toBeTruthy();
    await context.storageState({ path: stateFile });
    await context.dispose();
  }
});
