import { describe, expect, it, vi } from 'vitest';
import type { IngestTenant } from '@/v35/data/ingest';
import { pipeScreen, runScreen, runsScreen, sourceScreen, sourcesScreen, type IngestCtx } from './build';
import {
  connectorValues, isSess, KEYS_REF, unsupportedExts, kapOfPipe, NEW_KEYS, pipelineValues, rel, runId, runStatus, span, toIngestTenant, toKapConnectorCreate, toKapConnectorPatch, toKapPipelineCreate, toKapPipelinePatch,
  toKapPipelineRestore, toKapRun, toPipeline, toRun, toSource, validateConnector, validatePipeline,
  type KapCollection, type KapConnector, type KapIngest, type KapJob, type KapPipeline,
} from './fromKap';
import { kindOf, nextRunId, pipeDgm, stageCfg } from './logic';
import { connectorWizard, typeOfChoice, SOURCE_TYPE_OPTS } from './liveWizards';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

// ------------------------------------------------------------------ fixtures shaped from ConnectorOut, PipelineOut, CollectionOut, PipelineJobDetail
const s3: KapConnector = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'sbx_docs',
  type: 's3',
  settings: { object_selector: { prefix: 'public/', include_globs: ['**/*.pdf', '**/*.docx'], exclude_globs: [] }, sync: { interval: 'PT1H', max_file_size: 1610612736 } },
  config: { bucket_name: 'sandbox-data', region: '', endpoint_url: 'https://s3.kap.internal', use_ssl: true, verify_tls: true, tls_ca_file: null, addressing_style: 'path', auth: { type: 'static_keys', access_key: { is_set: true }, secret_key: { is_set: true } } },
  is_active: true,
  created_at: ago(3 * 86400),
  updated_at: ago(2 * 3600),
};
const fsConn: KapConnector = { id: '22222222-2222-2222-2222-222222222222', name: 'local_fs', type: 'fs', settings: { object_selector: { prefix: '', include_globs: [], exclude_globs: [] }, sync: { interval: 'PT3M', max_file_size: 1 } }, config: { path: '/data/inbox' }, is_active: true, created_at: ago(86400), updated_at: ago(86400) };
const docPipe: KapPipeline = {
  id: '33333333-3333-3333-3333-333333333333',
  name: 'docs_pipeline',
  kind: 'document',
  mode: null,
  semantic: {},
  embedding_model_ref: null,
  stages: [
    { name: 'parse', type: 'parser', routes: [{ match: { extensions: ['pdf'] }, parser: { provider: 'pdf', output: 'markdown', config: { preserve_tables: true } } }, { match: { extensions: ['doc', 'docx'] }, parser: { provider: 'docx', output: 'markdown' } }] },
    { name: 'transform', type: 'transformer', config: { model_ref: 'chat_default', tasks: [{ name: 'summary', enabled: true }, { name: 'metadata', enabled: true }] } },
    { name: 'embed', type: 'embedding', config: { model_ref: 'embed_default', chunking: { chunk_size: 800, overlap: 120 } } },
  ],
  is_active: true,
  created_at: ago(86400),
  updated_at: ago(86400),
};
const indPipe: KapPipeline = {
  id: '44444444-4444-4444-4444-444444444444',
  name: 'indicator_pipeline',
  kind: 'indicators',
  mode: 'delta',
  semantic: { measure_texts: {} },
  embedding_model_ref: 'embed_default',
  stages: [{ name: 'load_csv', type: 'csv_loader', config: { files: { 'registry*.csv': 'registry', 'observations*.csv': 'observations' } } }],
  is_active: false,
  created_at: ago(86400),
  updated_at: ago(600),
};
const coll: KapCollection = { id: '55555555-5555-5555-5555-555555555555', name: 'sandbox_public_docs', pipeline_ref: 'docs_pipeline', connectors: ['sbx_docs'], sync_strategy: 'unique_name' };
const job = (o: Partial<KapJob>): KapJob => ({
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  pipeline_id: docPipe.id,
  collection_id: coll.id,
  connector_id: null,
  state: 'succeeded',
  progress: { total: 12, completed: 12, percent: 100 },
  created_at: ago(3700),
  running_at: ago(3600),
  finished_at: ago(3528),
  ...o,
});
const names = { pipes: { [docPipe.id]: docPipe.name }, colls: { [coll.id]: coll.name }, conns: { [s3.id]: s3.name } };

