import { describe, expect, it } from 'vitest';
import { can, iamStore } from '@/v35/iam';
import { initialBusinessData, type BusinessData } from '@/v35/data/businessData';
import type { FormField, FormValues, SaveResult } from '@/engine/dialogs';
import type { ScreenModel } from '@/engine/types';
import { datasetsScreen, type DataUi, type Hub, type LiveHub } from './build';
import { agentCollections, obsKey, pageKey, toIngestRef, toTenantData, type KapCache } from './fromKap';
import { fixtureCache } from './fromKap.fixtures';
import { liveCollectionScreen, liveCollectionsScreen, liveDatasetScreen, liveDocumentScreen, liveDocumentsScreen, liveEntitiesScreen } from './liveBuild';
import { UD_DEFAULT } from './session';

type Calls = { forms: { title: string; fields: FormField[]; save: (v: FormValues) => SaveResult }[]; confirms: { title: string; fn: () => unknown }[]; go: string[]; writes: [string, ...unknown[]][] };

function liveHub(uid = 'r.haddad', cache: KapCache = fixtureCache()): Hub & { calls: Calls } {
  const calls: Calls = { forms: [], confirms: [], go: [], writes: [] };
  const data: BusinessData = initialBusinessData();
  data.tenants.sandbox = toTenantData(cache, data.tenants.sandbox);
  const iam = structuredClone(iamStore.get());
  const pages: Record<string, { offset: number; size: number; status?: string }> = {};
  const w = (name: string) => (...a: unknown[]) => { calls.writes.push([name, ...a]); return Promise.resolve(''); };
  const live: LiveHub = {
    cache,
    agColl: agentCollections(cache.agents),
    filesAt: (c) => (pages[`f:${c}`] as { offset: number; size: number }) ?? { offset: 0, size: 25 },
    setFilesAt: (c, v) => { pages[`f:${c}`] = v; },
    obsAt: (d) => (pages[`o:${d}`] as { offset: number; size: number; status: string }) ?? { offset: 0, size: 25, status: '' },
    setObsAt: (d, v) => { pages[`o:${d}`] = v; },
    createCollection: w('createCollection'), updateCollection: w('updateCollection'), deleteCollection: w('deleteCollection'),
    reprocessFile: w('reprocessFile'), deleteFile: w('deleteFile'), download: (id) => { calls.writes.push(['download', id]); },
    correctObservation: w('correctObservation'), createEntityType: w('createEntityType'), updateEntityType: w('updateEntityType'), deleteEntityType: w('deleteEntityType'),
  };
  const ui: DataUi = {
    go: (p) => calls.go.push(p),
    form: (title, fields, _s, save) => calls.forms.push({ title, fields, save }),
    confirm: (title, _b, _i, _c, fn) => calls.confirms.push({ title, fn }),
    toast: () => {},
    setD: (fn) => fn(data.tenants.sandbox, data),
    setIam: (fn) => fn(iam),
    later: (fn) => fn(),
  };
  return {
    t: 'sandbox', all: data, D: data.tenants.sandbox, iam, ing: toIngestRef(cache), ui, effU: uid, setEffU: () => {}, live, calls,
    acc: {
      uid,
      canData: can(uid, 'sandbox', 'data:manage', 'collection', '*'),
      canGrant: can(uid, 'sandbox', 'grant:manage', 'tenant', '*'),
      // the sample IAM grants name sample collections; read everything here
      canRead: () => true,
      canAgent: (p, a) => can(uid, 'sandbox', p, 'agent', a),
    },
  };
}

const table = (m: ScreenModel, i = 0) => m.sections.filter((s) => s.cols)[i];
const formVal = (m: ScreenModel, label: string) => m.sections.flatMap((s) => (s.form ? s.rows ?? [] : [])).find((r) => r.cells[0].v === label)?.cells[1];

