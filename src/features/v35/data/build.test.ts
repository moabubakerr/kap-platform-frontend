import { describe, expect, it } from 'vitest';
import { can, iamStore, type IamData } from '@/v35/iam';
import { blockingPolicies, initialBusinessData, INGEST_REF, policiesOf, type BusinessData, type DataTenant } from '@/v35/data/businessData';
import type { Row, ScreenModel } from '@/engine/types';
import {
  collectionScreen, collectionsScreen, datasetScreen, datasetsScreen, documentResults, documentScreen, documentsScreen, effectiveRead, entitiesScreen, entP, ontologyLayout, qualityRows, type DataUi, type Hub,
} from './build';
import { UD_DEFAULT } from './session';

type Log = { go: string[]; toasts: string[]; forms: string[] };

function hub(uid: string, t: DataTenant, data: BusinessData = initialBusinessData(), iam: IamData = structuredClone(iamStore.get())): Hub & { log: Log } {
  const log: Log = { go: [], toasts: [], forms: [] };
  const ui: DataUi = {
    go: (p) => log.go.push(p),
    form: (title) => log.forms.push(title),
    confirm: (title) => log.forms.push(title),
    toast: (m) => log.toasts.push(m),
    setD: (fn, toast) => { fn(data.tenants[t], data); log.toasts.push(toast); },
    setIam: (fn, toast) => { fn(iam); log.toasts.push(toast); },
    later: (fn) => fn(),
  };
  return {
    t, all: data, D: data.tenants[t], iam, ing: INGEST_REF[t], ui, log, effU: uid, setEffU: () => {},
    acc: {
      uid,
      canData: can(uid, t, 'data:manage', 'collection', '*'),
      canGrant: can(uid, t, 'grant:manage', 'tenant', '*'),
      canRead: (c) => can(uid, t, 'collection:read', 'collection', c) || can(uid, t, 'data:manage', 'collection', c),
      canAgent: (p, a) => can(uid, t, p, 'agent', a),
    },
  };
}

const table = (m: ScreenModel, i = 0) => m.sections.filter((s) => s.cols)[i];
const firstCells = (rows: Row[] | undefined) => (rows ?? []).map((r) => r.cells[0].v);
const formVal = (m: ScreenModel, label: string) => m.sections.flatMap((s) => (s.form ? s.rows ?? [] : [])).find((r) => r.cells[0].v === label)?.cells[1];

describe('business data (dhInit + dhExtend)', () => {
  it('builds the document inventory per tenant', () => {
    const d = initialBusinessData();
    expect(d.tenants.sceai.documents).toHaveLength(6 + 90 + 11 + 16);
    expect(d.tenants.econ.documents).toHaveLength(48);
    expect(d.tenants.sandbox.documents).toHaveLength(7);
    const arts = d.tenants.sceai.collections.find((c) => c.id === 'sceai_articles')!;
    expect(arts.docs).toHaveLength(92);
    expect(arts.extraDocs).toBe(0);
    const draft = d.tenants.sceai.documents.find((x) => x.id === 'SCEAI_Annual_Review_draft.docx')!;
    expect([draft.cls, draft.entSt, draft.pst]).toEqual(['L1 · Internal', 'Failed', 'Failed']);
    expect(d.tenants.sceai.documents.find((x) => x.id === 'article_2026-11-12_tourism.html')!.at).toBe('2026-11-13');
    expect(d.tenants.sceai.documents.find((x) => x.id === 'Regional_outlook_2027.pdf')!.pst).toBe('Processing');
  });

  it('classifies documents by their own classification attribute', () => {
    const d = initialBusinessData();
    const pols = iamStore.get().policies;
    expect(policiesOf(pols, d.tenants.sandbox.documents, 'sandbox', 'document:C001_Service_Agreement.pdf').map((p) => p.n)).toEqual(['L2 · Confidential', 'Customer data']);
    expect(blockingPolicies(pols, d.tenants.sandbox.documents, 'sandbox', 'document:Open_Data_Guide.pdf', ['sbx_testers'])).toEqual([]);
    expect(blockingPolicies(pols, d.tenants.sandbox.documents, 'sandbox', 'document:Model_Risk_Assessment.docx', ['sbx_testers']).map((p) => p.n)).toEqual(['L2 · Confidential']);
  });
});

