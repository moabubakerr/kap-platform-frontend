import { describe, expect, it, vi } from 'vitest';
import { ingestInit, type IngestTenant } from '@/v35/data/ingest';
import { pipeScreen, pipesScreen, runScreen, runsScreen, sourceScreen, sourcesScreen, type IngestCtx } from './build';
import { finishRun, ihLoc, kindOf, outOf, pipeOf, queueRun, startRun, testConn } from './logic';
import { pipeRecord, sourceRecord, validatePipe, validateSource } from './wizards';

const noop = () => {};
function ctx(H: IngestTenant, o: Partial<Pick<IngestCtx, 'canData' | 'canRun' | 'canConfigure'>> = {}): IngestCtx {
  const go = { sources: noop, pipes: noop, runs: noop, source: vi.fn(), pipe: vi.fn(), run: vi.fn(), dataset: vi.fn(), document: vi.fn(), collection: vi.fn(), security: vi.fn() };
  const a = { addSource: vi.fn(), editSource: vi.fn(), testSource: vi.fn(), toggleSource: vi.fn(), addPipe: vi.fn(), editPipe: vi.fn(), togglePipe: vi.fn(), runNow: vi.fn(), retryFailed: vi.fn(), retryRun: vi.fn() };
  return { H, canData: true, canRun: true, canConfigure: true, go, a, ...o };
}
const sceai = () => ingestInit().sceai;
const labels = (acts?: { l: string }[]) => (acts ?? []).map((x) => x.l);

describe('ingest data', () => {
  it('ports all three tenants', () => {
    const D = ingestInit();
    expect([D.sceai.sources.length, D.sceai.pipelines.length, D.sceai.runs.length]).toEqual([5, 8, 8]);
    expect([D.econ.sources.length, D.econ.pipelines.length, D.econ.runs.length]).toEqual([1, 2, 1]);
    expect([D.sandbox.sources.length, D.sandbox.pipelines.length, D.sandbox.runs.length]).toEqual([2, 3, 2]);
    expect(D.sceai.sources.filter((s) => s.impl === 'Planned').map((s) => s.id)).toEqual(['sceai_projects_db', 'sceai_dwh', 'finance_share']);
  });

  it('derives location, input kind and output', () => {
    const H = sceai();
    expect(ihLoc(H.sources[0])).toBe('s3://sceai-data · https://s3.kap.internal');
    expect(ihLoc(H.sources[2])).toBe('sql-pm.sceai.internal:1433 / ProjectsDB');
    expect(ihLoc(H.sources[3])).toBe('sceai-synapse.sql.azuresynapse.net / econdw');
    const k = (id: string) => kindOf(H, pipeOf(H, id)!.v);
    expect([k('indicators_csv_ingest'), k('docs_docx_ingest'), k('manual_uploads'), k('articles_html_ingest'), k('projects_sql_extract')]).toEqual(['Structured', 'Unstructured', 'Mixed', 'Unstructured', 'Structured']);
    expect(outOf(H, pipeOf(H, 'manual_uploads')!.v)).toBe('Structured and Unstructured Data');
  });

  it('simulates connection tests', () => {
    expect(testConn('File repository', { path: '\\\\fs01.x' }).ok).toBe(false);
    expect(testConn('S3', { bucket: 'b' })).toEqual({ ok: true, msg: 'Bucket listed; base path readable. Simulated result.' });
  });
});