describe('live Business Data Hub screens', () => {
  it('lists KAP collections with real counts and agents', () => {
    const h = liveHub();
    expect(h.acc.canData).toBe(true);
    const m = liveCollectionsScreen(h);
    const rows = table(m).rows!;
    expect(rows.map((r) => r.cells[0].v)).toEqual(['sandbox_indicators', 'sandbox_docs']);
    expect(rows.map((r) => r.cells[1].v)).toEqual(['520 observations', '3 files']);
    expect(rows.map((r) => r.cells[2].p)).toEqual([['hold', '3 to review'], ['hold', '1 failed']]);
    expect(rows.map((r) => r.cells[4].v)).toEqual(['sandbox_indicators_agent, sbx_research_agent', 'sbx_research_agent']);
  });

  it('creates a collection in KAP through the form', async () => {
    const h = liveHub();
    liveCollectionsScreen(h).head.add!.f();
    const f = h.calls.forms[0];
    expect(f.fields.map((x) => ('k' in x ? x.k : x.type))).toEqual(['name', 'pipeline', 'connectors', 'sync', 'entity', 'note']);
    expect(await f.save({ name: 'ab', pipeline: 'docs_pipeline', connectors: ['sbx_bucket'] })).toMatch(/4–32/);
    expect(await f.save({ name: 'supplier_docs', pipeline: 'docs_pipeline', connectors: ['sbx_bucket'], sync: 'unique_name', entity: 'Off' })).toBe('');
    expect(h.calls.writes[0]).toEqual(['createCollection', { name: 'supplier_docs', pipeline: 'docs_pipeline', connectors: ['sbx_bucket'], sync: 'unique_name', entity: 'Off' }]);
  });

  it('shows a collection with KAP settings, paged files and read-only agents', async () => {
    const h = liveHub();
    const ov = liveCollectionScreen(h, 'sandbox_docs', undefined);
    expect(formVal(ov, 'Pipeline')?.v).toBe('docs_pipeline');
    expect(formVal(ov, 'Entity extraction')?.v).toBe('On · Customer');
    expect(formVal(ov, 'Description')?.v).toBe('—');
    expect(ov.head.acts!.map((a) => a.l)).toEqual(['Edit settings', 'Delete']);
    ov.head.acts![1].f();
    expect(await h.calls.confirms[0].fn()).toBe('');
    expect(h.calls.writes[0]).toEqual(['deleteCollection', 'sandbox_docs']);
    expect(h.calls.go).toContain('collections');

    // a page of files that has not loaded yet, then a loaded one
    expect(table(liveCollectionScreen(h, 'sandbox_docs', 'scope')).empty).toBe('Loading files from KAP…');
    h.live!.cache.filePages['c-sandbox_docs'] = { [pageKey(0, 25)]: ['f2', 'f1'] };
    const sc = table(liveCollectionScreen(h, 'sandbox_docs', 'scope'));
    expect(sc.rows!.map((r) => r.cells[0].v)).toEqual(['Broken.docx', 'Guide.pdf']);
    expect(sc.rows![0].cells[3].p).toEqual(['rejected', 'Failed parse']);
    expect(sc.rows![0].acts!.map((a) => a.l)).toEqual(['Open', 'Download', 'Reprocess', 'Delete']);
    expect(sc.pager!.l).toBe('1–3 of 3');
    sc.rows![0].acts![2].f();
    await h.calls.confirms[h.calls.confirms.length - 1].fn();
    expect(h.calls.writes[h.calls.writes.length - 1]).toEqual(['reprocessFile', 'sandbox_docs:Broken.docx']);

    const ac = liveCollectionScreen(h, 'sandbox_indicators', 'access');
    const ag = ac.sections.find((s) => s.title === 'Assigned agents')!;
    expect(ag.sacts).toBeUndefined();
    expect(ag.rows!.map((r) => r.acts!.map((a) => a.l))).toEqual([['Open agent'], ['Open agent']]);
    expect(ac.sections.find((s) => s.title === 'Usage')!.rows!.map((r) => r.cells[1].v)).toEqual(['—', '—', '2']);
  });

  it('shows observations as a structured dataset and corrects one', async () => {
    const h = liveHub();
    expect(table(datasetsScreen(h)).rows!.map((r) => [r.cells[0].v, r.cells[2].v])).toEqual([['sandbox_indicators_observations', '520']]);
    const ov = liveDatasetScreen(h, 'sandbox_indicators_observations', undefined);
    expect(formVal(ov, 'Need review')?.v).toBe('3');
    const pv = table(liveDatasetScreen(h, 'sandbox_indicators_observations', 'preview'));
    expect(pv.rows!.map((r) => r.cells[4].p)).toEqual([['approved', 'Valid'], ['hold', 'Needs review']]);
    expect(pv.pager!.pg).toBe('Page 1 of 21');
    pv.rows![1].acts![0].f();
    const f = h.calls.forms[0];
    expect(await f.save({ value: 'x', status: 'valid' })).toMatch(/number/);
    expect(await f.save({ value: '4.2', status: 'valid', reason: 'Checked' })).toBe('');
    expect(h.calls.writes[0]).toEqual(['correctObservation', 'sandbox_indicators_observations', 'o2', { value: '4.2', status: 'valid', reason: 'Checked' }]);
    // the status filter is a page of its own
    pv.sacts![0].f();
    expect(h.live!.obsAt('sandbox_indicators_observations').status).toBe('needs_review');
    expect(table(liveDatasetScreen(h, 'sandbox_indicators_observations', 'preview')).empty).toBe('Loading observations from KAP…');
    h.live!.cache.obs['c-sandbox_indicators'][obsKey('needs_review', 0)] = { items: [], total: 0 };
    expect(table(liveDatasetScreen(h, 'sandbox_indicators_observations', 'preview')).empty).toBe('No observation needs review.');
    // no invented quality scores
    const q = table(liveDatasetScreen(h, 'sandbox_indicators_observations', 'quality'));
    expect(q.rows!.slice(1).map((r) => r.cells[1].v)).toEqual(['—', '—', '—']);
  });

  it('shows documents from KAP files with versions and file actions', async () => {
    const h = liveHub();
    const list = liveDocumentsScreen(h, UD_DEFAULT, () => {});
    expect(table(list).rows!.map((r) => r.cells[0].v)).toEqual(['sandbox_docs:Broken.docx', 'sandbox_docs:Guide.pdf']);
    const id = 'sandbox_docs:Guide.pdf';
    const ov = liveDocumentScreen(h, id, undefined, null);
    expect(formVal(ov, 'Classification')?.sub).toBe('Kept in this console only (session)');
    expect(formVal(ov, 'Language and pages')?.v).toBe('—');
    expect(ov.head.acts!.map((a) => a.l)).toEqual(['Download', 'Reprocess', 'Delete']);
    ov.head.acts![0].f();
    expect(h.calls.writes[0]).toEqual(['download', id]);
    ov.head.acts![2].f();
    expect(await h.calls.confirms[0].fn()).toBe('');
    expect(h.calls.go).toContain('unstructured');
    const vs = table(liveDocumentScreen(h, id, 'versions', null));
    expect(vs.rows!.map((r) => [r.cells[0].v, r.cells[5].v])).toEqual([['v2', 'Current'], ['v1', '—']]);
    expect(formVal(liveDocumentScreen(h, id, 'content', null), 'Extracted content')?.v).toBe('Not available from KAP');
    // not loaded yet: nothing from the sample data
    expect(liveDocumentScreen(h, 'sandbox_docs:Missing.pdf', undefined, null).sections).toEqual([]);
  });

  it('manages KAP entity types and keeps relationship types session-only', async () => {
    const h = liveHub();
    const m = liveEntitiesScreen(h, { tab: 'types', setTab: () => {}, setType: () => {}, setSel: () => {} });
    const row = table(m).rows![0];
    expect(row.cells.slice(0, 5).map((c) => c.v)).toEqual(['Customer', '4', 'customer_id', '0', 'sandbox_docs']);
    m.head.add!.f();
    expect(await h.calls.forms[0].save({ n: 'Sup plier', idn: 'x' })).toMatch(/no spaces/);
    expect(await h.calls.forms[0].save({ n: 'Supplier', d: 'Suppliers', idn: 'supplier_id', idt: 'Text' })).toBe('');
    expect(h.calls.writes[0][0]).toBe('createEntityType');
    // add an attribute: PATCH with the whole schema
    row.acts![0].f();
    expect(await h.calls.forms[1].save({ n: 'vip', ty: 'Boolean', req: 'No' })).toBe('');
    const [, name, body] = h.calls.writes[1] as [string, string, { schema: { properties: Record<string, unknown> } }];
    expect(name).toBe('Customer');
    expect(Object.keys(body.schema.properties)).toEqual(['customer_id', 'since', 'segment', 'revenue', 'vip']);
    // delete is blocked while a collection uses the type
    row.acts![2].f();
    expect(h.calls.forms[2].title).toBe('Delete entity type Customer?');
    expect(h.calls.writes).toHaveLength(2);

    expect(liveEntitiesScreen(h, { tab: 'rels', setTab: () => {}, setType: () => {}, setSel: () => {} }).sections[0].note).toMatch(/session/);
    const inst = liveEntitiesScreen(h, { tab: 'inst', setTab: () => {}, setType: () => {}, setSel: () => {} });
    expect(formVal(inst, 'Extracted entities')?.v).toBe('Not available from KAP');
    const ag = table(liveEntitiesScreen(h, { tab: 'agents', setTab: () => {}, setType: () => {}, setSel: () => {} }));
    expect(ag.rows!.map((r) => r.cells.map((c) => c.v))).toEqual([['sbx_research_agent', 'sandbox_docs', 'Customer']]);
  });
});