describe('collections', () => {
  it('lists only collections the viewer may read, with contents and policies', () => {
    const m = collectionsScreen(hub('sceai_admin', 'sceai'));
    expect(m.head.add?.l).toBe('Create collection');
    const rows = table(m).rows!;
    expect(firstCells(rows)).toEqual(['sceai_indicators', 'sceai_articles', 'nds_planning_docs']);
    expect(rows[1].cells[1].v).toBe('92 documents');
    expect(rows[2].cells[2].p).toEqual(['hold', '1 failed']);
    expect(rows[0].cells[3].v).toBe('L1 · Internal');
    expect(rows[0].cells[4].v).toBe('sceai_indicators_agent, sceai_indicators_oxford, Indicator Picker');

    const ea = collectionsScreen(hub('ea_analyst', 'econ'));
    expect(ea.head.add).toBeUndefined();
    expect(firstCells(table(ea).rows)).toEqual(['econ_indicators', 'budget_reports']);

    const sbx = collectionsScreen(hub('sbx_analyst', 'sandbox'));
    expect(firstCells(table(sbx).rows)).toEqual(['sandbox_indicators', 'sandbox_public_docs']);
  });

  it('creates a collection through the form and validates the name', () => {
    const h = hub('sceai_admin', 'sceai');
    let save: ((v: Record<string, unknown>) => string) | null = null;
    h.ui.form = (_t, _f, _s, fn) => { save = fn as (v: Record<string, unknown>) => string; };
    collectionsScreen(h).head.add!.f();
    expect(save!({ id: 'X' })).toBe('Use 3–40 lower-case letters, digits and underscores.');
    expect(save!({ id: 'sceai_articles' })).toBe('A collection with this name exists.');
    expect(save!({ id: 'supplier_contracts', desc: 'Contracts' })).toBe('');
    expect(h.D.collections[h.D.collections.length - 1].id).toBe('supplier_contracts');
    expect(h.log.toasts).toContain('supplier_contracts created. Add datasets or documents in Data Scope.');
  });

  it('denies a restricted collection and shows the overview to cleared users', () => {
    expect(collectionScreen(hub('sceai_analyst', 'sceai'), 'nds_planning_docs', undefined).denied).toMatch(/Ask a SCEAI tenant administrator/);
    const m = collectionScreen(hub('sceai_admin', 'sceai'), 'nds_planning_docs', 'overview');
    expect(formVal(m, 'Assets')?.v).toBe('14 documents');
    expect(formVal(m, 'Processing and index status')?.v).toBe('1 document failed extraction');
    expect(formVal(m, 'Entity types found')?.v).toBe('Organization, Strategic Objective, Indicator, Project, Person');
    expect(formVal(m, 'Access')?.v).toBe('L2 · Restricted, Strategy planning');
  });

  it('explains access: grants, policies and effective access', () => {
    const h = hub('sceai_admin', 'sceai');
    const m = collectionScreen(h, 'nds_planning_docs', 'access');
    expect(formVal(m, 'Groups with read access')?.v).toBe('tenant_admins');
    expect(effectiveRead(h, 'collection:nds_planning_docs', 'sceai_analyst')).toEqual({ ok: false, why: 'No read grant · member of economic_analysts' });
    expect(effectiveRead(h, 'dataset:sceai_indicator_observations', 'sceai_analyst')).toEqual({ ok: true, why: 'Analyst through economic_analysts · cleared by L1 · Internal' });
    // a need-to-know policy without the group blocks a granted reader
    const sbx = hub('r.haddad', 'sandbox');
    expect(effectiveRead(sbx, 'dataset:c001_transactions', 'sbx_analyst').why).toBe('Read grant through sbx_testers · not cleared by Customer data');
    expect(effectiveRead(h, 'collection:nds_planning_docs', 'sceai_admin').ok).toBe(true);
    const assigned = m.sections.find((s) => s.title === 'Assigned agents')!;
    expect(firstCells(assigned.rows)).toEqual(['sceai_indicators_agent', 'sceai_indicators_oxford']);
  });

  it('removes a dataset reference from a collection', () => {
    const h = hub('sceai_admin', 'sceai');
    let fn: (() => void) | null = null;
    h.ui.confirm = (_t, _b, _i, _c, f) => { fn = f; };
    const m = collectionScreen(h, 'sceai_indicators', 'scope');
    m.sections[0].rows![0].acts!.find((a) => a.l === 'Remove')!.f();
    fn!();
    expect(h.D.collections[0].ds).not.toContain('sceai_indicator_observations');
  });
});

