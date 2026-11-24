import { afterEach, describe, expect, it, vi } from 'vitest';
import { kap, kapAll, kapUrl, KapApiError } from './kap';

const T = '71b6c98a-7f7a-4a8b-ab31-132c85bdc88b';

function mockFetch(...responses: Response[]) {
  const f = vi.fn();
  responses.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', f);
  return f;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('kap client', () => {
  it('builds platform passthrough URLs with repeated query params', () => {
    expect(kapUrl(T, '/agents', { limit: 5, type__in: ['workflow', 'planner_and_executor'], x: undefined })).toBe(`/api/platform/t/${T}/kap/agents?limit=5&type__in=workflow&type__in=planner_and_executor`);
  });

  it('sends JSON bodies and returns undefined for 204', async () => {
    const f = mockFetch(new Response(null, { status: 204 }));
    expect(await kap(T, 'DELETE', 'connectors/c1')).toBeUndefined();
    mockFetch(json({ id: 'a1' }));
    expect(await kap(T, 'PATCH', 'agents/a1', { description: 'd' })).toEqual({ id: 'a1' });
    expect(f.mock.calls[0][1].method).toBe('DELETE');
  });

  it('turns KAP errors into KapApiError with field details', async () => {
    mockFetch(json({ type: 'kap_error', message: 'Validation failed', data: { kap_body: { data: { errors: [{ loc: ['body', 'name'], msg: 'field required' }] } } } }, 422));
    const e = (await kap(T, 'POST', 'agents', {}).catch((x) => x)) as KapApiError;
    expect(e).toBeInstanceOf(KapApiError);
    expect(e.status).toBe(422);
    expect(e.message).toBe('Validation failed (name: field required)');
  });

  it('reads every page', async () => {
    const f = mockFetch(json({ items: [1, 2], total: 3, has_next: true }), json({ items: [3], total: 3, has_next: false }));
    expect(await kapAll<number>(T, 'agents')).toEqual([1, 2, 3]);
    expect(f.mock.calls[1][0]).toContain('offset=200');
  });
});