describe('data sources', () => {
  it('lists sources with the design columns and gates create', () => {
    const m = sourcesScreen(ctx(sceai()), {}, noop);
    expect(m.head.title).toBe('Data Sources');
    expect(m.head.add?.l).toBe('Create data source');
    expect(m.sections[0].cols).toEqual(['Source', 'Type', 'Endpoint or location', 'Connection', 'Pipelines using it', 'Last check']);
    const bucket = m.sections[0].rows![0];
    expect(bucket.cells[4].v).toBe('3');
    expect(sourcesScreen(ctx(sceai(), { canData: false }), {}, noop).head.add).toBeUndefined();
  });

  it('filters by status and name', () => {
    const rows = (f: Record<string, string>) => sourcesScreen(ctx(sceai()), f, noop).sections[0].rows!.map((r) => r.key);
    expect(rows({ st: 'Failed' })).toEqual(['s:finance_share']);
    expect(rows({ q: 'warehouse' })).toEqual(['s:sceai_dwh']);
    expect(rows({ type: 'Any type', st: 'Any status' })).toHaveLength(5);
  });

  it('builds the source tabs and gates actions', () => {
    const H = sceai();
    const ov = sourceScreen(ctx(H), 'sceai_bucket', undefined, noop);
    expect(ov.head.status).toEqual(['approved', 'Implemented']);
    expect(labels(ov.sections[0].sacts)).toEqual(['Edit', 'Test connection', 'Disable']);
    expect(sourceScreen(ctx(H, { canData: false }), 'sceai_bucket', 'overview', noop).sections[0].sacts).toEqual([]);
    const conn = sourceScreen(ctx(H, { canConfigure: false }), 'sceai_bucket', 'conn', noop).sections[0].rows!;
    const cred = conn.find((r) => r.cells[0].v === 'Managed credential')!;
    expect(cred.lockTip).toBe('Secret values are never displayed');
    expect(cred.acts).toEqual([]);
    const browse = sourceScreen(ctx(H), 'finance_share', 'browse', noop).sections[0];
    expect(browse.note).toMatch(/^Discovery is not available: Access denied/);
    expect(browse.rows).toEqual([]);
    expect(sourceScreen(ctx(H), 'sceai_dwh', 'pipes', noop).sections[0].rows!.map((r) => r.key)).toEqual(['up:trade_dwh_extract']);
    expect(sourceScreen(ctx(H), 'nope', undefined, noop).sections[0].callout).toMatch(/No data source nope/);
  });
});

describe('pipelines', () => {
  it('lists pipelines with run actions and lock tips', () => {
    const m = pipesScreen(ctx(sceai()), {}, noop);
    const row = (id: string) => m.sections[0].rows!.find((r) => r.key === `p:${id}`)!;
    expect(labels(row('indicators_csv_ingest').acts)).toEqual(['Open', 'Run']);
    expect(labels(row('manual_uploads').acts)).toEqual(['Open', 'Upload']);
    expect(row('finance_reports_sync').lockTip).toBe('Pipeline is disabled');
    expect(row('statistics_zip_ingest').cells[6].p).toEqual(['approved', 'Succeeded']);
    const ro = pipesScreen(ctx(sceai(), { canData: false, canRun: false }), {}, noop);
    expect(ro.head.add).toBeUndefined();
    expect(labels(ro.sections[0].rows![0].acts)).toEqual(['Open']);
    expect(ro.sections[0].rows!.find((r) => r.key === 'p:finance_reports_sync')!.lockTip).toBeUndefined();
  });

  it('filters by output and state', () => {
    const rows = (f: Record<string, string>) => pipesScreen(ctx(sceai()), f, noop).sections[0].rows!.map((r) => r.key);
    expect(rows({ on: 'Disabled' })).toEqual(['p:finance_reports_sync']);
    expect(rows({ out: 'Structured and Unstructured Data' })).toEqual(['p:manual_uploads']);
  });

  it('builds the pipeline flow, configuration and dependencies', () => {
    const H = sceai();
    const ov = pipeScreen(ctx(H), 'docs_docx_ingest', undefined, noop, null, noop);
    const ids = ov.sections[0].dgm!.nodes.map((n) => n.id);
    expect(ids).toContain('out:es');
    expect(ids).toContain('out:ud');
    expect(ids).not.toContain('out:sd');
    expect(labels(ov.sections[1].sacts)).toEqual(['Edit pipeline', 'Run now', 'Disable', 'View runs']);
    const sel = pipeScreen(ctx(H), 'docs_docx_ingest', 'overview', noop, 'out:es', noop).sections[0].dgm!;
    expect(sel.inspectT).toBe('Selected · Entity Store');
    const cfg = pipeScreen(ctx(H), 'statistics_zip_ingest', 'config', noop, null, noop);
    expect(cfg.sections[2].rows![0].cells[2].v).toBe('Archive extraction');
    expect(cfg.sections[2].rows).toHaveLength(6);
    const deps = pipeScreen(ctx(H), 'statistics_zip_ingest', 'deps', noop, null, noop);
    expect(deps.sections[1].rows!.map((r) => r.cells[0].v)).toEqual(['psa_labour_force_2026_10', 'psa_prices_2026_10', 'psa_trade_2026_10']);
    expect(deps.sections[3].note).toBe('None configured. Published data is still available in Business Data Hub.');
  });
});

