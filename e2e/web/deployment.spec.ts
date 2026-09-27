import { expect, test } from '@playwright/test';

test('a client route that has no file is served the app by the SPA fallback', async ({
  request,
}) => {
  const response = await request.get('/some/client/route');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/html/);
  expect(await response.text()).toContain('<div id="root">');
});

test('GET /api/health reports the development environment and a full commit as the API version', async ({
  request,
}) => {
  const response = await request.get('/api/health');

  expect(await response.json()).toMatchObject({
    environment: 'development',
    version: expect.stringMatching(/^[0-9a-f]{40}$/),
  });
});

test.describe('signed out', () => {
  // Plain fetch, because Playwright request contexts carry the signed-in tester's cookie.
  for (const path of ['/', '/some/client/route']) {
    test(`a page visit to ${path} is sent to Google`, async ({ baseURL }) => {
      const response = await fetch(new URL(path, baseURL), {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      expect(new URL(response.headers.get('location')!).origin).toBe('https://accounts.google.com');
    });
  }

  for (const path of ['/favicon.ico', '/api/health']) {
    test(`is refused ${path}`, async ({ baseURL }) => {
      const response = await fetch(new URL(path, baseURL));

      expect(response.status).toBe(401);
    });
  }
});
