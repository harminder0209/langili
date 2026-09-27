import { environment, version } from '../build-info';

export function onRequestGet(): Response {
  return Response.json(
    { status: 'ok', environment, version },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
