import { onRequest } from './_middleware';

const DEV = 'https://dev.langili.pages.dev';
const ENV = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  SESSION_SECRET: 'a-session-secret-of-at-least-32-characters',
  TESTER_EMAILS: 'first.tester@gmail.com, Second.Tester@gmail.com',
};

type Call = { headers?: Record<string, string>; env?: Record<string, string> };

async function call(url: string, { headers = {}, env = ENV }: Call = {}) {
  const next = jest.fn(async () => new Response('the app'));
  const response = await onRequest({ request: new Request(url, { headers }), env, next });
  return { response, next };
}

const page = { Accept: 'text/html,application/xhtml+xml' };

function base64url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Google's token endpoint answers the code exchange with an ID token for this account.
function googleSignsIn(claims: Record<string, unknown>) {
  const idToken = [
    base64url({ alg: 'RS256', typ: 'JWT' }),
    base64url({
      iss: 'https://accounts.google.com',
      aud: ENV.GOOGLE_CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 3600,
      email_verified: true,
      ...claims,
    }),
    'signature',
  ].join('.');
  // A fresh response per exchange, since a response body can only be read once.
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    Response.json({
      access_token: 'access',
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: idToken,
    }),
  );
}

async function startSignIn(path = '/') {
  const { response } = await call(`${DEV}${path}`, { headers: page });
  const state = new URL(response.headers.get('Location')!).searchParams.get('state')!;
  return { state, jar: cookies(response) };
}

