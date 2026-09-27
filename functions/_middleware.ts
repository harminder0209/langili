// Google sign-in for the authorized testers, on every path, app and API alike (spec §7).
// Configuration comes from Function variables and secrets, and anything missing or malformed
// fails closed: nothing is served until it's fixed.
//
// - A signed-out page visit goes to Google. A signed-out API call gets 401, never a redirect.
// - Google's callback lands on /auth/callback. Only a verified, allowlisted email gets a session.
// - The session is a signed cookie bound to this origin, so a `dev` session doesn't open `stage`.
import { decodeIdToken, generateCodeVerifier, generateState, Google } from 'arctic';
import { jwtVerify, SignJWT } from 'jose';

type Env = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  TESTER_EMAILS?: string;
};

type Context = { request: Request; env: Env; next: () => Promise<Response> };

type Config = { clientId: string; clientSecret: string; key: CryptoKey; testers: string[] };
type Purpose = 'session' | 'sign-in';

const CALLBACK = '/auth/callback';
const SESSION = '__Host-langili-session';
// One cookie per sign-in, named by its state, so sign-ins in two tabs don't overwrite each other.
const SIGN_IN = '__Host-langili-sign-in-';
const SESSION_SECONDS = 24 * 60 * 60;
const SIGN_IN_SECONDS = 10 * 60;
const EMAIL = /^[^@\s]+@[^@\s]+$/;
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// Parsed once per isolate and settings, since every request, assets included, comes through here.
let cached: { source: string; config: Promise<Config | null> } | undefined;

function config(env: Env): Promise<Config | null> {
  const source = JSON.stringify([
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.SESSION_SECRET,
    env.TESTER_EMAILS,
  ]);
  if (cached?.source !== source) cached = { source, config: parse(env) };
  return cached.config;
}

async function parse(env: Env): Promise<Config | null> {
  const testers = (env.TESTER_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase());
  const valid =
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    (env.SESSION_SECRET ?? '').length >= 32 &&
    testers.every((email) => EMAIL.test(email));
  if (!valid) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, key, testers };
}

function google(cfg: Config, origin: string): Google {
  return new Google(cfg.clientId, cfg.clientSecret, origin + CALLBACK);
}

function failure(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

const unavailable = () =>
  failure(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.');
const unauthorized = () => failure(401, 'UNAUTHORIZED', 'Sign in to use Langili.');
const signInFailed = () => failure(400, 'SIGN_IN_FAILED', "Sign-in didn't finish. Try again.");
const forbidden = () => failure(403, 'FORBIDDEN', "This Google account can't use Langili.");

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 302, headers });
}

// Each token says what it's for, so a sign-in token can never pass as a session.
function sign(
  purpose: Purpose,
  claims: Record<string, string>,
  origin: string,
  seconds: number,
  key: CryptoKey,
) {
  return new SignJWT({ ...claims, purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(origin)
    .setExpirationTime(`${seconds}s`)
    .sign(key);
}

async function verify(purpose: Purpose, token: string | undefined, origin: string, key: CryptoKey) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { audience: origin, algorithms: ['HS256'] });
    return payload.purpose === purpose ? payload : null;
  } catch {
    return null;
  }
}

// Only a same-site path, so a crafted link can't bounce a tester to another site after sign-in.
function safePath(path: unknown): string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

async function startSignIn(url: URL, cfg: Config): Promise<Response> {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const location = google(cfg, url.origin).createAuthorizationURL(state, verifier, [
    'openid',
    'email',
  ]);
  // Always offer the account chooser, so a tester signed in to another Google account can switch.
  location.searchParams.set('prompt', 'select_account');
  const pending = await sign(
    'sign-in',
    { state, verifier, returnTo: url.pathname + url.search },
    url.origin,
    SIGN_IN_SECONDS,
    cfg.key,
  );
  return redirect(location.toString(), [cookie(SIGN_IN + state, pending, SIGN_IN_SECONDS)]);
}

async function finishSignIn(request: Request, url: URL, cfg: Config): Promise<Response> {
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const pending = /^[\w-]+$/.test(state)
    ? await verify('sign-in', readCookie(request, SIGN_IN + state), url.origin, cfg.key)
    : null;
  if (!pending || !code || pending.state !== state) return signInFailed();

  let claims: Record<string, unknown>;
  try {
    const tokens = await google(cfg, url.origin).validateAuthorizationCode(
      code,
      String(pending.verifier),
    );
    // The ID token came straight from Google's token endpoint over TLS, so its claims are
    // checked here without re-verifying the signature (OpenID Connect Core §3.1.3.7).
    claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
  } catch {
    return signInFailed();
  }

  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
  const accepted =
    GOOGLE_ISSUERS.includes(String(claims.iss)) &&
    claims.aud === cfg.clientId &&
    typeof claims.exp === 'number' &&
    claims.exp * 1000 > Date.now() &&
    claims.email_verified === true &&
    cfg.testers.includes(email);
  if (!accepted) return forbidden();

  const session = await sign('session', { sub: email }, url.origin, SESSION_SECONDS, cfg.key);
  return redirect(safePath(pending.returnTo), [
    cookie(SESSION, session, SESSION_SECONDS),
    cookie(SIGN_IN + state, '', 0),
  ]);
}

function wantsPage(request: Request, url: URL): boolean {
  return (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !url.pathname.startsWith('/api/') &&
    (request.headers.get('Accept') ?? '').includes('text/html')
  );
}

// Signed-in responses must never be kept by a shared cache and served to someone else.
// `no-store` already rules that out, so it's left exactly as the API set it.
async function privately(response: Response): Promise<Response> {
  if (/(^|,)\s*no-store\s*(,|$)/i.test(response.headers.get('Cache-Control') ?? '')) {
    return response;
  }
  const result = new Response(response.body, response);
  const directives = (result.headers.get('Cache-Control') ?? '')
    .split(',')
    .map((directive) => directive.trim())
    .filter((directive) => directive && !/^(public|private)$/i.test(directive));
  result.headers.set('Cache-Control', ['private', ...directives].join(', '));
  return result;
}

export async function onRequest({ request, env, next }: Context): Promise<Response> {
  const cfg = await config(env);
  if (!cfg) return unavailable();
  const url = new URL(request.url);
  const session = await verify('session', readCookie(request, SESSION), url.origin, cfg.key);
  const signedIn = session !== null && cfg.testers.includes(String(session.sub));

  if (url.pathname === CALLBACK) {
    return signedIn ? redirect('/', []) : finishSignIn(request, url, cfg);
  }
  if (signedIn) return privately(await next());
  return wantsPage(request, url) ? startSignIn(url, cfg) : unauthorized();
}
