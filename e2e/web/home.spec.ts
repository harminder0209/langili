import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Home shows the Langili name', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Langili' })).toBeVisible();
});

test('Home has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Langili' })).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

  expect(blocking.map((v) => v.id)).toEqual([]);
});

test('GET /api/health answers ok', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toMatchObject({ status: 'ok' });
});
