import { onRequestGet } from './health';

describe('GET /api/health', () => {
  it('answers ok as uncached JSON', async () => {
    const response = await onRequestGet();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});
