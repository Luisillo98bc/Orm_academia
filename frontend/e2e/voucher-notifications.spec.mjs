import { test, expect } from '@playwright/test';

async function fixture(page, voucherStatus = 201) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = { voucherStarted: false, release: null, read: false, errors };
  const gate = new Promise(resolve => { state.release = resolve; });
  await page.addInitScript(() => {
    localStorage.setItem('academy_privacy_consent', JSON.stringify({ choice: 'necessary', version: '2026-09-05', recordedAt: new Date().toISOString() }));
  });
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    let body = [];
    if (path === '/users/me') body = { id: 'student-fixture', email: 'fixture@example.invalid', firstName: 'Ana', lastName: 'Prueba', roles: ['ESTUDIANTE'], phone: '999111222', profileComplete: true };
    if (path === '/settings/public') body = { whatsappNumber: '', platformName: 'Academia' };
    if (path === '/academic/public/cohorts') body = [{
      id: 'cohort-fixture', courseId: 'course-fixture', name: 'Python en vivo',
      course: { id: 'course-fixture', name: 'Python', level: 'BEGINNER', durationHours: 20 },
      price: '100.00', discountPercentage: 0, isActive: true, teachers: [], maxStudents: 30,
      startDate: '2027-01-10T15:00:00Z', endDate: '2027-06-10T15:00:00Z',
    }];
    if (path === '/payments/checkout') body = { payment: { id: 'payment-fixture', status: 'PENDING' }, enrollment: { id: 'enrollment-fixture', status: 'PENDING_PAYMENT' }, operationNumber: 'ORD-TEST' };
    if (path === '/payments/payment-fixture/voucher') {
      expect(req.headers()['content-type']).toContain('multipart/form-data; boundary=');
      expect(req.postDataBuffer().toString()).toContain('fixture.pdf');
      state.voucherStarted = true;
      await gate;
      return route.fulfill({ status: voucherStatus, json: voucherStatus === 201 ? { id: 'payment-fixture', voucherUrl: 'storage://local/vouchers/fixture.pdf' } : { message: 'El antivirus no está disponible. Intenta nuevamente.' } });
    }
    if (path === '/payments/my-payments') body = { data: [], pagination: { total: 0 } };
    if (path === '/communication/notifications') body = [{ id: 'notice-fixture', title: 'Comprobante recibido', message: 'Tu pago está pendiente de revisión', isRead: state.read, type: 'payment', createdAt: new Date().toISOString(), actionUrl: '/dashboard/my-payments' }];
    if (path.includes('/communication/notifications/') && req.method() === 'PATCH') { state.read = true; body = { ok: true }; }
    return route.fulfill({ json: body });
  });
  return state;
}

test('notificaciones se cierran fuera, con Escape, con X y al salir con teclado', async ({ page }, testInfo) => {
  const state = await fixture(page);
  await page.goto('/dashboard/my-payments');
  const bell = page.getByRole('button', { name: 'Notificaciones', exact: true });
  const panel = page.getByRole('region', { name: 'Notificaciones recientes' });
  await bell.click();
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({ path: testInfo.outputPath('notifications-open.png') });
  await panel.getByText('Comprobante recibido', { exact: true }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Marcar leídas', exact: true }).click();
  await expect(panel).toBeVisible();
  await page.mouse.click(8, page.viewportSize().height - 100);
  await expect(panel).toHaveCount(0);
  await expect(bell).toHaveAttribute('aria-expanded', 'false');
  await bell.click();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(bell).toBeFocused();
  await bell.click();
  await panel.getByRole('button', { name: 'Cerrar notificaciones' }).click();
  await expect(panel).toHaveCount(0);
  await expect(bell).toBeFocused();
  await bell.click();
  await panel.getByRole('link', { name: 'Ver todas las notificaciones' }).focus();
  await page.keyboard.press('Tab');
  await expect(panel).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

for (const status of [201, 503]) {
  test(`comprobante ${status}: termina la carga y muestra el resultado`, async ({ page }) => {
    const state = await fixture(page, status);
    try {
      await page.goto('/dashboard/checkout?cohortId=cohort-fixture');
      await page.getByRole('button', { name: /Registrar.*solicitud|Continuar|Reservar/i }).last().click();
      await expect(page.getByRole('heading', { name: 'Subir Comprobante de Pago' })).toBeVisible();
      await page.locator('#voucher-upload').setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n%%EOF') });
      const send = page.getByRole('button', { name: 'Enviar Comprobante a Admisión' });
      await send.click();
      await expect.poll(() => state.voucherStarted).toBe(true);
      await expect(send).toBeDisabled();
      state.release();
      if (status === 201) await expect(page.getByRole('heading', { name: '¡Comprobante enviado a Admisión!' })).toBeVisible();
      else await expect(page.getByText('El antivirus no está disponible. Intenta nuevamente.', { exact: true })).toBeVisible();
      expect(state.errors).toEqual([]);
    } finally { state.release(); }
  });
}