describe('time helpers', () => {
  it('formats relative times and durations', () => {
    expect([rel(ago(10), NOW), rel(ago(600), NOW), rel(ago(7200), NOW), rel(ago(3 * 86400), NOW), rel(null, NOW)]).toEqual(['just now', '10 min ago', '2 h ago', '3 d ago', '—']);
    expect([span(48_000), span(72_000), span(7_500_000)]).toEqual(['48 s', '1 min 12 s', '2 h 05 min']);
  });
});

describe('connectors → sources', () => {
  it('maps an S3 connector without inventing a check', () => {
    const s = toSource(s3, NOW);
    expect(s).toMatchObject({ id: 'sbx_docs', type: 'S3', st: 'Not tested', chk: 'Not checked', impl: 'Implemented', cred: 'Secret references (values never shown)', browse: [] });
    expect(s.cfg).toMatchObject({ endpoint: 'https://s3.kap.internal', bucket: 'sandbox-data', base: '/public/', include: '**/*.pdf, **/*.docx', exclude: 'None', interval: 'Every 1 h (PT1H)', ssl: 'Yes', addressing: 'path' });
    expect(s.kap).toEqual({ id: s3.id, type: 's3', active: true });
    expect(s.act.map((a) => a[2])).toEqual(['Configuration changed in KAP', 'Created in KAP']);
  });

  it('uses the session check result and deactivation', () => {
    expect(toSource(s3, NOW, { status: 'ok', checked_at: ago(60), reason_code: null })).toMatchObject({ st: 'Connected', chk: '1 min ago', err: '' });
    const bad = toSource(s3, NOW, { status: 'unavailable', checked_at: ago(60), reason_code: 'bucket_not_found' });
    expect(bad.st).toBe('Failed');
    expect(bad.err).toBe('The bucket does not exist. (bucket_not_found)');
    expect(toSource({ ...s3, is_active: false }, NOW).st).toBe('Disabled');
  });

  it('maps an fs connector as platform-managed', () => {
    const s = toSource(fsConn, NOW);
    expect(s).toMatchObject({ type: 'File repository', auth: 'Platform-managed', cfg: { path: '/data/inbox' } });
  });
});

describe('pipelines', () => {
  it('maps stages as KAP defines them and links collections and connectors', () => {
    const p = toPipeline(docPipe, [coll]);
    expect(p.v.uSteps).toEqual(['parse · Parser', 'transform · Transformer', 'embed · Embedding']);
    expect(p.v.sSteps).toEqual([]);
    expect(p.v.colls).toEqual(['sandbox_public_docs']);
    expect(p.v.src).toBe('sbx_docs');
    expect(p.v.pat).toBe('*.pdf, *.doc, *.docx');
    expect(stageCfg('parse · Parser', p.v)).toBe('pdf → pdf · doc, docx → docx');
    expect(stageCfg('embed · Embedding', p.v)).toBe('Model embed_default · chunks of 800 tokens, 120 overlap');
    expect(p.desc).toBe('Document pipeline · 3 stages');
    const i = toPipeline(indPipe, []);
    expect(i.on).toBe(false);
    expect(i.v.sSteps).toEqual(['load_csv · CSV loader']);
    expect(i.v.dsName).toBe('registry, observations');
    expect(i.v.src).toBe('');
  });

  it('kind and flow come from KAP, not the file pattern', () => {
    const H = { sources: [toSource(s3, NOW)], pipelines: [], runs: [] } as unknown as IngestTenant;
    expect(kindOf(H, toPipeline(docPipe, [coll]).v)).toBe('Unstructured');
    expect(kindOf(H, toPipeline(indPipe, []).v)).toBe('Structured');
    const g = pipeDgm(toPipeline(docPipe, [coll]).v, 'S3', 'Unstructured');
    expect(g.nodes.filter((n) => n.id.startsWith('st:')).map((n) => n.l1)).toEqual(['parse · Parser', 'transform · Transformer', 'embed · Embedding']);
  });
});

