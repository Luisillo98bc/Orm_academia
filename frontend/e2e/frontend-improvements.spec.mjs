import { test, expect } from '@playwright/test';

const browserErrors = new WeakMap();
test.afterEach(async ({ page }) => { expect(browserErrors.get(page) || []).toEqual([]); });

const courses = ['HTML', 'React', 'Python', 'SQL'].map((name, i) => ({
  id: `course-${i}`, code: `C${i}`, name, description: `Aprende ${name}`, level: i ? 'INTERMEDIATE' : 'BEGINNER',
  durationHours: 20 + i * 10, isPublished: true,
}));
const cohorts = courses.map((course, i) => ({
  id: `cohort-${i}`, courseId: course.id, name: `${course.name} en vivo`, course,
  startDate: '2027-01-10T15:00:00Z', endDate: '2027-06-10T15:00:00Z', price: `${100 + i * 50}`,
  modality: 'ONLINE', schedule: 'Lunes 19:00 a 21:00', isActive: true,
  maxCapacity: 30, maxStudents: 30, enrolledCount: 5, enrollmentCount: 5, teachers: [],
}));
const enrollment = { id: 'enrollment-1', cohortId: cohorts[0].id, cohort: cohorts[0], status: 'ACTIVE' };
const activity = { id: 'activity-1', title: 'Proyecto final', kind: 'ASSIGNMENT', moduleId: 'module-1', weight: 100,
  maxScore: 20, dueDate: '2027-05-01T00:00:00Z', isPublished: true, allowLate: true, allowResubmit: true,
  rubric: [], questions: [], questionCount: 0, deliverables: [], quizAttempts: [] };
const modules = [{ id: 'module-1', title: 'Primer módulo', description: 'Contenido inicial', sessions: [], materials: [
  { id: 'material-1', title: 'Material completado', type: 'PDF', fileUrl: 'https://example.com/one.pdf' },
  { id: 'material-2', title: 'Material pendiente', type: 'PDF', fileUrl: 'https://example.com/two.pdf' },
] }];

async function fixture(page, role = 'ESTUDIANTE') {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  const state = { userId: 'student-a', enrollmentFailures: 0, submitted: false, mutations: [], overviewGate: null, catalogFailures: false };
  await page.addInitScript(() => {
    localStorage.setItem('academy_privacy_consent', JSON.stringify({ choice: 'necessary', version: '2026-09-05', recordedAt: new Date().toISOString() }));
  });
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    let body = [];
    if (path === '/auth/refresh') return route.fulfill({ json: { ok: true } });
    if (request.method() !== 'GET') {
      state.mutations.push({ path, body: request.postData() });
      if (path.endsWith('/submit')) state.submitted = true;
      return route.fulfill({ json: { id: 'saved', ok: true } });
    }
    if (path === '/users/me') body = { id: state.userId, email: 'test@example.local', firstName: 'Ana', lastName: 'Prueba', roles: [role], profileComplete: true };
    if (path === '/academic/public/courses') body = courses;
    if (path === '/academic/public/cohorts') body = cohorts;
    if (state.catalogFailures && path.startsWith('/academic/public/')) return route.fulfill({ status: 503, json: { message: 'Catálogo temporalmente no disponible' } });
    if (path === '/academic/enrollments/me') {
      if (state.enrollmentFailures-- > 0) return route.fulfill({ status: 503, json: { message: 'Matrículas temporalmente no disponibles' } });
      body = { data: [enrollment] };
    }
    if (path === '/academic/student/learning-overview') {
      if (state.overviewGate) await state.overviewGate;
      body = { nextClass: null, courses: [{ cohortId: cohorts[0].id, progressPercent: 50 }],
        pendingEvaluations: [{ id: activity.id, title: activity.title, cohortId: cohorts[0].id, courseName: 'HTML' }],
        engagement: { points: 30, streak: 2, badges: [], nextActivity: { type: 'evaluation', title: activity.title, cohortId: cohorts[0].id } } };
    }
    if (path.endsWith('/modules')) body = modules;
    if (path.endsWith('/my-progress')) body = { materialProgress: [{ materialId: 'material-1', completed: true }], progressPercent: 50, attendance: { rate: 0, records: [] }, grades: [], completedModules: 0, modules: 1, averageScore: 0 };
    if (path === '/certificates/me') body = { data: [] };
    if (path === '/evaluations/cohort/cohort-0') body = { data: [] };
    if (path === '/classroom/cohorts/cohort-0/evaluations') body = [{ ...activity, deliverables: state.submitted ? [{ id: 'delivery-1', status: 'PENDING', fileUrl: 'https://example.com/work', submittedAt: '2026-11-10T15:00:00Z', revisions: [], grade: null }] : [] }];
    if (path === '/academic/metrics') body = { totalRevenue: '250', totalStudents: 5, activeCohorts: 4, revenueByMonth: [] };
    if (path === '/prospects/stats') body = { byStatus: { NEW: 2 }, overdue: 0 };
    if (path === '/payments/pending') body = { data: [], pagination: { total: 0 } };
    if (path === '/payments/history') body = { data: [{ id: 'payment-history', status: 'REJECTED', amount: '100', method: 'YAPE', rejectionReason: 'Comprobante ilegible', createdAt: '2026-11-01T00:00:00Z', enrollment: { user: { firstName: 'Ana', lastName: 'Prueba', email: 'test@example.local' }, cohort: { name: 'HTML', course: { name: 'HTML' } } } }], pagination: { total: 1 } };
    if (path === '/academic/cohorts') body = cohorts;
    if (path === '/academic/data-quality') body = { score: 100, counts: { courses: 0, cohorts: 0, users: 0, payments: 0 } };
    if (path === '/academic/teacher/attention') body = { lowProgressStudents: [], pendingForums: [], pendingDeliverables: [], totals: { lowProgress: 0, pendingForums: 0 } };
    return route.fulfill({ json: body });
  });
  return state;
}