describe('structured data', () => {
  it('lists datasets visible through readable collections', () => {
    expect(firstCells(table(datasetsScreen(hub('sceai_analyst', 'sceai'))).rows)).toEqual(['sceai_indicator_observations', 'sceai_indicator_definitions', 'sceai_strategy_targets']);
    const all = table(datasetsScreen(hub('sceai_admin', 'sceai'))).rows!;
    expect(all).toHaveLength(10);
    expect(all.find((r) => r.key === 'ds:psa_prices_2026_10')!.cells[4].v).toBe('sceai_bucket · statistics_zip_ingest');
    expect(all.find((r) => r.key === 'ds:sceai_indicator_definitions')!.cells[4].v).toBe('Maintained in KAP');
    // need-to-know on the dataset itself
    expect(table(datasetsScreen(hub('sbx_analyst', 'sandbox'))).rows!.map((r) => r.cells[0].v)).toEqual(['sandbox_indicator_observations']);
  });

  it('builds overview, quality and provenance', () => {
    const h = hub('sceai_admin', 'sceai');
    const ov = datasetScreen(h, 'sceai_indicator_observations', undefined);
    expect(formVal(ov, 'Fields')?.sub).toBe('Keys: indicator_id, country, period');
    expect(formVal(ov, 'Access policies')?.v).toBe('L1 · Internal');
    const q = qualityRows(h, h.D.datasets.find((d) => d.id === 'psa_prices_2026_10')!);
    expect(q[2]).toEqual(['Duplicate keys', ['hold', 'Corrected'], '12 duplicate rows removed', '2 h ago']);
    expect(qualityRows(h, h.D.datasets.find((d) => d.id === 'sceai_strategy_targets')!)[3][1]).toEqual(['hold', 'Stale']);
    const pv = datasetScreen(h, 'psa_prices_2026_10', 'prov');
    expect(formVal(pv, 'Ingestion run')?.v).toBe('R-0091');
    expect(formVal(pv, 'Ingestion run')?.sub).toBe('2 h ago · Succeeded · batch B-2026-10-STAT');
    expect(formVal(pv, 'Original file or source record')?.v).toBe('prices.csv');
  });
});