describe('runs', () => {
  it('lists and filters runs', () => {
    const m = runsScreen(ctx(sceai()), {}, noop);
    expect(m.sections[0].cols).toEqual(['Run', 'Pipeline', 'Data source', 'Trigger', 'Started', 'Duration', 'Status', 'Input → output', 'Errors']);
    expect(m.sections[0].rows).toHaveLength(8);
    const keys = (f: Record<string, string>) => runsScreen(ctx(sceai()), f, noop).sections[0].rows!.map((r) => r.key);
    expect(keys({ st: 'Partially succeeded' })).toEqual(['r:R-0086']);
    expect(keys({ src: 'Manual upload' })).toEqual(['r:R-0089']);
    expect(keys({ per: 'Last 24 hours' })).not.toContain('r:R-0085');
  });

  it('offers retries exactly as the design does', () => {
    const H = sceai();
    const r86 = runScreen(ctx(H), 'R-0086', undefined, noop, null, noop).sections[0];
    expect(labels(r86.sacts)).toEqual(['Retry failed items (1)', 'Retry run', 'View logs']);
    expect(r86.callout).toBe('1 failed item(s) cannot be retried until the source file is fixed.');
    expect(runScreen(ctx(H, { canRun: false }), 'R-0086', undefined, noop, null, noop).sections[0].sacts!.map((x) => x.l)).toEqual(['View logs']);
    expect(runScreen(ctx(H), 'R-0093', undefined, noop, null, noop).sections[0].callout).toBe('Nothing to retry.');
    const D = ingestInit();
    expect(runScreen(ctx(D.sandbox), 'R-0112', undefined, noop, null, noop).sections[0].callout).toBe('Retry is available when the run has finished.');
  });

  it('builds stages, items, logs and lineage', () => {
    const H = sceai();
    const st = runScreen(ctx(H), 'R-0086', 'stages', noop, null, noop);
    expect(st.sections[0].dgm!.nodes.find((n) => n.id === 'st:Text extraction / OCR')!.tone).toBe('warn');
    expect(st.sections[1].rows).toHaveLength(7);
    const items = runScreen(ctx(H), 'R-0091', 'items', noop, null, noop).sections[0];
    expect(items.note).toBe('Files extracted from an archive are listed under the archive.');
    expect(items.rows![1].cells[0].v).toBe('↳ labour_force.csv');
    const err = runScreen(ctx(H), 'R-0086', 'errors', noop, null, noop);
    expect(err.sections[0].rows).toHaveLength(2);
    expect(err.sections[1].rows![1].cells[1].p).toEqual(['rejected', 'ERROR']);
    const lin = runScreen(ctx(H), 'R-0086', 'lineage', noop, null, noop);
    expect(lin.sections[1].rows!.map((r) => r.cells[1].v)).toEqual(['nds_planning_docs', 'nds_planning_docs']);
    expect(labels(lin.sections[1].rows![0].acts)).toEqual(['Open in Unstructured Data']);
  });
});

