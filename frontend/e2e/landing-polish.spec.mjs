import { test, expect } from '@playwright/test';

test('landing aligns its sections and animates real totals accessibly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    let body = [];
    if (path.endsWith('/settings/public')) body = { academyName: 'Academia' };
    if (path.endsWith('/stats')) body = { students: 1240, courses: 24, cohorts: 12, certificates: 860 };
    if (path.endsWith('/cohorts')) body = [{ id: 'preview', name: 'Excel en vivo', isActive: true,
      startDate: '2099-01-10', endDate: '2099-06-10', price: '150', teachers: [], course: { id: 'excel', name: 'Excel', level: 'BEGINNER', description: 'Aprende desde cero.' } }];
    if (path.endsWith('/announcements/public')) body = [{ id: 'offer', title: 'Impulsa tu aprendizaje', content: 'Promociones para nuevos estudiantes.', ctaText: 'Ver programas', ctaUrl: '/programs' }];
    return route.fulfill({ json: body });
  });
  await page.goto('/');
  const stats = page.locator('.landing-stats');
  await expect(stats).toBeVisible();
  await expect(page.locator('.landing-advisor')).toBeVisible();
  await expect(page.locator('.landing-announcements-section h3')).toHaveText('Impulsa tu aprendizaje');
  // Scroll without smooth behavior to observe the counter's intermediate value.
  await stats.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  const total = stats.locator('span[aria-hidden="true"]').filter({ hasText: /^\+/ }).first();
  await expect.poll(() => total.textContent()).not.toBe('+1,240');
  await expect(total).toHaveText('+1,240');
  await expect(stats.locator('.sr-only').filter({ hasText: '+1,240' })).toHaveCount(1);
  await expect(stats.locator('[data-landing-revealed="true"]')).toHaveCount(1);
  const advanced = page.locator('.landing-advisor button').filter({ hasText: 'Avanzado' });
  await advanced.click();
  await expect(advanced).toHaveAttribute('aria-pressed', 'true');
  for (const width of [390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.evaluate(() => {
      const hero = document.querySelector('.landing-hero-shell');
      const rect = hero.getBoundingClientRect();
      const style = getComputedStyle(hero);
      const left = rect.left + parseFloat(style.paddingLeft);
      const right = rect.right - parseFloat(style.paddingRight);
      return { overflow: document.documentElement.scrollWidth > innerWidth,
        aligned: [...document.querySelectorAll('.landing-section > .max-w-7xl, .landing-stats > .max-w-7xl')]
          .every(el => Math.abs(el.getBoundingClientRect().left - left) < 2 && Math.abs(el.getBoundingClientRect().right - right) < 2) };
    });
    expect(bounds).toEqual({ overflow: false, aligned: true });
    await page.locator('.landing-advisor').screenshot({ path: test.info().outputPath(`advisor-${width}.png`) });
    if (width === 1440) await page.locator('.landing-announcements-section').screenshot({ path: test.info().outputPath('offers.png') });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('.landing-stats span[aria-hidden="true"]').filter({ hasText: '+1,240' })).toHaveCount(1);
  await page.locator('.landing-advisor').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.landing-page').evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  expect(errors).toEqual([]);
});
