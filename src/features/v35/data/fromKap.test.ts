import { describe, expect, it } from 'vitest';
import { initialBusinessData } from '@/v35/data/businessData';
import {
  ago, agentCollections, attrsOfSchema, checkCollection, checkEntityTypeName, checkObservation, collectionOfDataset, collectionsUsingType, docIds, kindOf, parseDocId, periodLabel, procStatus,
  schemaWithAttr, schemaWithoutAttr, toIngestRef, toKapCollectionCreate, toKapCollectionPatch, toKapEntityTypeCreate, toKapObservationPatch, toOntoType, toTenantData,
} from './fromKap';
import { NOW, fixtureCache, kColl, kFile, kObs } from './fromKap.fixtures';

describe('KAP → Business Data Hub', () => {
  it('tells indicator collections from document collections', () => {
    const c = fixtureCache();
    expect(kindOf(c.collections[0], c.pipelines)).toBe('indicators');
    expect(kindOf(c.collections[1], c.pipelines)).toBe('document');
    // pipelines not readable: the pipeline's name decides
    expect(kindOf(c.collections[0], null)).toBe('indicators');
    expect(kindOf(kColl('x', 'docs'), null)).toBe('document');
  });

  it('maps collections with counts from KAP and no invented usage', () => {
    const D = toTenantData(fixtureCache(), null, NOW);
    expect(D.collections.map((c) => c.id)).toEqual(['sandbox_indicators', 'sandbox_docs']);
    const [ind, docs] = D.collections;
    expect(ind.ds).toEqual(['sandbox_indicators_observations']);
    expect(ind.docs).toEqual([]);
    expect(docs.docs).toEqual(['sandbox_docs:Broken.docx', 'sandbox_docs:Guide.pdf']);
    expect(docs.extraDocs).toBe(1);
    expect(docs.desc).toBe('Documents · pipeline docs_pipeline · sbx_bucket, sbx_mail');
    expect([docs.uses7, docs.last, docs.search]).toEqual([0, '—', null]);
  });

  it('maps indicator observations to a structured dataset', () => {
    const D = toTenantData(fixtureCache(), null, NOW);
    expect(D.datasets).toHaveLength(1);
    const d = D.datasets[0];
    expect([d.id, d.rows, d.st, d.kind]).toEqual(['sandbox_indicators_observations', 520, '3 to review', 'Time series']);
    expect(d.preview[0]).toEqual(['TST-001', 'Test growth', '2026-Q2', 'Qatar', '3.1 %', 'valid', '—', 'observations_2026.csv · row 12', '1 d ago']);
    expect(d.preview[1].slice(2, 7)).toEqual(['2026-09', 'Qatar', '—', 'needs_review', 'value out of range']);
    // package files with KAP versions; rows per file are not reported
    expect(d.files).toEqual([['observations_2026.csv', 'v4', '—', '2 d ago']]);
    expect(collectionOfDataset(fixtureCache(), d.id)?.name).toBe('sandbox_indicators');
  });

  it('maps files to documents with state and versions', () => {
    const D = toTenantData(fixtureCache(), null, NOW);
    expect(D.documents.map((d) => d.id)).toEqual(['sandbox_docs:Broken.docx', 'sandbox_docs:Guide.pdf']);
    const [bad, ok] = D.documents;
    expect([ok.ty, ok.pst, ok.idx, ok.ex, ok.at, ok.cls, ok.lang, ok.pages, ok.chunks, ok.entSt]).toEqual(['PDF', 'Completed', 'Indexed', 'Done', '2026-11-22', '', '—', 0, 0, '—']);
    expect(ok.vers).toEqual([['v2', '2026-11-22', 'Current · not processed'], ['v1', '2026-11-01', 'processed 2026-11-02']]);
    expect(ok.src).toEqual({ conn: 'sbx_bucket', pipe: 'docs_pipeline' });
    expect([bad.pst, bad.ex, bad.idx, bad.err]).toEqual(['Failed', 'Failed', 'Not indexed', 'KAP state: failed_parse']);
    expect(bad.vers).toEqual([['—', '—', 'No version stored yet']]);
  });

  it('keeps session-only parts from the previous slice', () => {
    const prev = toTenantData(fixtureCache(), null, NOW);
    prev.documents[1].cls = 'L0 · Public';
    prev.onto.rels.push({ n: 'owns', src: 'Customer', tgt: 'Customer', dir: 'Directed', card: 'One-to-many', ev: 'Same record', cnt: 0, guide: '' });
    // sample relationship types between types KAP does not have are dropped
    const sample = initialBusinessData().tenants.sandbox;
    expect(toTenantData(fixtureCache(), sample, NOW).onto.rels).toEqual([]);
    const next = toTenantData(fixtureCache(), prev, NOW);
    expect(next.documents[1].cls).toBe('L0 · Public');
    expect(next.onto.rels.map((r) => r.n)).toEqual(['owns']);
    expect(next.inst).toEqual([]);
  });

  it('maps entity types and their JSON Schema attributes', () => {
    const t = toOntoType(fixtureCache().entityTypes[0]);
    expect([t.n, t.d, t.guide, t.cnt]).toEqual(['Customer', 'Customer entities', '', 0]);
    expect(t.attrs).toEqual([
      { n: 'customer_id', ty: 'Text', id: false, req: true, hint: 'C###' },
      { n: 'since', ty: 'Date', id: false, req: false, hint: '' },
      { n: 'segment', ty: 'Category', id: false, req: false, hint: '' },
      { n: 'revenue', ty: 'Number', id: false, req: false, hint: '' },
    ]);
    expect(attrsOfSchema(null)).toEqual([]);
  });

  it('builds provenance from KAP pipelines and connectors', () => {
    const ing = toIngestRef(fixtureCache());
    expect(ing.sources.map((s) => [s.id, s.type])).toEqual([['sbx_bucket', 's3'], ['sbx_mail', 'imap']]);
    const ip = ing.pipelines.find((p) => p.id === 'indicator_pipeline')!;
    expect([ip.dsName, ip.src, ip.uSteps]).toEqual(['sandbox_indicators_observations', 'sbx_bucket', ['load_csv']]);
    expect(ing.pipelines.find((p) => p.id === 'docs_pipeline')!.entTypes).toEqual(['Customer']);
    expect(ing.runs).toEqual([]);
  });

  it('reads agent assignments and entity type references', () => {
    expect(agentCollections(fixtureCache().agents)).toEqual({ sandbox_indicators_agent: ['sandbox_indicators'], sbx_research_agent: ['sandbox_indicators', 'sandbox_docs'] });
    expect(agentCollections(null)).toEqual({});
    expect(collectionsUsingType(fixtureCache(), 'Customer')).toEqual(['sandbox_docs']);
  });

  it('gives documents stable ids and parses them back', () => {
    const c = fixtureCache();
    c.files.f4 = kFile('f40000000aaa', 'sandbox_docs', 'Guide.pdf', { source_path: '/other/Guide.pdf' });
    const ids = [...docIds(c).keys()];
    expect(ids).toContain('sandbox_docs:Guide.pdf');
    expect(ids).toContain('sandbox_docs:Guide.pdf #f4000000');
    expect(parseDocId('sandbox_docs:Guide.pdf #f4000000')).toEqual({ collection: 'sandbox_docs', name: 'Guide.pdf' });
    expect(parseDocId('nocolon')).toBeNull();
  });

  it('formats periods, states and times', () => {
    expect([periodLabel('quarter', '2026-10-01'), periodLabel('month', '2026-03-01'), periodLabel('year', '2025-01-01')]).toEqual(['2026-Q4', '2026-03', '2025']);
    expect([procStatus('pending'), procStatus('embedding'), procStatus('activated'), procStatus('failed_embed'), procStatus('loaded'), procStatus('loaded', 'indicators')]).toEqual(['Pending', 'Processing', 'Completed', 'Failed', 'Processing', 'Completed']);
    // documents finish at `embedded` (verified on the test stand, 25 Nov 2026)
    expect([procStatus('embedded'), procStatus('embedded', 'indicators')]).toEqual(['Completed', 'Processing']);
    expect([ago(null, NOW), ago('2026-11-24T11:58:00Z', NOW), ago('2026-11-24T09:00:00Z', NOW), ago('2026-11-20T12:00:00Z', NOW)]).toEqual(['—', '2 min ago', '3 h ago', '4 d ago']);
  });
});

