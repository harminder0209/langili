import { SignJWT } from 'jose';

// Local-only sign-in settings for the Pages dev server under Playwright. Never deployed values.
export const e2eAuth = {
  GOOGLE_CLIENT_ID: 'e2e-client-id',
  GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
  SESSION_SECRET: 'e2e-local-only-session-secret-0000000000',
  TESTER_EMAILS: 'e2e-tester@example.com',
};

export const storageStatePath = 'playwright/.auth/tester.json';

// The session cookie the middleware would issue after a Google sign-in, for `origin`.
export async function testerSession(origin: string): Promise<string> {
  return new SignJWT({ sub: e2eAuth.TESTER_EMAILS, purpose: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(origin)
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(e2eAuth.SESSION_SECRET));
}