describe('jobs → runs', () => {
  it('maps a finished job with its result', () => {
    const r = toRun(job({ result: { succeeded: 11, failed: 1, cancelled: 0 }, error: null }), NOW, names);
    expect(r).toMatchObject({ id: 'aaaaaaaa', pipe: 'docs_pipeline', trig: 'Manual · sandbox_public_docs', start: '1 h ago', dur: '1 min 12 s', st: 'Partially succeeded', inN: '12 files', outN: '11 succeeded · 1 failed', errN: 1, items: [] });
    expect(r.kap).toMatchObject({ job: 'aaaaaaaa-0000-0000-0000-000000000001', collection: 'sandbox_public_docs', detail: true });
    expect(r.logs.map((l) => l[2])).toEqual(['Run registered for collection sandbox_public_docs', 'A worker started the run', 'Run succeeded · 11 succeeded, 1 failed, 0 cancelled']);
  });

  it('maps waiting, running, failed and cancelled jobs', () => {
    const w = toRun(job({ state: 'waiting', running_at: null, finished_at: null, progress: { total: null, completed: 0, percent: null }, connector_id: s3.id }), NOW, names);
    expect(w).toMatchObject({ st: 'Queued', dur: 'not started', inN: 'Discovering files…', outN: '0 of ? files finished', stages: [], trig: 'Manual · sandbox_public_docs · sbx_docs' });
    const run = toRun(job({ state: 'running', finished_at: null, progress: { total: 10, completed: 4, percent: 40 } }), NOW, names);
    expect(run).toMatchObject({ st: 'Running', dur: '1 h 00 min (running)', outN: '4 of 10 files finished' });
    expect(run.stages[0][5]).toBe('40% of files finished');
    const f = toRun(job({ state: 'failed', result: { succeeded: 0, failed: 0, cancelled: 0 }, error: { code: 'discovery_failed', message: 'The connector is unavailable.' } }), NOW, names);
    expect(f).toMatchObject({ st: 'Failed', errN: 1 });
    expect(f.logs[f.logs.length - 1]).toEqual([expect.any(String), 'ERROR', 'discovery_failed: The connector is unavailable.']);
    expect(runStatus({ state: 'cancelled', result: null })).toBe('Cancelled');
    expect(toRun(job({}), NOW, names).kap!.detail).toBe(false);
  });
});

describe('tenant slice', () => {
  const K: KapIngest = { conns: [s3, fsConn], pipes: [docPipe, indPipe], colls: [coll], jobs: [job({ result: { succeeded: 12, failed: 0, cancelled: 0 } })], models: [], checks: {} };

  it('replaces sample records and keeps session-only ones', () => {
    const prev = {
      sources: [{ id: 'sample', type: 'S3' }, { id: 'pg_sketch', type: 'Microsoft SQL Server', sess: true }],
      pipelines: [{ id: 'sample_pipe', v: { colls: [] } }, { id: 'pg_pipe', sess: true, v: { src: 'pg_sketch', colls: [] } }],
      runs: [{ id: 'R-0001', pipe: 'pg_pipe' }, { id: 'R-0002', pipe: 'sample_pipe' }],
      pub: { colls: [], datasets: ['x'], documents: [] },
      onto: ['Customer'],
      creds: [],
    } as unknown as IngestTenant;
    const H = toIngestTenant(K, prev, NOW);
    expect(H.sources.map((s) => s.id)).toEqual(['sbx_docs', 'local_fs', 'pg_sketch']);
    expect(H.pipelines.map((p) => p.id)).toEqual(['docs_pipeline', 'indicator_pipeline', 'pg_pipe']);
    expect(H.runs.map((r) => r.id)).toEqual(['aaaaaaaa', 'R-0001']);
    expect(H.pub.colls.map((c) => c.id)).toEqual(['sandbox_public_docs']);
    expect(isSess(H.sources[2])).toBe(true);
    expect(nextRunId(H)).toBe('R-0002');
  });
});

