import path from 'node:path';
import { test, expect } from '@playwright/test';

test.describe('Experiencia offline y operación comercial', () => {
  test('publica una pantalla de recuperación offline y el service worker la precarga', async ({ page }) => {
    const offline = await page.request.get('/offline');
    expect(offline.ok()).toBeTruthy();
    const workerResponse = await page.request.get('/sw.js');
    expect(workerResponse.ok()).toBeTruthy();
    const worker = await workerResponse.text();
    expect(worker).toContain('/offline');
    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: /No hay conexión disponible/i })).toBeVisible();
  });

  test.describe('administrador', () => {
    test.use({ storageState: path.resolve('.auth', 'admin.json') });

    test('muestra el embudo visual del CRM', async ({ page }) => {
      await page.goto('/dashboard/prospects');
      await expect(page.getByRole('heading', { name: /Embudo de admisiones/i })).toBeVisible();
      await expect(page.getByText(/Conversión a matrícula/i)).toBeVisible();
    });
  });
});