describe('Business Data Hub → KAP bodies', () => {
  it('creates a collection', () => {
    expect(toKapCollectionCreate({ name: ' supplier_docs ', pipeline: 'docs_pipeline', connectors: ['sbx_bucket'], sync: 'overwrite', entity: 'Off' })).toEqual({ name: 'supplier_docs', pipeline_ref: 'docs_pipeline', connectors: ['sbx_bucket'], sync_strategy: 'overwrite', entity: { enabled: false } });
    expect(toKapCollectionCreate({ name: 'cust', pipeline: 'p', connectors: ['c'], sync: '', entity: 'Customer' }).entity).toEqual({ enabled: true, entity_type_ref: 'Customer' });
    expect(checkCollection({ name: 'ab', pipeline: 'p', connectors: ['c'] }, true, [])).toMatch(/4–32/);
    expect(checkCollection({ name: 'sandbox_docs', pipeline: 'p', connectors: ['c'] }, true, ['sandbox_docs'])).toMatch(/exists/);
    expect(checkCollection({ name: 'new_one', pipeline: 'p', connectors: [] }, true, [])).toMatch(/connector/);
    expect(checkCollection({ pipeline: 'p', connectors: ['c'] }, false, [])).toBe('');
  });

  it('patches only what changed and keeps the other entity rules', () => {
    const c = fixtureCache().collections[1];
    expect(toKapCollectionPatch(c, { pipeline: 'docs_pipeline', connectors: ['sbx_mail', 'sbx_bucket'], sync: 'unique_name', entity: 'Customer' })).toBeNull();
    expect(toKapCollectionPatch(c, { connectors: ['sbx_bucket'], sync: 'overwrite' })).toEqual({ connectors: ['sbx_bucket'], sync_strategy: 'overwrite' });
    expect(toKapCollectionPatch(c, { entity: 'Off' })).toEqual({ entity: { enabled: false, entity_type_ref: 'Customer', boundary: { strategy: 'folder' } } });
  });

  it('corrects an observation', () => {
    const o = kObs('o2', { status: 'needs_review', value: null, issues: ['value out of range'] });
    expect(toKapObservationPatch(o, { value: '4.2', status: 'valid' })).toEqual({ value: 4.2, status: 'valid' });
    expect(toKapObservationPatch(o, { value: '', status: 'needs_review' })).toBeNull();
    expect(toKapObservationPatch(kObs('o1'), { value: '', status: 'valid' })).toEqual({ value: null });
    expect(checkObservation({ value: 'abc' })).toMatch(/number/);
    expect(checkObservation({ value: '', status: 'valid' })).toMatch(/only be valid with a value/);
    expect(checkObservation({ value: '1.5', status: 'valid' })).toBe('');
  });

  it('builds entity type bodies and schema changes', () => {
    expect(toKapEntityTypeCreate({ n: 'Supplier', d: 'Suppliers', idn: 'supplier_id', idt: 'Text' })).toEqual({ name: 'Supplier', description: 'Suppliers', schema: { type: 'object', properties: { supplier_id: { type: 'string' } }, required: ['supplier_id'] } });
    expect(checkEntityTypeName('Sup plier', [])).toMatch(/no spaces/);
    expect(checkEntityTypeName('customer', ['Customer'])).toMatch(/exists/);
    const s0 = fixtureCache().entityTypes[0].schema;
    const s1 = schemaWithAttr(s0, { n: 'vip', ty: 'Boolean', req: true, hint: 'Key account' });
    expect(s1.properties.vip).toEqual({ type: 'boolean', description: 'Key account' });
    expect(s1.required).toEqual(['customer_id', 'vip']);
    expect(s0.properties.vip).toBeUndefined();
    const s2 = schemaWithoutAttr(s1, 'customer_id');
    expect(Object.keys(s2.properties)).toEqual(['since', 'segment', 'revenue', 'vip']);
    expect(s2.required).toEqual(['vip']);
    expect(schemaWithoutAttr(s2, 'vip').required).toBeUndefined();
  });
});
