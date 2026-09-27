import { onRequestGet } from './health';

// Stands in for the generated build module of a Pages build on `stage`. Virtual, because the real
// module is gitignored and only exists after `npm run build:info`.
jest.mock(
  '../build-info',
  () => ({ version: '0123456789abcdef0123456789abcdef01234567', environment: 'staging' }),
  { virtual: true },
);

describe('GET /api/health', () => {
  it('answers ok as uncached JSON', async () => {
    const response = await onRequestGet();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  it('reports the build commit as the API version, with the application environment', async () => {
    const response = await onRequestGet();

    expect(await response.json()).toMatchObject({
      version: '0123456789abcdef0123456789abcdef01234567',
      environment: 'staging',
    });
  });
});