describe('unstructured data', () => {
  it('filters, sorts and pages documents the viewer may see', () => {
    const h = hub('sceai_admin', 'sceai');
    const r = documentResults(h, UD_DEFAULT);
    expect(r.all).toHaveLength(123);
    expect(r.rows[0].id).toBe('Board_minutes_2026-09.pdf');
    const m = documentsScreen(h, { ...UD_DEFAULT, coll: 'nds_planning_docs', sort: 'Name A–Z' }, () => {});
    expect(m.filters!.count).toBe('14 matching documents of 123');
    expect(m.filters!.chips!.map((c) => c.l)).toEqual(['Collection: nds_planning_docs']);
    expect(table(m).pager!.l).toBe('1–14 of 14');
    const fail = documentResults(h, { ...UD_DEFAULT, pst: 'Failed' });
    expect(fail.ids).toEqual(['SCEAI_Annual_Review_draft.docx', 'Site_inspection_report_07.pdf']);
    // analysts see only documents of the collections they may read
    expect(documentResults(hub('sceai_analyst', 'sceai'), UD_DEFAULT).all).toHaveLength(0);
    expect(documentResults(hub('sbx_analyst', 'sandbox'), UD_DEFAULT).ids).toEqual(['Open_Data_Guide.pdf']);
  });

  it('builds the document detail with previous / next and classification', () => {
    const h = hub('sceai_admin', 'sceai');
    const m = documentScreen(h, 'NDS2_Economic_Diversification.docx', undefined, ['a.pdf', 'NDS2_Economic_Diversification.docx', 'b.pdf']);
    expect(m.head.acts!.map((a) => a.l)).toEqual(['Back to results · 2 of 3', 'Previous', 'Next']);
    expect(formVal(m, 'Classification')?.v).toBe('L2 · Restricted');
    expect(formVal(m, 'Collection restrictions')?.v).toBe('L2 · Restricted, Strategy planning');
    expect(formVal(m, 'Entity extraction')?.v).toBe('14 entities');
    const ents = documentScreen(h, 'SCEAI_Annual_Review_2024.docx', 'ents', null);
    expect(firstCells(table(ents).rows)).toEqual(['Qatar Tourism', 'Investment Promotion Agency', 'Logistics free zone expansion', 'Planning and Statistics Authority', 'Director of Planning']);
    expect(documentScreen(hub('sbx_analyst', 'sandbox'), 'C001_Service_Agreement.pdf', undefined, null).denied).toBeTruthy();
    expect(entP({ entSt: 'Completed', entN: 1 })).toEqual(['approved', '1 entity']);
  });
});

describe('business entities', () => {
  it('lists entity types, relationship types and extracted entities', () => {
    const h = hub('sceai_admin', 'sceai');
    const v = { setTab: () => {}, setType: () => {}, setSel: () => {} };
    const types = entitiesScreen(h, { ...v, tab: 'types' });
    expect(types.head.add?.l).toBe('Create entity type');
    const org = table(types).rows![0];
    expect(org.cells.map((c) => c.v)).toEqual(['Organization', 'name', '3', '4', '27', 'docs_docx_ingest, articles_html_ingest']);
    expect(table(entitiesScreen(h, { ...v, tab: 'rels' })).rows).toHaveLength(7);
    const inst = entitiesScreen(h, { ...v, tab: 'inst', type: 'Organization' });
    expect(table(inst, 1).title).toBe('Examples · Organization');
    expect(firstCells(table(inst, 1).rows)).toEqual(['Qatar Tourism', 'Investment Promotion Agency', 'Planning and Statistics Authority']);
    const ag = entitiesScreen(h, { ...v, tab: 'agents' });
    expect(firstCells(table(ag).rows)).toEqual(['sceai_indicators_agent', 'Article Agent']);
    const sbx = entitiesScreen(hub('r.haddad', 'sandbox'), { ...v, tab: 'agents' });
    expect(table(sbx).rows![0].cells[4]).toMatchObject({ v: 'Not published', sub: 'Draft v1: Entities and relationships · Customer, Contract, Account' });
  });

  it('lays out the ontology map deterministically', () => {
    const h = hub('sceai_admin', 'sceai');
    const a = ontologyLayout(h.D.onto.types, h.D.onto.rels);
    expect(a).toEqual(ontologyLayout(h.D.onto.types, h.D.onto.rels));
    expect(Math.min(...a.map((p) => p.x))).toBeCloseTo(16);
    const map = entitiesScreen(h, { tab: 'map', sel: 'Sector', setTab: () => {}, setType: () => {}, setSel: () => {} }).sections[0].dgm!;
    expect(map.nodes).toHaveLength(6);
    expect(map.inspectT).toBe('Sector');
    expect(map.edges.filter((e) => e.tone === 'brand').map((e) => e.l)).toEqual(['operates_in', 'belongs_to']);
  });

  it('blocks deleting an entity type that is in use', () => {
    const h = hub('sceai_admin', 'sceai');
    const forms: string[] = [];
    h.ui.form = (t) => forms.push(t);
    const row = table(entitiesScreen(h, { tab: 'types', setTab: () => {}, setType: () => {}, setSel: () => {} })).rows![0];
    row.acts!.find((a) => a.l === 'Delete')!.f();
    expect(forms).toEqual(['Delete entity type Organization?']);
    expect(h.D.onto.types).toHaveLength(6);
  });
});
