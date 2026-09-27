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
