import { test, expect } from '@playwright/test';

const user = { id: 'admin-1', firstName: 'Ana', lastName: 'Torres', email: 'ana@example.local', roles: ['ADMIN'], isActive: true, profileComplete: true, dni: '12345678', phone: '987654321', address: 'Av. Principal 123', district: 'Lima', province: 'Lima', department: 'Lima' };
const course = { id: 'course-1', name: 'React profesional', code: 'REACT', description: 'Construye aplicaciones modernas.', level: 'BEGINNER', durationHours: 40, isPublished: false, whatYouWillLearn: 'Componentes y estado', requirements: 'JavaScript básico' };
const cohort = { id: 'cohort-1', name: 'React enero', courseId: course.id, course, isActive: true, startDate: '2027-01-10T15:00:00Z', endDate: '2027-06-30T15:00:00Z', maxStudents: 20, maxCapacity: 20, enrollmentCount: 5, enrolledCount: 5, price: '150.00', teachers: [], schedule: 'Lunes 19:00' };
const student = { ...user, id: 'student-1', firstName: 'Luis', lastName: 'Pérez', email: 'luis@example.local', roles: ['ESTUDIANTE'] };
const payment = { id: 'd27cad72-c510-41de-950a-f87f132986d5', amount: '150', method: 'YAPE', status: 'PENDING', createdAt: '2026-11-01T15:00:00Z', voucherUrl: null, enrollment: { user: student, cohort } };
const enrollment = { id: 'enrollment-1', status: 'ACTIVE', enrolledAt: '2026-11-01T15:00:00Z', completedAt: null, user: student, cohort, payment };
const contract = { id: 'contract-1', type: 'FIXED_TERM', status: 'SENT', startDate: '2026-11-01', endDate: '2027-05-01', agreedSalary: '2500', isActive: true, worker: { user: student } };
const worker = { id: 'worker-1', user: student, department: 'Académico', position: 'Docente', status: 'ACTIVE', baseSalary: '2500', documentNumber: '12345678' };
const prospect = { id: 'prospect-1', name: 'María Rojas', email: 'maria@example.local', phone: '987654321', source: 'MANUAL', status: 'NEW', nextFollowUpAt: '2026-01-01T15:00:00Z', createdAt: '2026-10-01T15:00:00Z', notes: [], cohort };
const ticket = { id: 'ticket-1', subject: 'Acceso al curso', description: 'Necesito revisar el acceso.', status: 'OPEN', priority: 'HIGH', category: 'ACADEMIC', createdAt: '2026-11-01T15:00:00Z', assignee: null, _count: { messages: 1 }, messages: [{ id: 'reply-1', body: 'Estamos revisando tu solicitud.', createdAt: '2026-11-02T15:00:00Z', author: user }] };
const audit = { id: 'log-1', action: 'LOGIN', entity: 'User', createdAt: '2026-11-01T15:00:00Z', user, newValue: { status: 'success' } };

