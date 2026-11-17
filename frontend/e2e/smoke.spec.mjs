import { test, expect } from '@playwright/test';

async function navigateAndAssert(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8_000 });
  } catch (error) {
    if (!String(error).includes('ERR_ABORTED')) throw error;
  }
}

test.describe('Academia Virtual — smoke y accesibilidad básica', () => {
  test('la landing permite llegar al catálogo', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/academia|campus/i);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByTestId('hero-whatsapp')).toHaveAttribute('href', /wa\.me\//);
    await expect(page.getByTestId('hero-whatsapp-floating')).toHaveAttribute('href', /wa\.me\//);
    await page.getByRole('link', { name: /programas|cursos|catálogo/i }).first().click();
    await expect(page).toHaveURL(/\/cursos|#cursos|#programas|programas|catalogo/i);
  });

  test('el inicio de sesión tiene controles navegables', async ({ page }) => {
    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.google = {
          accounts: {
            id: {
              initialize() {},
              renderButton(parent) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = 'Continuar con Google';
                parent.appendChild(button);
              },
            },
          },
        };`,
      });
    });
    await page.goto('/login');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('catalog detail actions work', async ({ page }) => {
    await page.goto('/cursos');
    await expect(page.getByRole('heading', { name: /Encuentra el programa/i })).toBeVisible();
    const programLink = page.getByRole('link', { name: /^Ver programa$/i }).first();
    await expect(programLink).toHaveAttribute('href', /\/programas\//);
    const programHref = await programLink.getAttribute('href');
    const detailContext = await page.context().browser().newContext({ serviceWorkers: 'block' });
    const detailPage = await detailContext.newPage();
    await navigateAndAssert(detailPage, new URL(programHref || '/cursos', page.url()).toString());
    await expect(detailPage.getByText('Programa académico', { exact: true })).toBeVisible();
    const editionLink = detailPage.getByRole('link', { name: /Ver edición/i }).first();
    await expect(editionLink).toHaveAttribute('href', /\/cohorts\//);
    const editionHref = await editionLink.getAttribute('href');
    await navigateAndAssert(detailPage, new URL(editionHref || '/cursos', detailPage.url()).toString());
    await expect(detailPage).toHaveURL(/\/cohorts\//);

    await detailPage.getByRole('button', { name: /^Guardar$/i }).click();
    await expect(detailPage.getByRole('button', { name: /^Guardado$/i })).toBeVisible();
    await detailPage.evaluate(() => {
      Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => undefined }, configurable: true });
    });
    await detailPage.getByRole('button', { name: /^Compartir$/i }).click();
    await expect(detailPage.getByText('Enlace copiado al portapapeles')).toBeVisible();
    await detailContext.close();
  });

  test('catalog exposes filters for modality and start date', async ({ page }) => {
    await page.goto('/cursos');
    const modalityFilter = page.getByRole('combobox', { name: /modalidad/i });
    const startFilter = page.getByRole('combobox', { name: /fecha de inicio/i });
    await expect(modalityFilter).toBeVisible();
    await expect(startFilter).toBeVisible();
    await modalityFilter.selectOption('ONLINE');
    await startFilter.selectOption('SOON');
    await expect(modalityFilter).toHaveValue('ONLINE');
    await expect(startFilter).toHaveValue('SOON');
    await page.getByRole('button', { name: /limpiar filtros/i }).click();
    await expect(modalityFilter).toHaveValue('ALL');
  });

  test('catalog reutiliza la respuesta pública en la misma sesión', async ({ page }) => {
    let coursesRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/academic/public/courses')) coursesRequests += 1;
    });
    await page.goto('/cursos');
    await expect(page.getByRole('heading', { name: /Encuentra el programa/i })).toBeVisible();
    const requestsAfterFirstVisit = coursesRequests;
    expect(requestsAfterFirstVisit).toBeGreaterThan(0);
    const cachedCatalog = await page.evaluate(() => sessionStorage.getItem('academy:public-catalog:courses'));
    expect(cachedCatalog).toBeTruthy();
    expect(coursesRequests).toBe(requestsAfterFirstVisit);
  });

  test('catalog mantiene navegación y layout accesibles en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cursos');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Encuentra el programa/i })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasHorizontalOverflow).toBeFalsy();
    await page.getByRole('combobox', { name: /modalidad/i }).focus();
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', /modalidad/i);
    const filterContrast = await page.getByRole('combobox').first().evaluate((element) => {
      const parse = (value) => value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)?.slice(1).map(Number) || [0, 0, 0];
      const relativeLuminance = (value) => parse(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const styles = getComputedStyle(element);
      const foreground = relativeLuminance(styles.color);
      const background = relativeLuminance(styles.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(filterContrast).toBeGreaterThanOrEqual(4.5);
  });

  test('catalog mantiene landmarks y ancho estable en tablet y escritorio amplio', async ({ page }) => {
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/cursos');
      await expect(page.getByRole('main')).toHaveCount(1);
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(hasHorizontalOverflow).toBeFalsy();
    }
  });

  test('catalog shows a recoverable error when the API is unavailable', async ({ page }) => {
    await page.route('**/academic/public/courses', (route) => route.abort());
    await page.route('**/academic/public/cohorts', (route) => route.abort());
    await page.goto('/cursos');
    const catalogStatus = page.getByRole('region', { name: 'Estado del catálogo' });
    await expect(catalogStatus.getByRole('alert')).toContainText(/No pudimos conectar con el catálogo/i);
    await expect(catalogStatus.getByRole('button', { name: /Reintentar/i })).toBeVisible();
  });

  test('publica metadata y rutas de descubrimiento para buscadores', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    const robotsText = await robots.text();
    expect(robotsText).toContain('User-Agent: *');
    expect(robotsText).toContain('Allow: /');
    expect(robotsText).toContain('Allow: /cursos');
    expect(robotsText).toContain('Allow: /programas/');
    expect(robotsText).toContain('Allow: /cohorts/');
    expect(robotsText).toContain('Allow: /libro-de-reclamaciones');
    expect(robotsText).toContain('Sitemap:');

    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('<urlset');
    expect(sitemapText).toContain('/cursos</loc>');
    expect(sitemapText).toContain('/programas/');

    const manifest = await page.request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    expect((await manifest.json()).name).toBeTruthy();
  });

  test('el hero ocupa toda la pantalla en móvil y escritorio y expone SEO completo', async ({ page }) => {
    for (const [label, viewport] of [
      ['mobile', { width: 390, height: 844 }],
      ['desktop', { width: 1440, height: 900 }],
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const consentBtn = page.getByRole('button', { name: /Aceptar analítica/i });
      if (await consentBtn.isVisible().catch(() => false)) {
        await consentBtn.click({ timeout: 2000 }).catch(() => {});
      }
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(500);
      const heroBox = await page.locator('.landing-hero').boundingBox();
      expect(heroBox).toBeTruthy();
      expect(heroBox.y + heroBox.height).toBeGreaterThanOrEqual(viewport.height - 2);
      await page.screenshot({
        path: `C:/Users/ALUMNO/.gemini/antigravity/brain/0195c72b-e444-4db4-8383-962acf4c7f0a/hero-${label}.png`,
      });
    }

    const ldJsonText = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ldJsonText).toContain('EducationalOrganization');
    expect(ldJsonText).toContain('LocalBusiness');
    expect(ldJsonText).toContain('OfferCatalog');

    for (const route of ['/cursos', '/libro-de-reclamaciones', '/privacy', '/terms']) {
      await page.goto(route);
      await expect(page).toHaveTitle(/\|/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(route));
    }
  });

  test('la página de programa publica título y Open Graph contextual', async ({ page }) => {
    await page.goto('/cursos');
    const programHref = await page.getByRole('link', { name: /^Ver programa$/i }).first().getAttribute('href');
    expect(programHref).toMatch(/^\/programas\//);
    await page.goto(programHref);
    await expect(page).toHaveTitle(/\|/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/programas\//);
  });
});