describe('run simulation', () => {
  it('re-runs the previous inputs and publishes to the configured collection', () => {
    const H = sceai();
    const r = queueRun(H, 'indicators_csv_ingest', 'sceai_admin', {}, '10:00:00');
    expect(r.id).toBe('R-0481');
    expect(r.items).toHaveLength(3);
    expect(r.trig).toBe('Manual · sceai_admin');
    H.runs.unshift(r);
    startRun(r, '10:00:01');
    expect(r.st).toBe('Running');
    const msg = finishRun(H, r.id, '10:00:03');
    expect(msg).toBe('R-0481 succeeded: 1 dataset.');
    expect(r.outDs).toEqual(['sceai_indicator_observations']);
    expect(r.stages.map((s) => s[0])).toEqual(['Parse files', 'Schema detection and mapping', 'Validation', 'Normalization and deduplication', 'Load structured records']);
  });

  it('retries only the retryable failed items', () => {
    const H = sceai();
    const r = queueRun(H, 'docs_docx_ingest', 'sceai_admin', { retryOf: 'R-0086', trig: 'Retry of R-0086 · sceai_admin' });
    expect(r.items.map((x) => x.n)).toEqual(['NDS3_Consultation_scan.pdf']);
    H.runs.unshift(r);
    finishRun(H, r.id);
    expect(r.st).toBe('Succeeded');
    expect(H.pub.colls.find((c) => c.id === 'nds_planning_docs')!.docs).toContain('NDS3_Consultation_scan.pdf');
    expect(H.runs.find((x) => x.id === 'R-0086')!.logs.slice(-1)[0][2]).toBe(`Failed items retried in ${r.id} (succeeded)`);
  });

  it('keeps previously failed items failed on a plain re-run', () => {
    const H = sceai();
    const r = queueRun(H, 'docs_docx_ingest', 'u');
    H.runs.unshift(r);
    expect(finishRun(H, r.id)).toBe(`${r.id} partially succeeded: 2 documents · 2 failed.`);
  });
});

describe('wizards', () => {
  it('validates data sources', () => {
    const H = sceai();
    expect(validateSource(H, false, 1, { id: 'X' })).toBe('Name: 3–41 lower-case letters, digits and underscores.');
    expect(validateSource(H, false, 1, { id: 'sceai_bucket' })).toBe('A data source with this name exists.');
    expect(validateSource(H, false, 2, { type: 'Microsoft SQL Server', server: 's', port: 'x', db: 'd' })).toBe('Port must be a number.');
    expect(validateSource(H, false, 3, { auth: 'Access key', cred: 'Not needed (identity-based)' })).toBe('Choose a managed credential for Access key.');
    expect(validateSource(H, false, 4, {})).toBe('Run the connection test first.');
    const saved = sourceRecord({ type: 'S3', id: 'new_bucket', endpoint: 'https://s3', region: 'r', bucket: 'b', auth: 'Access key', cred: 'sceai_bucket_key', __test: { ok: true, msg: '' } }, null, 'me');
    expect(saved.rec.st).toBe('Connected');
    expect(saved.rec.impl).toBe('Implemented');
  });

  it('validates pipelines and records the configuration', () => {
    const H = sceai();
    expect(validatePipe(H, false, 0, { id: 'new_pipe', srcL: 'finance_share · File repository' })).toBe('finance_share failed its last connection test. Fix and test it before using it in a pipeline.');
    expect(validatePipe(H, false, 1, { srcL: 'sceai_projects_db · Microsoft SQL Server', objs: [], query: 'None' })).toBe('Select at least one table or view, or a saved query.');
    expect(validatePipe(H, false, 2, { srcL: 'sceai_bucket · S3', pat: '*.pdf', uSteps: ['Chunking'] })).toBe('The document path needs Text extraction / OCR, Embedding generation, Vector indexing.');
    const saved = pipeRecord(H, { id: 'new_pipe', srcL: 'sceai_bucket · S3', onL: 'Enabled', pat: '*.csv', zip: 'No', sSteps: ['Parse files', 'Load structured records'], dsName: 'x', first: 'Save and run now' }, null);
    expect(saved.rec.impl).toBe('Implemented');
    expect(saved.rec.v.src).toBe('sceai_bucket');
    expect(saved.runNow).toBe(true);
  });
});