async function fixture(page) {
  const state = { mutations: [], requests: [], drafts: [], paymentFailures: false };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (window.top === window) localStorage.setItem('academy_privacy_consent', JSON.stringify({ choice: 'necessary', version: '2026-09-05', recordedAt: new Date().toISOString() }));
  });
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    state.requests.push({ path, query: Object.fromEntries(url.searchParams) });
    if (request.method() !== 'GET') {
      const body = request.postDataJSON();
      state.mutations.push({ path, body });
      if (path === '/communication/announcements') state.drafts.push({ id: 'announcement-1', ...body, createdAt: new Date().toISOString(), author: user });
      return route.fulfill({ json: { executed: true, ok: true, id: 'saved' } });
    }
    let body = [];
    if (path.endsWith('/contracts/contract-1/pdf')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF' });
    const pageData = data => ({ data, pagination: { total: data.length, page: 1, limit: 20, totalPages: 1 } });
    if (path === '/users/me') body = user;
    if (path === '/users') body = pageData(url.searchParams.get('role') === 'DOCENTE' ? [] : [student]);
    if (path === '/users/trash') body = [{ ...student, deletedAt: '2026-11-01' }];
    if (path === '/academic/courses') body = [course];
    if (path === '/academic/cohorts') body = [cohort];
    if (path === '/academic/metrics') body = { totalRevenue: '150', totalStudents: 5, activeCohorts: 1, revenueByMonth: [{ month: 'Oct', revenue: '100' }, { month: 'Nov', revenue: '150' }] };
    if (path === '/academic/data-quality') body = { score: 80, counts: { courses: 1, cohorts: 1, users: 0, payments: 0 } };
    if (path === '/academic/enrollment-management') body = { ...pageData([enrollment]), summary: { total: 1, active: 1, pending: 0, completed: 0 } };
    if (path === '/academic/calendar-events') body = [{ id: 'event-1', type: 'class', title: 'Sesión de componentes', date: new Date().toISOString(), courseName: course.name, cohortName: cohort.name }];
    if (path === '/prospects') body = pageData([prospect]);
    if (path === '/prospects/stats') body = { byStatus: { NEW: 1 }, overdue: 1 };
    if (path === '/payments/pending') {
      if (state.paymentFailures) return route.fulfill({ status: 503, json: { message: 'Pagos temporalmente no disponibles' } });
      body = pageData([payment]);
    }
    if (path === '/payments/history') body = pageData([{ ...payment, status: 'REJECTED', rejectionReason: 'Comprobante ilegible' }]);
    if (path === '/rrhh/workers') body = pageData([worker]);
    if (path === '/rrhh/attendance') body = [{ worker: { ...worker, name: 'Luis Pérez' }, attendance: { status: 'PRESENT' } }];
    if (path === '/rrhh/attendance/monthly') body = [{ ...worker, name: 'Luis Pérez', counts: { PRESENT: 10, LATE: 2, ABSENT: 1 } }];
    if (path === '/rrhh/payroll') body = { ...pageData([{ id: 'payroll-1', worker, period: '2026-11', baseSalary: '2500', bonuses: '100', deductions: '0', totalAmount: '2600', status: 'PENDING' }]), summary: { totalAmount: '2600' } };
    if (path === '/rrhh/contracts') body = pageData([contract]);
    if (path === '/rrhh/contracts/me') body = [contract];
    if (path === '/certificates' || path === '/certificates/pending') body = pageData([]);
    if (path === '/communication/announcements/manage') body = state.drafts;
    if (path === '/communication/cohorts/cohort-1/forums') body = [{ id: 'forum-1', title: 'Dudas de React', description: 'Comparte tus dudas', isActive: true, createdAt: '2026-11-01', _count: { messages: 0 } }];
    if (path === '/communication/direct-messages/contacts') body = [student];
    if (path === '/communication/direct-messages/unread-by-contact') body = { 'student-1': 2 };
    if (path === '/communication/direct-messages/student-1') body = [{ id: 'message-1', senderId: student.id, receiverId: user.id, content: 'Consulta sobre React', isRead: false, createdAt: '2026-11-01T15:00:00Z', sender: student }];
    if (path === '/communication/notifications/page') body = { data: [{ id: 'notification-1', title: 'Pago por revisar', message: 'Valida el comprobante.', type: 'payment', isRead: false, actionUrl: '/dashboard/payments', createdAt: '2026-11-01T15:00:00Z' }], total: 1, unread: 1 };
    if (path === '/communication/notifications/preferences') body = {};
    if (path === '/settings' || path === '/settings/public') body = { academyName: 'Academia Virtual', primaryColor: '#168f80', certificateTemplate: {} };
    if (path === '/auth/2fa/status') body = { enabled: false };
    if (path === '/audit-logs') body = { data: [audit], total: 1 };
    if (path === '/audit-logs/security-summary') body = { failedLogins: 0, successfulLogins: 1, activeSessions: 1, adminsWithoutTwoFactor: 0, riskLevel: 'NORMAL' };
    if (path === '/automation/status') body = { enabled: false, lastRunAt: null, lastResult: null, history: [] };
    if (path === '/health/details') body = { status: 'ok', database: 'up', databaseLatencyMs: 10, timestamp: new Date().toISOString(), environment: 'test', version: '1', integrations: { smtp: false, whatsapp: false, storage: 'local' }, schedulers: {} };
    if (path === '/health/metrics') body = { users: 1, activeEnrollments: 1, openTickets: 1, failedDeliveries: 0, failedLogins: 0, responseTimeMs: 10 };
    if (path === '/support/tickets') body = [ticket];
    if (path === '/support/tickets/ticket-1') body = ticket;
    if (path === '/academic/trash') body = { courses: [{ ...course, deletedAt: '2026-11-01' }], cohorts: [] };
    if (path === '/reports/summary') body = { totalUsers: 1, totalCourses: 1, activeCohorts: 1, totalEnrollments: 1, totalRevenue: '150', pendingPayments: 1 };
    if (path === '/reports/financial-profitability') body = { revenue: '150', costs: '50', profit: '100', margin: 66, projectedRevenue: '200', costsCount: 1 };
    if (path === '/analytics/conversion') body = { days: 30, funnel: [], landingToCheckoutRate: 0, checkoutConversionRate: 0, whatsappClicks: 0, failures: 0, pendingPayments: 1, completedRevenue: '150' };
    if (path === '/analytics/retention') body = { days: 180, summary: { enrolled: 1, active: 1, completed: 0, atRisk: 0, retention7d: 100, retention30d: 100 }, cohorts: [] };
    if (path === '/analytics/operational-overview') body = { notificationDeliveries: [] };
    return route.fulfill({ json: body });
  });
  return { state, errors };
}

