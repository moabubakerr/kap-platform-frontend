import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPgDataset, createPgSource, deletePgSource, listPgExports, listPgSources, patchPgSource, PG_FEATURE_MISSING, PgApiError, pgUrl, previewPgDataset, runPgDataset, testPgSource } from './platformPg';

const T = '71b6c98a-7f7a-4a8b-ab31-132c85bdc88b';

function mockFetch(...responses: Response[]) {
  const f = vi.fn();
  responses.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', f);
  return f;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const err = (p: Promise<unknown>) => p.then(() => null, (e) => e as PgApiError);

afterEach(() => vi.unstubAllGlobals());

describe('platformPg client', () => {
  it('builds same-origin platform URLs', () => {
    expect(pgUrl(T, '/pg-exports', { dataset_id: 'd1', limit: 5, offset: undefined })).toBe(`/api/platform/t/${T}/pg-exports?dataset_id=d1&limit=5`);
  });

  it('lists sources with a page size', async () => {
    const f = mockFetch(json({ items: [{ id: 's1' }], total: 1, limit: 200, offset: 0, has_next: false }));
    const page = await listPgSources(T);
    expect(page.items[0].id).toBe('s1');
    expect(f.mock.calls[0][0]).toBe(`/api/platform/t/${T}/pg-sources?limit=200`);
    expect(f.mock.calls[0][1].method).toBe('GET');
  });

  it('sends JSON bodies for create, patch, test, preview and run', async () => {
    const f = mockFetch(json({ id: 's1' }, 201), json({ id: 's1' }), json({ ok: true, message: 'ok', server_version: '16.4', tables: [] }), json({ id: 'd1' }, 201), json({ files: {}, problems: [] }), json({ id: 'x1', status: 'queued' }, 201));
    await createPgSource(T, { name: 'askai', host: 'h', port: 5432, database: 'db', username: 'u', password: 'p', sslmode: 'disable' });
    await patchPgSource(T, 's1', { host: 'h2' });
    expect((await testPgSource(T, 's1')).server_version).toBe('16.4');
    await createPgDataset(T, { source_id: 's1', name: 'ind', preset: 'scai_indicators', published_only: true, collection_name: 'askai_ind', schedule_minutes: null });
    await previewPgDataset(T, 'd1');
    expect((await runPgDataset(T, 'd1')).status).toBe('queued');
    const [c0, c1, c2, c3, , c5] = f.mock.calls;
    expect(c0[0]).toBe(`/api/platform/t/${T}/pg-sources`);
    expect(c0[1].method).toBe('POST');
    expect(JSON.parse(c0[1].body).port).toBe(5432);
    expect(c0[1].headers['Content-Type']).toBe('application/json');
    expect(c1[0]).toBe(`/api/platform/t/${T}/pg-sources/s1`);
    expect(JSON.parse(c1[1].body)).toEqual({ host: 'h2' });
    expect(c2[0]).toBe(`/api/platform/t/${T}/pg-sources/s1/test`);
    expect(c3[0]).toBe(`/api/platform/t/${T}/pg-datasets`);
    expect(c5[0]).toBe(`/api/platform/t/${T}/pg-datasets/d1/run`);
  });

  it('returns undefined for 204 and filters exports by dataset', async () => {
    const f = mockFetch(new Response(null, { status: 204 }), json({ items: [], total: 0, limit: 10, offset: 0, has_next: false }));
    expect(await deletePgSource(T, 's1')).toBeUndefined();
    await listPgExports(T, { dataset_id: 'd1', limit: 10 });
    expect(f.mock.calls[0][1].method).toBe('DELETE');
    expect(f.mock.calls[1][0]).toBe(`/api/platform/t/${T}/pg-exports?limit=10&dataset_id=d1`);
  });

  it("keeps the platform's error message (409 source in use)", async () => {
    mockFetch(json({ type: 'conflict', message: 'Datasets use this source: indicators', data: { datasets: ['indicators'] } }, 409));
    const e = await err(deletePgSource(T, 's1'));
    expect(e).toBeInstanceOf(PgApiError);
    expect(e!.status).toBe(409);
    expect(e!.type).toBe('conflict');
    expect(e!.message).toBe('Datasets use this source: indicators');
    expect(e!.routeMissing).toBe(false);
  });

  it('folds validation details into the message', async () => {
    mockFetch(json({ detail: [{ loc: ['body', 'port'], msg: 'Input should be a valid integer' }] }, 422));
    const e = await err(createPgSource(T, { name: 'a', host: 'h', port: 0, database: 'd', username: 'u', password: 'p', sslmode: 'disable' }));
    expect(e!.message).toBe('port: Input should be a valid integer');
  });

  it('tells a missing route (feature not deployed) from a missing record', async () => {
    mockFetch(json({ detail: 'Not Found' }, 404));
    const e1 = await err(listPgSources(T));
    expect(e1!.routeMissing).toBe(true);
    expect(e1!.message).toBe(PG_FEATURE_MISSING);
    mockFetch(new Response('<html>404</html>', { status: 404 }));
    expect((await err(listPgSources(T)))!.routeMissing).toBe(true);
    mockFetch(json({ type: 'not_found', message: 'No PostgreSQL source s9' }, 404));
    const e3 = await err(testPgSource(T, 's9'));
    expect(e3!.routeMissing).toBe(false);
    expect(e3!.message).toBe('No PostgreSQL source s9');
  });

  it('reports an unreachable platform', async () => {
    mockFetch(new Response('Bad gateway', { status: 502 }));
    expect((await err(listPgSources(T)))!.message).toBe('The platform API is not reachable.');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    expect((await err(listPgSources(T)))!.status).toBe(0);
  });
});
