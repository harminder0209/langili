import { onRequest } from './_middleware';

const CREDENTIALS = 'first-tester:correct-horse-battery,second-tester:staple-orbit-lantern';

function basic(user: string, password: string): string {
  return `Basic ${btoa(`${user}:${password}`)}`;
}

async function call(path: string, headers: Record<string, string> = {}, secret?: string) {
  const next = jest.fn(async () => new Response('the app'));
  const response = await onRequest({
    request: new Request(`https://dev.langili.pages.dev${path}`, { headers }),
    env: { TESTER_CREDENTIALS: secret ?? CREDENTIALS },
    next,
  });
  return { response, next };
}

describe('tester access middleware', () => {
  it('challenges a request without credentials, for the app and the API alike', async () => {
    for (const path of ['/', '/api/health']) {
      const { response, next } = await call(path);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Basic realm="Langili", charset="UTF-8"',
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Sign in to use Langili.' },
      });
      expect(next).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['first-tester', 'correct-horse-battery'],
    ['second-tester', 'staple-orbit-lantern'],
  ])('lets %s through with their own password', async (user, password) => {
    const { response, next } = await call('/api/health', { Authorization: basic(user, password) });

    expect(next).toHaveBeenCalled();
    expect(await response.text()).toBe('the app');
  });

  it.each([
    ['a wrong password', basic('first-tester', 'staple-orbit-lantern')],
    ['an unknown tester', basic('someone-else', 'correct-horse-battery')],
    ['a prefix of a real password', basic('first-tester', 'correct-horse')],
    ['a malformed header', 'Basic not-base64!'],
    ['another scheme', 'Bearer correct-horse-battery'],
  ])('challenges %s', async (_, authorization) => {
    const { response, next } = await call('/', { Authorization: authorization });

    expect(response.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', ''],
    ['an entry without a password', 'first-tester'],
    ['a password under 16 characters', 'first-tester:correct-horse-battery,second-tester:short'],
    ['an empty entry', 'first-tester:correct-horse-battery,'],
  ])('fails closed when the secret is %s', async (_, secret) => {
    const { response, next } = await call(
      '/',
      { Authorization: basic('first-tester', 'correct-horse-battery') },
      secret,
    );

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