test('directorio busca en el servidor y abre la ficha con pestañas', async ({ page }) => {
  const { state, errors } = await fixture(page);
  await page.goto('/dashboard/users');
  await page.getByLabel('Buscar en el directorio').fill('Luis');
  await expect.poll(() => state.requests.some(request => request.path === '/users' && request.query.search === 'Luis')).toBe(true);
  await page.getByRole('button', { name: 'Ver ficha de Luis Pérez' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ficha de Luis Pérez' });
  await dialog.getByRole('tab', { name: 'Matrículas', exact: true }).click();
  await expect(dialog.getByText('React profesional', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('cursos muestran faltantes y cohortes muestran ocupación', async ({ page }) => {
  const { errors } = await fixture(page);
  await page.goto('/dashboard/courses');
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Revisa antes de publicar: portada.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/dashboard/cohorts');
  await expect(page.getByRole('meter', { name: 'Ocupación de React enero' })).toHaveAttribute('aria-valuenow', '5');
  await page.getByLabel('Buscar cohorte').fill('No existe');
  await expect(page.getByText('No hay cohortes que coincidan con esta vista.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reportes y configuración separan áreas y conservan cambios', async ({ page }) => {
  const { errors } = await fixture(page);
  await page.goto('/dashboard/reports');
  await page.getByRole('tab', { name: 'Finanzas y costos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rentabilidad financiera' })).toBeVisible();
  await page.goto('/dashboard/settings');
  await page.getByLabel('Nombre comercial', { exact: true }).fill('Academia renovada');
  await expect(page.getByText('Tienes cambios sin guardar')).toBeVisible();
  await page.getByRole('tab', { name: 'Certificados', exact: true }).click();
  await page.getByRole('tab', { name: 'Institución', exact: true }).click();
  await expect(page.getByLabel('Nombre comercial', { exact: true })).toHaveValue('Academia renovada');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Configuración guardada', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('calendario y prospectos ofrecen vistas de trabajo', async ({ page }) => {
  const { errors } = await fixture(page);
  await page.goto('/dashboard/calendar');
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('listitem').getByText('Sesión de componentes')).toBeVisible();
  await page.goto('/dashboard/prospects');
  await page.getByRole('button', { name: 'Tablero por etapas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Tablero comercial' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tablero comercial' }).getByText('María Rojas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('pagos filtra toda la colección y permite recuperarse de errores', async ({ page }) => {
  const { state, errors } = await fixture(page);
  await page.goto('/dashboard/payments');
  await page.getByLabel('Buscar por nombre, curso, método...').fill('Luis');
  await expect.poll(() => state.requests.some(request => request.path === '/payments/pending' && request.query.search === 'Luis')).toBe(true);
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByLabel('Método de pago', { exact: true }).selectOption('YAPE');
  await expect(page.getByRole('button', { name: 'Filtros (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  await expect(page.getByText('Rechazado: Comprobante ilegible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Validar Pago', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('asistencia mensual y restauración conservan controles claros', async ({ page }) => {
  const { state, errors } = await fixture(page);
  await page.goto('/dashboard/rrhh/attendance');
  await page.getByRole('tab', { name: 'Resumen mensual', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Tardanzas', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '10', exact: true })).toBeVisible();
  await page.goto('/dashboard/trash');
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar registro', exact: true }).click();
  await expect.poll(() => state.mutations.some(mutation => mutation.path === '/academic/courses/course-1/restore')).toBe(true);
  expect(errors).toEqual([]);
});

test('anuncios guardan borradores y muestran su vista previa', async ({ page }) => {
  const { state, errors } = await fixture(page);
  await page.goto('/dashboard/announcements');
  await page.getByRole('button', { name: /Nuevo Anuncio/i }).click();
  await page.getByPlaceholder('Ej: ¡Nuevos cursos disponibles para el próximo mes!').fill('Nuevo programa');
  await page.getByPlaceholder('Escribe el mensaje detallado...').fill('Inscripciones abiertas para el programa de React.');
  await page.getByLabel('Publicar al guardar.', { exact: false }).uncheck();
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect.poll(() => state.mutations.some(mutation => mutation.path === '/communication/announcements' && mutation.body.isActive === false)).toBe(true);
  expect(errors).toEqual([]);
});

test('favoritos persisten y las pestañas se operan con teclado', async ({ page }) => {
  const { errors } = await fixture(page);
  await page.goto('/dashboard/users');
  await expect(page.getByRole('heading', { name: 'Directorio de usuarios', exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Abrir menú', exact: true }).isVisible()) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir Usuarios a favoritos', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Favoritos', exact: true })).toBeVisible();
  if (await page.getByRole('dialog', { name: 'Navegación del campus', exact: true }).isVisible()) {
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab');
      await expect.poll(() => page.evaluate(() => document.querySelector('dialog[open]')?.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Directorio de usuarios', exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Abrir menú', exact: true }).isVisible()) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Favoritos', exact: true })).toBeVisible();
  if (await page.getByRole('dialog', { name: 'Navegación del campus', exact: true }).isVisible()) await page.keyboard.press('Escape');
  await page.goto('/dashboard/settings');
  await page.getByRole('tab', { name: 'Institución', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Certificados', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Certificados', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('configuración advierte al salir y un fallo de pagos permite reintentar', async ({ page }) => {
  const { state, errors } = await fixture(page);
  await page.goto('/dashboard/settings');
  await page.getByLabel('Nombre comercial', { exact: true }).fill('Cambios pendientes');
  await page.getByRole('navigation', { name: 'Ubicación actual' }).getByRole('link', { name: 'Administración', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: '¿Salir sin guardar la configuración?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  state.paymentFailures = true;
  await page.goto('/dashboard/payments');
  await expect(page.getByRole('alert').getByText('Pagos temporalmente no disponibles')).toBeVisible();
  state.paymentFailures = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('luis@example.local', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('todos los módulos cargan sin errores y sin desbordar la pantalla', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const { errors } = await fixture(page);
  const modules = ['', 'courses', 'users', 'cohorts', 'calendar', 'rrhh/enrollments', 'rrhh/workers', 'rrhh/attendance', 'rrhh/payroll', 'rrhh/contracts', 'my-contracts', 'payments', 'certificates', 'messages', 'announcements', 'forums', 'reports', 'prospects', 'audit', 'system', 'automations', 'trash', 'settings', 'notifications', 'support', 'profile'];
  const overflows = [];
  for (const section of modules) {
    await page.goto(`/dashboard/${section}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.dashboard-content .animate-spin')).toHaveCount(0);
    await expect(page.locator('.dashboard-content .shimmer-loading')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), { message: `Overflow en ${section || 'inicio'}` }).toBe(true);
    const dimensions = await page.locator('.dashboard-content').evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    if (dimensions.scroll > dimensions.client + 1) overflows.push({ section, ...dimensions });
    expect(errors, section).toEqual([]);
    if (['', 'users', 'cohorts', 'reports', 'settings'].includes(section)) await page.screenshot({ path: testInfo.outputPath(`${section || 'inicio'}.png`) });
  }
  expect(overflows).toEqual([]);
});

test('el modo oscuro y movimiento reducido conservan las vistas en móvil, tablet y escritorio', async ({ page }, testInfo) => {
  const { errors } = await fixture(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Panel de administración', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('.dashboard-content .shimmer-loading')).toHaveCount(0);
    await expect.poll(() => page.locator('.dashboard-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.getByRole('tab', { name: 'Calidad de datos', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Calidad de datos', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => page.getByRole('tab', { name: 'Calidad de datos', exact: true }).evaluate(element => getComputedStyle(element).borderBottomColor)).not.toBe('rgba(0, 0, 0, 0)');
    await expect.poll(() => page.getByRole('tab', { name: 'Prioridades de hoy', exact: true }).evaluate(element => getComputedStyle(element).borderBottomColor)).toBe('rgba(0, 0, 0, 0)');
    await expect(page.getByRole('region', { name: 'Calidad de datos', exact: true })).toBeVisible();
    await expect.poll(() => page.getByRole('heading', { name: 'Panel de administración', exact: true }).evaluate(element => {
      const sample = document.createElement('span');
      sample.style.color = 'hsl(var(--foreground))';
      element.append(sample);
      const matches = getComputedStyle(element).color === getComputedStyle(sample).color;
      sample.remove();
      return matches;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dark-${width}.png`) });
  }
  expect(errors).toEqual([]);
});

test('contratos cargan documentos protegidos y nómina confirma antes de registrar pagos', async ({ page }) => {
  const { state, errors } = await fixture(page);
  await page.goto('/dashboard/rrhh/contracts');
  await page.getByRole('button', { name: 'Ver documento', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Documento del contrato', exact: true }).locator('iframe')).toHaveAttribute('src', /^blob:/);
  await page.keyboard.press('Escape');
  await page.goto('/dashboard/rrhh/payroll');
  await page.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Registrar pago de nómina', exact: true })).toBeVisible();
  expect(state.mutations.some(mutation => mutation.path.endsWith('/payroll-1/pay'))).toBe(false);
  await page.getByRole('button', { name: 'Registrar pago', exact: true }).click();
  await expect.poll(() => state.mutations.some(mutation => mutation.path.endsWith('/payroll-1/pay'))).toBe(true);
  expect(errors).toEqual([]);
});

test('comunicación permite buscar mensajes y priorizar soporte', async ({ page }) => {
  const { state, errors } = await fixture(page);
  await page.goto('/dashboard/messages');
  await page.getByRole('button').filter({ hasText: 'Luis Pérez' }).click();
  await page.getByLabel('Buscar en mensajes cargados', { exact: true }).fill('Consulta');
  await expect(page.getByText('Consulta sobre React', { exact: true })).toBeVisible();
  await page.goto('/dashboard/forums');
  await page.getByLabel('Sin respuestas (1)', { exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Dudas de React', exact: true })).toBeVisible();
  await page.goto('/dashboard/support');
  await page.getByRole('combobox', { name: 'Prioridad', exact: true }).selectOption('HIGH');
  await expect.poll(() => state.requests.some(request => request.path === '/support/tickets' && request.query.priority === 'HIGH')).toBe(true);
  await expect(page.getByText('Sin responsable', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
