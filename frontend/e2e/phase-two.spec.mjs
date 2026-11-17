import path from 'node:path';
import { test, expect } from '@playwright/test';

const api = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3003/api/v1';
const auth = (role) => path.resolve('.auth', `${role}.json`);

test.describe('Portal docente', () => {
  test.use({ storageState: auth('teacher') });

  test('ve alertas y accion de acompanamiento', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Portal docente')).toBeVisible();
    await expect(page.getByText('Estudiantes con bajo progreso')).toBeVisible();
    await expect(page.getByText('Foros pendientes de respuesta')).toBeVisible();
    await expect(page.getByText(/Acciones/i)).toBeVisible();
    const attention = await page.request.get(`${api}/academic/teacher/attention`);
    expect(attention.ok()).toBeTruthy();
  });
});

test.describe('Operacion administrativa', () => {
  test.use({ storageState: auth('admin') });

  test('consulta retencion, salud de avisos y auditoria filtrable', async ({ page }) => {
    const retention = await page.request.get(`${api}/analytics/retention?days=180`);
    const operations = await page.request.get(`${api}/analytics/operational-overview?days=30`);
    const deliveries = await page.request.get(`${api}/communication/notifications/admin/deliveries?limit=5`);
    expect(retention.ok()).toBeTruthy();
    expect(operations.ok()).toBeTruthy();
    expect(deliveries.ok()).toBeTruthy();
    await page.goto('/dashboard/reports');
    await expect(page.getByText(/Reten.*riesgo.*acad/i)).toBeVisible();
    await expect(page.getByText(/Salud de notificaciones/i)).toBeVisible();
    await page.goto('/dashboard/audit');
    await page.getByLabel(/Fecha inicial de auditor/i).fill('2020-01-01');
    await expect(page.getByText('Actividad reciente')).toBeVisible();
  });
});

test.describe('Campus del estudiante', () => {
  test.use({ storageState: auth('student') });

  test('ve siguiente actividad, puntos y racha', async ({ page }) => {
    const engagement = await page.request.get(`${api}/academic/student/engagement`);
    expect(engagement.ok()).toBeTruthy();
    await page.goto('/dashboard');
    await expect(page.getByText('Tu campus de aprendizaje')).toBeVisible();
    await expect(page.getByText(/puntos de aprendizaje/i)).toBeVisible();
    await expect(page.getByText('Siguiente actividad')).toBeVisible();
  });
});
