import path from 'node:path';
import { test, expect } from '@playwright/test';

const api = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3003/api/v1';

test.describe('Operacion y soporte del campus', () => {
  test.describe('estudiante', () => {
    test.use({ storageState: path.resolve('.auth', 'student.json') });

    test('PWA, soporte y paginas operativas estan disponibles', async ({ page }) => {
      const manifest = await page.request.get('/manifest.webmanifest');
      expect(manifest.ok()).toBeTruthy();
      expect((await manifest.json()).name).toMatch(/Academia/i);
      await page.goto('/dashboard/support');
      await expect(page.getByRole('heading', { name: /Soporte y seguimiento/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Enviar solicitud/i })).toBeVisible();
      const suffix = Date.now();
      const created = await page.request.post(`${api}/support/tickets`, { data: { subject: `Prueba de soporte ${suffix}`, description: 'Validacion automatizada del flujo de atencion.' } });
      expect(created.ok(), await created.text()).toBeTruthy();
      const ticket = await created.json();
      const message = await page.request.post(`${api}/support/tickets/${ticket.id}/messages`, { data: { body: 'Respuesta de validacion automatizada.' } });
      expect(message.ok(), await message.text()).toBeTruthy();
    });
  });

  test.describe('administrador', () => {
    test.use({ storageState: path.resolve('.auth', 'admin.json') });

    test('consulta monitoreo, busqueda, finanzas y automatizaciones', async ({ page }) => {
      for (const endpoint of ['/health/details', '/health/metrics', '/automation/status', '/reports/financial-profitability', '/reports/operating-costs', '/academic/data-quality', '/communication/notifications/admin/deliveries', '/search?q=demo', '/support/tickets']) {
        const response = await page.request.get(`${api}${endpoint}`);
        expect(response.ok(), `${endpoint}: ${await response.text()}`).toBeTruthy();
      }
      const retry = await page.request.post(`${api}/communication/notifications/admin/deliveries/retry?limit=5`);
      expect(retry.ok(), await retry.text()).toBeTruthy();
      await page.goto('/dashboard/system');
      await expect(page.getByRole('heading', { name: /Estado del sistema/i })).toBeVisible();
      await expect(page.getByText('Rendimiento HTTP reciente')).toBeVisible();
      await page.goto('/dashboard/reports');
      await expect(page.getByRole('heading', { name: /Reportes y estad/i })).toBeVisible();
    });
  });
});