test('el historial de pagos muestra el motivo sin acciones de validación', async ({ page }) => {
  await fixture(page, 'ADMIN');
  await page.goto('/dashboard/payments');
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  await expect(page.getByText('Rechazado: Comprobante ilegible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Validar Pago' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rechazar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pendientes', exact: true }).click();
  await expect(page.getByText('No hay pagos pendientes por validar.')).toBeVisible();
});

test('los filtros se comparten en la URL y sobreviven a recarga y retorno', async ({ page }) => {
  await fixture(page);
  await page.goto('/cursos?level=BEGINNER&sort=PRICE_ASC');
  await expect(page.getByLabel('Filtrar por nivel')).toHaveValue('BEGINNER');
  await expect(page.getByRole('heading', { name: 'HTML', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'React', exact: true })).toHaveCount(0);
  await page.getByLabel('Buscar programas', { exact: true }).fill('HTML');
  await expect(page).toHaveURL(/q=HTML/);
  await page.reload();
  await expect(page.getByLabel('Buscar programas', { exact: true })).toHaveValue('HTML');
  const filteredUrl = page.url();
  await page.goto('/login');
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(page.getByLabel('Filtrar por nivel')).toHaveValue('BEGINNER');
  await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  await expect(page.getByLabel('Ordenar programas')).toHaveValue('START_ASC');
});

test('compara hasta tres programas y el foco permanece dentro de la ventana', async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto('/cursos');
  for (const name of ['HTML', 'React', 'Python']) await page.getByRole('checkbox', { name: `Comparar ${name}`, exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Comparar SQL', exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/compare=/);
  const trigger = page.getByRole('button', { name: 'Comparar programas', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Comparar programas', exact: true });
  await expect(dialog.getByRole('cell', { name: 'S/ 100.00', exact: true })).toBeVisible();
  await expect(dialog.getByRole('rowheader', { name: 'Horario', exact: true })).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('comparador.png') });
  await page.emulateMedia({ media: 'print' });
  await expect(dialog).toHaveCSS('overflow', 'visible');
  await page.emulateMedia({ media: 'screen' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Quitar selección' }).click();
  await expect(trigger).toBeDisabled();
});

test('un fallo de catálogo muestra recuperación y no se confunde con cero resultados', async ({ page }) => {
  const state = await fixture(page);
  state.catalogFailures = true;
  await page.goto('/cursos');
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos conectar' })).toBeVisible();
  await expect(page.getByText('No encontramos programas con esos filtros.', { exact: true })).toHaveCount(0);
  state.catalogFailures = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'HTML', exact: true })).toBeVisible();
});

test('los parámetros desconocidos no bloquean filtros ni el comparador', async ({ page }) => {
  await fixture(page);
  await page.goto('/cursos?level=INVALID&sort=INVALID&compare=missing,course-0,course-0');
  await expect(page.getByLabel('Filtrar por nivel')).toHaveValue('ALL');
  await expect(page.getByLabel('Ordenar programas')).toHaveValue('START_ASC');
  await expect(page.getByRole('checkbox', { name: 'Comparar HTML', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Comparar React', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Comparar programas', exact: true })).toBeEnabled();
});

test('los cursos cargan aunque la sección de progreso siga pendiente', async ({ page }) => {
  const state = await fixture(page);
  let release;
  state.overviewGate = new Promise((resolve) => { release = resolve; });
  await page.goto('/dashboard');
  try {
    await expect(page.getByRole('heading', { name: 'Mis Cursos Activos' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Cargando tu progreso y actividades' })).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('link', { name: /Continuar curso/ })).toHaveAttribute('href', '/dashboard/my-courses/cohort-0?resume=1');
});

test('un fallo de matrículas tiene reintento y no muestra métricas de cero cursos', async ({ page }) => {
  const state = await fixture(page);
  state.enrollmentFailures = 1;
  await page.goto('/dashboard');
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos cargar tus cursos' })).toBeVisible();
  await expect(page.getByText('Matrículas vigentes', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar tus cursos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis Cursos Activos' })).toBeVisible();
});

test('continuar selecciona y enfoca el primer material sin completar', async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto('/dashboard/my-courses/cohort-0?resume=1');
  await expect(page.getByText('Siguiente material pendiente', { exact: true })).toBeVisible();
  await expect(page.locator('#material-material-2')).toBeFocused();
  await expect(page.locator('#material-material-1')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('continuar-curso.png') });
});

test('la evaluación pendiente abre y enfoca su actividad exacta', async ({ page }) => {
  await fixture(page);
  await page.goto('/dashboard');
  const link = page.getByRole('link').filter({ hasText: 'Proyecto final' }).first();
  await expect(link).toHaveAttribute('href', '/dashboard/aula/cohort-0#activity-activity-1');
  await link.click();
  await expect(page.locator('#activity-activity-1')).toBeFocused();
  await expect(page.getByRole('form', { name: 'Entregar Proyecto final' })).toBeVisible();
});

test('el borrador se recupera por usuario y se elimina después de enviar', async ({ page }) => {
  const state = await fixture(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/dashboard/aula/cohort-0');
  const form = page.getByRole('form', { name: 'Entregar Proyecto final' });
  await form.getByLabel('Enlace a tu trabajo', { exact: true }).fill('https://example.com/work');
  await form.getByLabel('Comentario al docente').fill('Mi borrador');
  await page.reload();
  await expect(form.getByLabel('Comentario al docente')).toHaveValue('Mi borrador');
  state.userId = 'student-b';
  await page.reload();
  await expect(form.getByLabel('Comentario al docente')).toHaveValue('');
  state.userId = 'student-a';
  await page.reload();
  await expect(form.getByLabel('Comentario al docente')).toHaveValue('Mi borrador');
  await form.getByRole('button', { name: 'Enviar entrega' }).click();
  await expect.poll(() => state.submitted).toBeTruthy();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('academy:submission-draft:student-a:activity-1'))).toBeNull();
  expect(state.mutations.filter((request) => request.path.endsWith('/submit'))).toHaveLength(1);
});

test('salir con una entrega pendiente permite cancelar o conservar el borrador', async ({ page }) => {
  await fixture(page);
  await page.goto('/dashboard/aula/cohort-0');
  await page.getByLabel('Comentario al docente').fill('Sin enviar');
  await page.getByRole('link', { name: '← Volver al curso', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: '¿Salir sin enviar la entrega?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(/\/aula\//);
  await page.getByRole('link', { name: '← Volver al curso', exact: true }).click();
  await dialog.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/cohort-0/);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('academy:submission-draft:student-a:activity-1')).comment)).toBe('Sin enviar');
});

test('formularios administrativos mantienen etiquetas, validación y foco al cerrar', async ({ page }) => {
  const state = await fixture(page, 'ADMIN');
  await page.goto('/dashboard');
  const trigger = page.getByRole('button', { name: /Crear Curso Añadir nuevo curso/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Crear curso', exact: true });
  await expect(dialog.getByLabel('Código', { exact: true })).toBeVisible();
  await dialog.getByLabel('Código', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Crear', exact: true }).click();
  expect(state.mutations).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('la navegación móvil queda visible sin cubrir el contenido', async ({ page, isMobile }, testInfo) => {
  await fixture(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Tu campus de aprendizaje' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Accesos rápidos del campus' });
  if (isMobile) {
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Inicio', exact: true })).toHaveAttribute('aria-current', 'page');
    const geometry = await page.evaluate(() => ({
      content: document.querySelector('.dashboard-content').getBoundingClientRect().bottom,
      nav: document.querySelector('.mobile-campus-nav').getBoundingClientRect().top,
    }));
    expect(geometry.content).toBeLessThanOrEqual(geometry.nav + 1);
    await nav.getByRole('link', { name: 'Mis cursos', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/my-courses$/);
  } else await expect(nav).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('campus.png') });
});

test('docente y administración conservan las secciones disponibles cuando falla otra consulta', async ({ page }) => {
  await fixture(page, 'DOCENTE');
  await page.route('**/api/v1/academic/teacher/attention', (route) => route.fulfill({ status: 503, json: { message: 'Servicio temporalmente no disponible' } }));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Mis Clases (Cohortes Asignadas)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar acompañamiento de alumnos' })).toBeVisible();
  await expect(page.getByText('No hay alertas de progreso por atender.', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/v1/academic/teacher/attention');
  await page.getByRole('button', { name: 'Reintentar acompañamiento de alumnos' }).click();
  await expect(page.getByText('No hay alertas de progreso por atender.', { exact: true })).toBeVisible();
});

test('un error de finanzas no oculta indicadores ni muestra pagos pendientes falsos', async ({ page }) => {
  await fixture(page, 'ADMIN');
  await page.route('**/api/v1/payments/pending?*', (route) => route.fulfill({ status: 503, json: { message: 'Finanzas no disponibles' } }));
  await page.goto('/dashboard');
  await expect(page.getByText('Ingresos totales', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar prioridades operativas' })).toBeVisible();
  await expect(page.getByText('Pagos por validar', { exact: true })).toHaveCount(0);
});

test('una entrega fallida conserva el borrador y la validación evita enviar enlaces inválidos', async ({ page }) => {
  const state = await fixture(page);
  await page.route('**/api/v1/classroom/evaluations/activity-1/submit', (route) => route.fulfill({ status: 503, json: { message: 'No se pudo enviar' } }));
  await page.goto('/dashboard/aula/cohort-0');
  const form = page.getByRole('form', { name: 'Entregar Proyecto final' });
  await form.getByLabel('Enlace a tu trabajo', { exact: true }).fill('enlace-invalido');
  await form.getByRole('button', { name: 'Enviar entrega' }).click();
  expect(state.mutations).toHaveLength(0);
  await form.getByLabel('Enlace a tu trabajo', { exact: true }).fill('https://example.com/work');
  await form.getByLabel('Comentario al docente').fill('Conservar este trabajo');
  await form.getByRole('button', { name: 'Enviar entrega' }).click();
  await expect(form.getByRole('alert')).toHaveText('No se pudo enviar');
  await expect(form.getByLabel('Comentario al docente')).toHaveValue('Conservar este trabajo');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('academy:submission-draft:student-a:activity-1')).comment)).toBe('Conservar este trabajo');
});

test('el catálogo y el campus conservan su ancho en móvil pequeño, tablet y escritorio amplio', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'Los tamaños adicionales se validan una vez en el proyecto de escritorio.');
  await fixture(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/cursos');
    await expect(page.getByRole('checkbox', { name: 'Comparar HTML', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Tu campus de aprendizaje' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const heading = document.querySelector('.page-intro h1');
      const sample = document.createElement('span');
      sample.style.color = 'hsl(var(--foreground))';
      heading.append(sample);
      const matches = getComputedStyle(heading).color === getComputedStyle(sample).color;
      sample.remove();
      return matches;
    })).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    if (width === 768) await page.screenshot({ path: testInfo.outputPath('campus-tablet-oscuro.png') });
  }
});