describe('connector bodies', () => {
  it('builds a create body with secret references', () => {
    const v = { ...connectorValues(null), name: 'new_bucket', endpoint_url: 'https://s3.x', bucket_name: 'my-bucket', include: '*.pdf, *.docx', key_mode: KEYS_REF, ak_id: 'a0000000-0000-0000-0000-000000000001', sk_id: 'a0000000-0000-0000-0000-000000000002' };
    expect(toKapConnectorCreate(v)).toEqual({
      name: 'new_bucket',
      type: 's3',
      settings: { object_selector: { prefix: '', include_globs: ['*.pdf', '*.docx'], exclude_globs: [] }, sync: { interval: 'PT3M' } },
      config: {
        bucket_name: 'my-bucket',
        endpoint_url: 'https://s3.x',
        use_ssl: true,
        verify_tls: true,
        addressing_style: 'auto',
        auth: {
          type: 'static_keys',
          access_key: { $secret: { backend: 'vault', secret_id: 'a0000000-0000-0000-0000-000000000001', version: '1' } },
          secret_key: { $secret: { backend: 'vault', secret_id: 'a0000000-0000-0000-0000-000000000002', version: '1' } },
        },
      },
    });
  });

  it('flags include patterns KAP cannot read', () => {
    expect(unsupportedExts('**/*.pdf, **/*.docx, **/*.txt, *.TXT, **/*.md')).toEqual(['txt', 'md']);
    expect(unsupportedExts('**/*.pdf, data/*, ')).toEqual([]);
  });

  it('sends typed key values by default (KAP without a secret store)', () => {
    const v = { ...connectorValues(null), name: 'qa_s3', endpoint_url: 'http://s3:9000', bucket_name: 'sandbox-sources', ak_value: 'AK', sk_value: 'SK' };
    expect(toKapConnectorCreate(v).config.auth).toEqual({ type: 'static_keys', access_key: 'AK', secret_key: 'SK' });
  });

  it('patches only what changed', () => {
    const v = connectorValues(s3);
    expect(toKapConnectorPatch(s3, v)).toBeNull();
    expect(toKapConnectorPatch(s3, { ...v, prefix: 'docs/', interval: 'P1D', verify_tls: 'No' })).toEqual({ settings: { object_selector: { prefix: 'docs/' }, sync: { interval: 'P1D' } }, config: { verify_tls: false } });
    const keys = toKapConnectorPatch(s3, { ...v, keys: NEW_KEYS, key_mode: KEYS_REF, backend: 'vault', ak_id: 'x', ak_ver: '2', sk_id: 'y', sk_ver: '3' }) as { config: { auth: unknown } };
    expect(keys.config.auth).toEqual({ type: 'static_keys', access_key: { $secret: { backend: 'vault', secret_id: 'x', version: '2' } }, secret_key: { $secret: { backend: 'vault', secret_id: 'y', version: '3' } } });
  });

  it('validates the wizard steps', () => {
    const v = connectorValues(null);
    expect(validateConnector(1, { ...v, name: 'ab' }, [], false, true)).toMatch(/4–32/);
    expect(validateConnector(1, { ...v, name: 'sbx_docs' }, ['sbx_docs'], false, true)).toMatch(/exists/);
    expect(validateConnector(2, { ...v, endpoint_url: 'https://s3.x', bucket_name: 'B' }, [], false, true)).toMatch(/Bucket/);
    expect(validateConnector(2, { ...v, endpoint_url: 'https://s3.x', bucket_name: 'ok-bucket', interval: '1h' }, [], false, true)).toMatch(/ISO 8601/);
    expect(validateConnector(3, { ...v, key_mode: KEYS_REF, ak_id: 'nope' }, [], false, true)).toMatch(/Access key/);
    expect(validateConnector(3, { ...v, ak_value: '' }, [], false, true)).toMatch(/Enter the access key/);
    expect(validateConnector(3, { ...v, ak_value: 'AK', sk_value: 'SK' }, [], false, true)).toBe('');
    expect(validateConnector(3, connectorValues(s3), [], true, false)).toBe('');
  });

  it('offers other source types only as session-only', () => {
    expect(SOURCE_TYPE_OPTS[0]).toBe('S3 · stored in KAP');
    expect(typeOfChoice(SOURCE_TYPE_OPTS[0])).toBeNull();
    expect(typeOfChoice(SOURCE_TYPE_OPTS[1])).toBe('Microsoft SQL Server');
    expect(connectorWizard({ conn: s3, mode: 'edit', existing: [], finish: async () => '' }).initial).toMatchObject({ name: 'sbx_docs', keys: 'Keep the stored keys' });
  });
});

