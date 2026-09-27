// Tester access for every path, app and API alike (spec §7). `TESTER_CREDENTIALS` is an
// encrypted Function secret holding one `name:password` entry per tester, separated by commas.
// A missing or weak secret fails closed: nothing is served until it's fixed.
type Context = {
  request: Request;
  env: { TESTER_CREDENTIALS?: string };
  next: () => Promise<Response>;
};

const BASIC = /^Basic ([A-Za-z0-9+/]+={0,2})$/;
const ENTRY = /^[^:\s]+:\S{16,}$/;

function challenge(): Response {
  return Response.json(
    { error: { code: 'UNAUTHORIZED', message: 'Sign in to use Langili.' } },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Langili", charset="UTF-8"',
        'Cache-Control': 'no-store',
      },
    },
  );
}

function unavailable(): Response {
  return Response.json(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
      },
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

function presented(header: string | null): string | null {
  const match = header?.match(BASIC);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
}

// Compares digests so the time taken doesn't reveal how much of a credential matched.
async function sameSecret(a: string, b: string): Promise<boolean> {
  const digest = (value: string) =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then((d) => new Uint8Array(d));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  return x.reduce((difference, byte, i) => difference | (byte ^ y[i]), 0) === 0;
}

export async function onRequest({ request, env, next }: Context): Promise<Response> {
  const entries = (env.TESTER_CREDENTIALS ?? '').split(',').map((entry) => entry.trim());
  if (!entries.every((entry) => ENTRY.test(entry))) return unavailable();
  const credential = presented(request.headers.get('Authorization'));
  if (credential === null) return challenge();
  const matches = await Promise.all(entries.map((entry) => sameSecret(entry, credential)));
  return matches.includes(true) ? next() : challenge();
}
