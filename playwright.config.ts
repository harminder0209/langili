import { defineConfig, devices } from '@playwright/test';

import { e2eAuth, storageStatePath } from './e2e/web/tester';

const baseURL = 'http://localhost:8788';
const bindings = Object.entries(e2eAuth)
  .map(([name, value]) => `--binding ${name}=${value}`)
  .join(' ');

// Runs against the exported bundle and Functions under the local Pages dev server,
// so `npm run export:web` must run first (as it does in `npm run ci`).
export default defineConfig({
  testDir: './e2e/web',
  globalSetup: './e2e/web/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry', storageState: storageStatePath },
  projects: [
    {
      name: 'narrow',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    { name: 'wide', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run dev:pages -- ${bindings}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
  },
});