describe('pipeline bodies', () => {
  it('builds document and indicator create bodies', () => {
    const v = { ...pipelineValues(null), name: 'contracts', exts: ['pdf'], tasks: ['summary'], chat: 'chat_default', embed: 'embed_default', chunk: '600', overlap: '60' };
    expect(toKapPipelineCreate(v)).toEqual({
      name: 'contracts',
      kind: 'document',
      stages: [
        { name: 'parse', type: 'parser', routes: [{ match: { extensions: ['pdf'] }, parser: { provider: 'pdf', output: 'markdown' } }] },
        { name: 'transform', type: 'transformer', config: { model_ref: 'chat_default', tasks: [{ name: 'summary', enabled: true }] } },
        { name: 'embed', type: 'embedding', config: { model_ref: 'embed_default', chunking: { chunk_size: 600, overlap: 60 } } },
      ],
    });
    const i = toKapPipelineCreate({ ...pipelineValues(null), name: 'ind', kind: 'indicators', mode: 'snapshot', embed: 'embed_default' });
    expect(i).toEqual({ name: 'ind', kind: 'indicators', mode: 'snapshot', embedding_model_ref: 'embed_default', stages: [{ name: 'load_csv', type: 'csv_loader', config: { files: { 'registry*.csv': 'registry', 'observations*.csv': 'observations' } } }] });
  });

  it('does not patch (and reprocess) an unchanged pipeline', () => {
    expect(pipelineValues(docPipe)).toMatchObject({ exts: ['pdf', 'doc', 'docx'], tasks: ['summary', 'metadata'], chat: 'chat_default', embed: 'embed_default', chunk: '800', overlap: '120' });
    expect(toKapPipelinePatch(docPipe, pipelineValues(docPipe))).toBeNull();
    expect(toKapPipelinePatch(indPipe, pipelineValues(indPipe))).toBeNull();
  });

  it('keeps stored routes and parser settings when stages change', () => {
    const p = toKapPipelinePatch(docPipe, { ...pipelineValues(docPipe), exts: ['pdf', 'docx'], chunk: '1000' }) as { stages: KapPipeline['stages'] };
    expect(p.stages[0]).toEqual({ name: 'parse', type: 'parser', routes: [{ match: { extensions: ['pdf'] }, parser: { provider: 'pdf', output: 'markdown', config: { preserve_tables: true } } }, { match: { extensions: ['docx'] }, parser: { provider: 'docx', output: 'markdown' } }] });
    expect(p.stages[2]).toEqual({ name: 'embed', type: 'embedding', config: { model_ref: 'embed_default', chunking: { chunk_size: 1000, overlap: 120 } } });
    expect(toKapPipelinePatch(indPipe, { ...pipelineValues(indPipe), mode: 'snapshot' })).toEqual({ mode: 'snapshot' });
  });

  it('restores and runs', () => {
    expect(toKapPipelineRestore(indPipe)).toEqual({ name: 'indicator_pipeline', kind: 'indicators', mode: 'delta', semantic: { measure_texts: {} }, embedding_model_ref: 'embed_default', stages: indPipe.stages });
    expect(toKapRun(coll.id)).toEqual({ collection_id: coll.id });
    expect(toKapRun(coll.id, s3.id)).toEqual({ collection_id: coll.id, connector_id: s3.id });
    expect(runId(coll.id)).toBe('55555555');
  });

  it('validates the wizard steps', () => {
    const v = { ...pipelineValues(null), name: 'contracts', embed: 'embed_default' };
    expect(validatePipeline(0, { ...v, name: 'x' }, [], false)).toMatch(/4–64/);
    expect(validatePipeline(1, { ...v, embed: '' }, [], false)).toMatch(/embedding model/);
    expect(validatePipeline(1, { ...v, exts: [], imgs: [] }, [], false)).toMatch(/file type/);
    expect(validatePipeline(1, { ...v, imgs: ['png'], vision: 'None' }, [], false)).toMatch(/vision/);
    expect(validatePipeline(1, { ...v, tasks: ['summary'], chat: 'None' }, [], false)).toMatch(/chat model/);
    expect(validatePipeline(1, { ...v, chunk: '10' }, [], false)).toMatch(/Chunk size/);
    expect(validatePipeline(1, v, [], false)).toBe('');
  });
});

