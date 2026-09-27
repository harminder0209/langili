import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:8788';

// Runs against the exported bundle and Functions under the local Pages dev server,
// so `npm run export:web` must run first (as it does in `npm run ci`).
export default defineConfig({
  testDir: './e2e/web',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    {
      name: 'narrow',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    { name: 'wide', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npm run dev:pages',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
  },
});
