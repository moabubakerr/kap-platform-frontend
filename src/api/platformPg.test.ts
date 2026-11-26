import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPgDataset, createPgSource, deletePgSource, getPgColumns, listPgExports, listPgSources, patchPgDataset, patchPgSource, PG_FEATURE_MISSING, PgApiError, pgUrl, previewPgDataset, previewPgMapping, runPgDataset, testPgSource, type PgMapping,
} from './platformPg';

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

  it('reads the columns of a table (schema.name, URL-encoded)', async () => {
    const f = mockFetch(json({ table: 'public.monthly_sales', columns: [{ name: 'revenue', type: 'numeric', nullable: true }] }));
    const r = await getPgColumns(T, 's1', 'public.monthly_sales');
    expect(r.columns[0]).toEqual({ name: 'revenue', type: 'numeric', nullable: true });
    expect(f.mock.calls[0][0]).toBe(`/api/platform/t/${T}/pg-sources/s1/columns?table=public.monthly_sales`);
    expect(f.mock.calls[0][1].method).toBe('GET');
    expect(f.mock.calls[0][1].body).toBeUndefined();
    mockFetch(json({ table: 'a b.c&d', columns: [] }));
    await getPgColumns(T, 's1', 'a b.c&d');
    expect((fetch as any).mock.calls[0][0]).toBe(`/api/platform/t/${T}/pg-sources/s1/columns?table=a+b.c%26d`);
  });

  it('keeps an unknown table apart from a missing route', async () => {
    mockFetch(json({ type: 'not_found', message: 'No table public.nope' }, 404));
    const e = await err(getPgColumns(T, 's1', 'public.nope'));
    expect(e!.type).toBe('not_found');
    expect(e!.routeMissing).toBe(false);
    expect(e!.message).toBe('No table public.nope');
  });

  it('previews a mapping, and sends a mapped dataset', async () => {
    const mapping: PgMapping = { table: 'public.monthly_sales', series_key: ['region_code'], id_prefix: 'sales', period: { column: 'month', kind: 'date' }, frequency: { value: 'M' }, value: 'revenue' };
    const pv = { files: { registry: { columns: ['indicator_id'], rows: [['sales.doha.m.overall']], count: 1 } }, problems: [], queries: { registry: 'SELECT 1', observations: 'SELECT 2' } };
    const f = mockFetch(json(pv), json(pv), json({ id: 'd1', preset: 'mapped', mapping }, 201), json({ id: 'd1' }));
    expect((await previewPgMapping(T, 's1', mapping, 10)).queries.registry).toBe('SELECT 1');
    await previewPgMapping(T, 's1', mapping);
    await createPgDataset(T, { source_id: 's1', name: 'Sales', preset: 'mapped', mapping, collection_name: 'sales_ind', schedule_minutes: null });
    await patchPgDataset(T, 'd1', { mapping: { ...mapping, value: 'net_revenue' } });
    const [c0, c1, c2, c3] = f.mock.calls;
    expect(c0[0]).toBe(`/api/platform/t/${T}/pg-sources/s1/mapping-preview`);
    expect(c0[1].method).toBe('POST');
    expect(JSON.parse(c0[1].body)).toEqual({ mapping, limit: 10 });
    expect(JSON.parse(c1[1].body)).toEqual({ mapping });
    expect(JSON.parse(c2[1].body)).toMatchObject({ preset: 'mapped', mapping: { table: 'public.monthly_sales', frequency: { value: 'M' } } });
    expect(c3[1].method).toBe('PATCH');
    expect(JSON.parse(c3[1].body).mapping.value).toBe('net_revenue');
  });

  it('reports an unreachable platform', async () => {
    mockFetch(new Response('Bad gateway', { status: 502 }));
    expect((await err(listPgSources(T)))!.message).toBe('The platform API is not reachable.');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    expect((await err(listPgSources(T)))!.status).toBe(0);
  });
});