describe('builders on live records', () => {
  const K: KapIngest = {
    conns: [s3, fsConn],
    pipes: [docPipe, indPipe],
    colls: [coll],
    jobs: [job({ id: 'bbbbbbbb-0000-0000-0000-000000000002', state: 'running', finished_at: null, progress: { total: 10, completed: 4, percent: 40 } }), job({ result: { succeeded: 11, failed: 1, cancelled: 0 }, error: null })],
    models: [],
    checks: {},
  };
  const H = toIngestTenant(K, undefined, NOW);
  const noop = () => {};
  const ctx = (): IngestCtx => ({
    H,
    canData: true,
    canRun: true,
    canConfigure: true,
    live: true,
    go: { sources: noop, pipes: noop, runs: noop, source: vi.fn(), pipe: vi.fn(), run: vi.fn(), dataset: vi.fn(), document: vi.fn(), collection: vi.fn(), security: vi.fn() },
    a: { addSource: vi.fn(), editSource: vi.fn(), testSource: vi.fn(), toggleSource: vi.fn(), addPipe: vi.fn(), editPipe: vi.fn(), togglePipe: vi.fn(), runNow: vi.fn(), retryFailed: vi.fn(), retryRun: vi.fn(), cancelRun: vi.fn() },
  });
  const labels = (acts?: { l: string }[]) => (acts ?? []).map((x) => x.l);

  it('lists sources with the pipelines that use them', () => {
    const m = sourcesScreen(ctx(), {}, noop);
    const rows = m.sections[0].rows!;
    expect(rows.map((r) => String(r.cells[4].v))).toEqual(["1", "0"]);
    const d = sourceScreen(ctx(), 'sbx_docs', 'overview', noop);
    expect(labels(d.sections[0].sacts)).toEqual(['Edit', 'Test connection', 'Deactivate']);
    const f = sourceScreen(ctx(), 'local_fs', 'overview', noop);
    expect(labels(f.sections[0].sacts)).toEqual([]);
    expect(f.sections[0].callout).toMatch(/S3 connectors only/);
  });

  it('pipeline actions say what KAP does', () => {
    const c = ctx();
    expect(labels(pipeScreen(c, 'docs_pipeline', 'overview', noop, null, noop).sections[1].sacts)).toEqual(['Edit pipeline', 'Run now', 'Delete', 'View runs']);
    expect(labels(pipeScreen(c, 'indicator_pipeline', 'overview', noop, null, noop).sections[1].sacts)).toEqual(['Restore', 'View runs']);
    expect(kapOfPipe(H.pipelines[0])!.conns).toEqual(['sbx_docs']);
  });

  it('runs can be cancelled while active and run again when finished', () => {
    const c = ctx();
    const list = runsScreen(c, {}, noop).sections[0].rows!;
    expect(list.map((r) => r.cells[0].v)).toEqual(['bbbbbbbb', 'aaaaaaaa']);
    expect(labels(list[0].acts)).toContain('Cancel');
    expect(labels(runScreen(c, 'bbbbbbbb', 'overview', noop, null, noop).sections[0].sacts)).toEqual(['Cancel run', 'View logs']);
    const done = runScreen(c, 'aaaaaaaa', 'overview', noop, null, noop).sections[0];
    expect(labels(done.sacts)).toEqual(['Run again', 'View logs']);
    expect(done.rows!.map((r) => r.cells[0].v)).toContain('Collection');
  });
});
