import { request, type FullConfig } from '@playwright/test';

import { storageStatePath, testerSession } from './tester';

// Signs every test in as the e2e tester, as if they'd come back from Google.
export default async function globalSetup(config: FullConfig) {
  const baseURL = new URL(config.projects[0].use.baseURL!);
  const context = await request.newContext({
    storageState: {
      cookies: [
        {
          name: '__Host-langili-session',
          value: await testerSession(baseURL.origin),
          domain: baseURL.hostname,
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  });
  await context.storageState({ path: storageStatePath });
  await context.dispose();
}