function callback(state: string, jar: Record<string, string>) {
  return call(`${DEV}/auth/callback?code=the-code&state=${state}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
}

function sessionOnly(jar: Record<string, string>) {
  return { Cookie: cookieHeader({ '__Host-langili-session': jar['__Host-langili-session'] }) };
}

function cookies(response: Response): Record<string, string> {
  return Object.fromEntries(
    response.headers.getSetCookie().map((cookie) => {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      return [pair.slice(0, index), pair.slice(index + 1)];
    }),
  );
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// Runs the whole round trip: a signed-out page visit, Google, then the callback.
async function signIn(email: string, origin = DEV, path = '/diagnostics?x=1') {
  const start = await call(`${origin}${path}`, { headers: page });
  const state = new URL(start.response.headers.get('Location')!).searchParams.get('state')!;
  googleSignsIn({ email });
  return call(`${origin}/auth/callback?code=the-code&state=${state}`, {
    headers: { Cookie: cookieHeader(cookies(start.response)) },
  });
}

afterEach(() => jest.restoreAllMocks());

describe('Google sign-in for authorized testers', () => {
  it('sends a signed-out page visit to Google, with PKCE and a callback on the same origin', async () => {
    const { response, next } = await call(`${DEV}/diagnostics`, { headers: page });

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe(ENV.GOOGLE_CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toBe(`${DEV}/auth/callback`);
    expect(location.searchParams.get('scope')).toBe('openid email');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('prompt')).toBe('select_account');
    const state = location.searchParams.get('state');
    expect(response.headers.getSetCookie()[0]).toMatch(
      new RegExp(
        `^__Host-langili-sign-in-${state}=[^;]+; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax$`,
      ),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('answers a signed-out API call with 401 and the error envelope, never a redirect', async () => {
    const { response, next } = await call(`${DEV}/api/health`);

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Sign in to use Langili.' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('signs in an allowlisted tester, returns them to where they were, and lets them through', async () => {
    const { response } = await signIn('second.tester@gmail.com');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/diagnostics?x=1');
    const jar = cookies(response);
    expect(response.headers.getSetCookie().join('\n')).toMatch(
      /__Host-langili-session=[^;]+; Path=\/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax/,
    );

    const { response: api, next } = await call(`${DEV}/api/health`, {
      headers: sessionOnly(jar),
    });
    expect(next).toHaveBeenCalled();
    expect(await api.text()).toBe('the app');
  });

  it.each([
    ['an account that is not allowlisted', { email: 'someone.else@gmail.com' }],
    ['an unverified email', { email: 'first.tester@gmail.com', email_verified: false }],
    ['a token for another client', { email: 'first.tester@gmail.com', aud: 'other-client' }],
    ['an expired token', { email: 'first.tester@gmail.com', exp: 1 }],
    [
      'a token from another issuer',
      { email: 'first.tester@gmail.com', iss: 'https://evil.example' },
    ],
  ])('refuses %s without a session', async (_, claims) => {
    const start = await call(`${DEV}/`, { headers: page });
    const state = new URL(start.response.headers.get('Location')!).searchParams.get('state')!;
    googleSignsIn(claims);

    const { response } = await call(`${DEV}/auth/callback?code=the-code&state=${state}`, {
      headers: { Cookie: cookieHeader(cookies(start.response)) },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: "This Google account can't use Langili." },
    });
    expect(cookies(response)['__Host-langili-session']).toBeFalsy();
  });

  it('refuses a callback whose state does not match the sign-in it started', async () => {
    const start = await call(`${DEV}/`, { headers: page });
    googleSignsIn({ email: 'first.tester@gmail.com' });

    const { response } = await call(`${DEV}/auth/callback?code=the-code&state=forged`, {
      headers: { Cookie: cookieHeader(cookies(start.response)) },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'SIGN_IN_FAILED', message: "Sign-in didn't finish. Try again." },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not accept a development session on canonical staging', async () => {
    const jar = cookies((await signIn('first.tester@gmail.com')).response);

    const { response, next } = await call('https://langili.pages.dev/api/health', {
      headers: sessionOnly(jar),
    });

    expect(response.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not accept a tampered session', async () => {
    const jar = cookies((await signIn('first.tester@gmail.com')).response);
    const [header, , signature] = jar['__Host-langili-session'].split('.');
    const forged = [
      header,
      base64url({ sub: 'someone.else@gmail.com', aud: DEV, exp: 9e9 }),
      signature,
    ].join('.');

    const { response } = await call(`${DEV}/api/health`, {
      headers: { Cookie: `__Host-langili-session=${forged}` },
    });

    expect(response.status).toBe(401);
  });

  it('never returns to another site after sign-in', async () => {
    const { response } = await signIn('first.tester@gmail.com', DEV, '//evil.example/path');

    expect(response.headers.get('Location')).toBe('/');
  });

  it('lets two sign-ins in different tabs both finish', async () => {
    const first = await startSignIn('/first');
    const second = await startSignIn('/second');
    googleSignsIn({ email: 'first.tester@gmail.com' });
    const jar = { ...first.jar, ...second.jar };

    expect((await callback(first.state, jar)).response.headers.get('Location')).toBe('/first');
    expect((await callback(second.state, jar)).response.headers.get('Location')).toBe('/second');
  });

  it('sends a tester who is already signed in on from a stale callback', async () => {
    const jar = cookies((await signIn('first.tester@gmail.com')).response);

    const { response } = await call(`${DEV}/auth/callback?error=access_denied`, {
      headers: sessionOnly(jar),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/');
  });

  it('refuses a callback with no sign-in in progress', async () => {
    const fetch = googleSignsIn({ email: 'first.tester@gmail.com' });

    const { response } = await call(`${DEV}/auth/callback?code=the-code&state=anything`);

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a sign-in when Google rejects the code', async () => {
    const { state, jar } = await startSignIn();
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ error: 'invalid_grant' }, { status: 400 }));

    const { response } = await callback(state, jar);

    expect(response.status).toBe(400);
    expect(cookies(response)['__Host-langili-session']).toBeFalsy();
  });

  it('does not accept a sign-in cookie as a session', async () => {
    const { state, jar } = await startSignIn();

    const { response, next } = await call(`${DEV}/api/health`, {
      headers: { Cookie: `__Host-langili-session=${jar[`__Host-langili-sign-in-${state}`]}` },
    });

    expect(response.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('shuts out a tester removed from the allowlist, even with a live session', async () => {
    const jar = cookies((await signIn('second.tester@gmail.com')).response);

    const { response } = await call(`${DEV}/api/health`, {
      headers: sessionOnly(jar),
      env: { ...ENV, TESTER_EMAILS: 'first.tester@gmail.com' },
    });

    expect(response.status).toBe(401);
  });

  it('marks what it lets through as private, so shared caches never keep it', async () => {
    const jar = cookies((await signIn('first.tester@gmail.com')).response);
    const next = jest.fn(
      async () => new Response('asset', { headers: { 'Cache-Control': 'public, max-age=14400' } }),
    );

    const response = await onRequest({
      request: new Request(`${DEV}/_expo/static/js/web/entry.js`, { headers: sessionOnly(jar) }),
      env: ENV,
      next,
    });

    expect(response.headers.get('Cache-Control')).toBe('private, max-age=14400');
  });

  it("leaves an API response's no-store as it is", async () => {
    const jar = cookies((await signIn('first.tester@gmail.com')).response);
    const next = jest.fn(
      async () => new Response('{}', { headers: { 'Cache-Control': 'no-store' } }),
    );

    const response = await onRequest({
      request: new Request(`${DEV}/api/health`, { headers: sessionOnly(jar) }),
      env: ENV,
      next,
    });

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['missing', {}],
    ['a short session secret', { ...ENV, SESSION_SECRET: 'too-short' }],
    ['an empty allowlist', { ...ENV, TESTER_EMAILS: ' , ' }],
    [
      'a malformed allowlist entry',
      { ...ENV, TESTER_EMAILS: 'first.tester@gmail.com,not-an-email' },
    ],
  ])('fails closed when the configuration is %s', async (_, env) => {
    const { response, next } = await call(`${DEV}/`, { headers: page, env });

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
