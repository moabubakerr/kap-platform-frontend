import { describe, expect, it } from 'vitest';
import type { ExportRun, PgDataset, PgSource } from '@/api/platformPg';
import type { IngestTenant, Run } from '@/v35/data/ingest';
import { ihLoc } from './logic';
import { srcOfRun } from './build';
import { pgDatasetWizard, pgSourceWizard } from './pgWizards';
import {
  checkQueries, countsText, datasetValues, exportOf, exportProgress, exportSteps, isPgRunId, kapPercent, kapResultText, missingColumns, nextRunText, pgOfRun, pgOfSource, pgRunId, pgSourceValues, previewFiles, PRESET_CUSTOM,
  PRESET_SCAI, REQUIRED_COLUMNS, runFileRows, scheduleLabel, scheduleMinutes, scheduleOpts, sqlBody, sqlTemplate, testSummary, toPgDatasetCreate, toPgDatasetPatch, toPgHubSource, toPgRun, toPgSourceCreate, toPgSourcePatch,
  validateDataset, validatePgSource, withPg, type PgState,
} from './pgView';

const NOW = Date.parse('2026-11-25T10:00:00Z');
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

const SRC: PgSource = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  name: 'askai_db',
  host: 'scai-chatbot-postgres-1',
  port: 5432,
  database: 'scai_indicators',
  username: 'kap_platform_ro',
  sslmode: 'disable',
  password_set: true,
  last_test: { ok: true, message: 'Connected', at: ago(120) },
  created_at: ago(3600),
  updated_at: ago(3600),
};

const DS: PgDataset = {
  id: 'd0d0d0d0-0000-0000-0000-000000000002',
  source_id: SRC.id,
  source_name: SRC.name,
  name: 'SCEAI indicators',
  preset: 'scai_indicators',
  queries: null,
  published_only: true,
  collection_name: 'askai_indicators',
  schedule_minutes: 60,
  next_run_at: new Date(NOW + 12 * 60_000).toISOString(),
  kap: null,
  last_run: null,
  created_at: ago(600),
  updated_at: ago(600),
};

const step = (key: string, state: ExportRun['steps'][number]['state'], s?: number, f?: number, detail: string | null = null) => ({ key, title: '', state, detail, started_at: s != null ? ago(s) : null, finished_at: f != null ? ago(f) : null });

const RUN: ExportRun = {
  id: 'e1e2e3e4-5555-6666-7777-888888888888',
  dataset_id: DS.id,
  dataset_name: DS.name,
  trigger: 'manual',
  status: 'waiting_for_kap',
  created_at: ago(60),
  started_at: ago(58),
  finished_at: null,
  steps: [step('read', 'done', 58, 50, '120 indicators read'), step('write', 'done', 50, 48), step('upload', 'done', 48, 45), step('kap_scan', 'running', 45)],
  counts: { registry: 120, observations: 4512, narratives: 1 },
  files: [
    { name: 'registry.csv', key: 'exports/askai_indicators/registry.csv', bytes: 2048 },
    { name: 'observations.csv', key: 'exports/askai_indicators/observations.csv', bytes: 3 * 1048576 },
    { name: 'narratives.csv', key: 'exports/askai_indicators/narratives.csv', bytes: 512 },
  ],
  kap: { collection: 'askai_indicators', pipeline_job_id: null, state: null, progress: null, result: null },
  error: null,
};

describe('schedules and labels', () => {
  it('maps schedules both ways and keeps a schedule set elsewhere', () => {
    expect(scheduleLabel(null)).toBe('Manual only');
    expect(scheduleLabel(15)).toBe('Every 15 minutes');
    expect(scheduleLabel(1440)).toBe('Every day');
    expect(scheduleLabel(120)).toBe('Every 2 hours');
    expect(scheduleLabel(2880)).toBe('Every 2 days');
    expect(scheduleMinutes('Every 6 hours')).toBe(360);
    expect(scheduleMinutes('Manual only')).toBeNull();
    expect(scheduleMinutes('Every 2 hours', 120)).toBe(120);
    expect(scheduleOpts(120)).toContain('Every 2 hours');
    expect(scheduleOpts(60)).toHaveLength(5);
  });

  it('says when the next run is due', () => {
    expect(nextRunText(new Date(NOW + 12 * 60_000).toISOString(), NOW)).toBe('Next run in 12 min');
    expect(nextRunText(ago(10), NOW)).toBe('Next run due now');
    expect(nextRunText(null, NOW)).toBe('');
  });

  it('summarizes a connection test', () => {
    expect(testSummary({ ok: true, message: '', server_version: 'PostgreSQL 16.4', tables: [{ schema: 'public', name: 'indicators', rows_estimate: 120 }] })).toBe('PostgreSQL 16.4 · 1 readable table');
    expect(testSummary({ ok: false, message: 'password authentication failed', server_version: null, tables: [] })).toBe('password authentication failed');
  });
});

describe('export runs', () => {
  it('lists the five steps in order with their states', () => {
    const s = exportSteps(RUN, NOW);
    expect(s.map((x) => x.key)).toEqual(['read', 'write', 'upload', 'kap_scan', 'kap_load']);
    expect(s.map((x) => x.state)).toEqual(['done', 'done', 'done', 'current', 'pending']);
    expect(s[0].detail).toBe('120 indicators read');
    expect(s[0].time).toBe('8 s');
    expect(s[3].time).toContain('45 s so far');
    expect(s[4].title).toBe('KAP load');
  });

  it('counts progress by steps, with KAP’s load progress inside its step', () => {
    expect(exportProgress(RUN, NOW)).toMatchObject({ percent: 60, label: 'KAP scan', indeterminate: false });
    const loading = { ...RUN, steps: [...RUN.steps.slice(0, 3), step('kap_scan', 'done', 45, 40), step('kap_load', 'running', 40)], kap: { ...RUN.kap!, progress: { percent: 50 } } };
    expect(exportProgress(loading, NOW).percent).toBe(90);
    expect(exportSteps(loading, NOW)[4].detail).toContain('50%');
    expect(exportProgress({ ...RUN, status: 'queued', steps: [] }, NOW)).toMatchObject({ percent: 0, indeterminate: true, label: 'Waiting for the platform' });
    expect(exportProgress({ ...RUN, status: 'succeeded' }, NOW)).toMatchObject({ percent: 100, label: 'Succeeded' });
  });

  it('reads KAP progress and results in their usual shapes', () => {
    expect(kapPercent(42)).toBe(42);
    expect(kapPercent(0.5)).toBe(50);
    expect(kapPercent({ completed: 1, total: 4 })).toBe(25);
    expect(kapPercent(null)).toBeNull();
    expect(kapResultText({ succeeded: 3, failed: 0, cancelled: 0 })).toBe('3 succeeded · 0 failed · 0 cancelled');
    expect(kapResultText(null)).toBe('');
  });

  it('maps a run onto the hub run list', () => {
    const r = toPgRun(RUN, NOW, 'askai_db', 'askai_indicators');
    expect(r.id).toBe('pg-e1e2e3e4');
    expect(isPgRunId(r.id)).toBe(true);
    expect(r.pipe).toBe('Postgres export · SCEAI indicators');
    expect(r.st).toBe('Running');
    expect(r.trig).toBe('Manual · run now');
    expect(r.inN).toBe('120 indicators · 4,512 observations · 1 narrative');
    expect(r.outN).toBe('3 files · 3.0 MB');
    expect(pgOfRun(r)).toMatchObject({ source: 'askai_db', collection: 'askai_indicators', status: 'waiting_for_kap', percent: 60 });
    const failed = toPgRun({ ...RUN, status: 'failed', finished_at: ago(30), error: 'relation "indicators" does not exist' }, NOW, '', '');
    expect(failed.st).toBe('Failed');
    expect(failed.errN).toBe(1);
    expect(failed.logs[failed.logs.length - 1]).toEqual([expect.any(String), 'ERROR', 'relation "indicators" does not exist']);
    expect(countsText(null)).toBe('—');
  });

  it('lists the files with their row counts', () => {
    expect(runFileRows(RUN)).toEqual([
      { name: 'registry.csv', rows: 120, bytes: 2048, key: 'exports/askai_indicators/registry.csv' },
      { name: 'observations.csv', rows: 4512, bytes: 3145728, key: 'exports/askai_indicators/observations.csv' },
      { name: 'narratives.csv', rows: 1, bytes: 512, key: 'exports/askai_indicators/narratives.csv' },
    ]);
    expect(runFileRows({ files: [], counts: null })).toEqual([]);
  });
});

describe('hub slice', () => {
  const kapRun = (id: string, created: string) => ({ id, pipe: 'p', trig: '', start: '', dur: '', st: 'Succeeded', inN: '', outN: '', errN: 0, stages: [], items: [], logs: [], outDs: [], outDocs: [], batch: null, kap: { createdAt: created } }) as unknown as Run;
  const H: IngestTenant = {
    sources: [{ id: 'sbx_docs', type: 'S3', desc: '', cfg: {}, auth: '', cred: '', st: 'Connected', chk: '', impl: 'Implemented', browse: [], act: [] }],
    pipelines: [],
    runs: [kapRun('aaaaaaaa', ago(10)), kapRun('bbbbbbbb', ago(300)), { ...kapRun('sess-1', ''), kap: undefined } as unknown as Run],
    pub: { colls: [], datasets: [], documents: [] },
    onto: [],
    creds: [],
  };
  const P: PgState = { missing: false, sources: [SRC], datasets: [DS], exports: [RUN], exportsTotal: 1 };

  it('adds PostgreSQL sources and merges export runs newest first', () => {
    const X = withPg(H, P, NOW);
    expect(X.sources.map((s) => s.id)).toEqual(['sbx_docs', 'askai_db']);
    const s = X.sources[1];
    expect(s.type).toBe('PostgreSQL');
    expect(s.st).toBe('Connected');
    expect(pgOfSource(s)).toEqual({ id: SRC.id, datasets: 1 });
    expect(ihLoc(s)).toBe('scai-chatbot-postgres-1:5432 / scai_indicators');
    expect(X.runs.map((r) => r.id)).toEqual(['aaaaaaaa', 'pg-e1e2e3e4', 'bbbbbbbb', 'sess-1']);
    expect(srcOfRun(X, X.runs[1])).toBe('askai_db');
    expect(exportOf(P, 'pg-e1e2e3e4')?.id).toBe(RUN.id);
  });

  it('leaves the slice alone when the platform has no PostgreSQL feature', () => {
    expect(withPg(H, { ...P, missing: true }, NOW)).toBe(H);
    expect(withPg(H, undefined, NOW)).toBe(H);
  });

  it('shows a failed test and an untested source', () => {
    expect(toPgHubSource({ ...SRC, last_test: { ok: false, message: 'timeout', at: ago(5) } }, 0, NOW)).toMatchObject({ st: 'Failed', err: 'timeout' });
    expect(toPgHubSource({ ...SRC, last_test: null }, 0, NOW)).toMatchObject({ st: 'Not tested', chk: 'Not checked' });
  });
});

describe('source form', () => {
  const v = { ...pgSourceValues(null), name: 'askai_db', host: 'scai-chatbot-postgres-1', database: 'scai_indicators', username: 'kap_platform_ro', password: 'secret' };

  it('validates the connection and credentials', () => {
    expect(validatePgSource(v, [], false)).toBe('');
    expect(validatePgSource({ ...v, name: 'a b' }, [], false)).toMatch(/^Name/);
    expect(validatePgSource(v, ['ASKAI_DB'], false)).toMatch(/already exists/);
    expect(validatePgSource({ ...v, port: '70000' }, [], false)).toMatch(/^Port/);
    expect(validatePgSource({ ...v, password: '' }, [], false)).toBe('Enter the password.');
    expect(validatePgSource({ ...pgSourceValues(SRC) }, ['askai_db'], true)).toBe('');
    expect(validatePgSource({ ...v, password: '' }, [], false, 'connection')).toBe('');
  });

  it('builds the create body and a patch of changed fields (password only when typed)', () => {
    expect(toPgSourceCreate(v)).toEqual({ name: 'askai_db', host: 'scai-chatbot-postgres-1', port: 5432, database: 'scai_indicators', username: 'kap_platform_ro', password: 'secret', sslmode: 'disable' });
    expect(toPgSourcePatch(SRC, pgSourceValues(SRC))).toBeNull();
    expect(toPgSourcePatch(SRC, { ...pgSourceValues(SRC), port: '5433', password: 'new' })).toEqual({ port: 5433, password: 'new' });
  });

  it('opens the wizard at the connection step with the defaults', () => {
    const w = pgSourceWizard({ src: null, existing: [], finish: async () => '' });
    expect(w.initialStep).toBe(1);
    expect(w.initial).toMatchObject({ port: '5432', sslmode: 'disable' });
    const f = w.fields(2, { ...w.initial }, () => {});
    expect(f.find((x) => 'k' in x && x.k === 'password')).toMatchObject({ secret: true });
    const e = pgSourceWizard({ src: SRC, existing: [], finish: async () => '' }).fields(2, pgSourceValues(SRC), () => {});
    expect(e.find((x) => 'k' in x && x.k === 'password')).toMatchObject({ hint: 'Leave empty to keep the stored password.' });
  });
});

describe('custom SQL', () => {
  it('writes a commented template that lists every required column', () => {
    const t = sqlTemplate('observations');
    expect(sqlBody(t)).toBe('');
    for (const c of REQUIRED_COLUMNS.observations) expect(t).toContain(`NULL AS ${c}`);
    expect(sqlTemplate('narratives')).toContain('Optional');
  });

  it('hints at missing columns from the SQL text', () => {
    expect(missingColumns(sqlTemplate('registry'), 'registry')).toBeNull();
    expect(missingColumns('SELECT * FROM x', 'registry')).toBeNull();
    const sql = `SELECT ${REQUIRED_COLUMNS.narratives.filter((c) => c !== 'benchmark').join(', ')} FROM t -- benchmark later`;
    expect(missingColumns(sql, 'narratives')).toEqual(['benchmark']);
  });

  it('blocks empty required queries and warns about the rest', () => {
    const full = (f: 'registry' | 'observations') => `SELECT ${REQUIRED_COLUMNS[f].join(', ')} FROM t`;
    expect(checkQueries({ registry: sqlTemplate('registry'), observations: full('observations') }).errors).toEqual(['Write the registry query (registry.csv).']);
    const r = checkQueries({ registry: full('registry'), observations: 'SELECT indicator_id FROM v; DROP TABLE v', narratives: sqlTemplate('narratives') });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/one statement only/);
    expect(r.warnings.join(' ')).toMatch(/observations.csv: 11 required columns/);
  });
});

describe('dataset form', () => {
  const ctx = { names: ['Other'], collections: ['sbx_docs_coll', 'askai_indicators'], edit: false };

  it('validates name, queries and a new collection', () => {
    const v = { ...datasetValues(null), name: 'Indicators', collection: 'askai_ind2' };
    expect([0, 1, 2].map((s) => validateDataset(s, v, ctx))).toEqual(['', '', '']);
    expect(validateDataset(0, { ...v, name: 'other' }, ctx)).toMatch(/already exists/);
    expect(validateDataset(1, { ...v, preset: PRESET_CUSTOM }, ctx)).toMatch(/registry query/);
    expect(validateDataset(2, { ...v, collection: 'askai_indicators' }, ctx)).toMatch(/already exists/);
    expect(validateDataset(2, { ...v, collection: 'a-b' }, ctx)).toMatch(/^Collection name/);
    expect(validateDataset(2, { ...v, collection: 'x'.repeat(30) }, ctx)).toMatch(/^Collection name/);
  });

  it('builds the preset and custom bodies', () => {
    const v = { ...datasetValues(null), name: 'Indicators', collection: 'askai_ind2', schedule: 'Every hour' };
    expect(toPgDatasetCreate(v, SRC.id)).toEqual({ source_id: SRC.id, name: 'Indicators', preset: 'scai_indicators', published_only: true, collection_name: 'askai_ind2', schedule_minutes: 60 });
    const c = toPgDatasetCreate({ ...v, preset: PRESET_CUSTOM, registry: 'SELECT 1', observations: 'SELECT 2' }, SRC.id);
    expect(c.queries).toEqual({ registry: 'SELECT 1', observations: 'SELECT 2' });
    expect(c.published_only).toBeUndefined();
  });

  it('patches only what changed and never the collection', () => {
    expect(toPgDatasetPatch(DS, datasetValues(DS))).toBeNull();
    expect(toPgDatasetPatch(DS, { ...datasetValues(DS), published: 'No', schedule: 'Manual only', collection: 'other' })).toEqual({ published_only: false, schedule_minutes: null });
    expect(toPgDatasetPatch(DS, { ...datasetValues(DS), preset: PRESET_CUSTOM, registry: 'SELECT 1', observations: 'SELECT 2', narratives: '-- none' })).toEqual({ preset: 'custom', queries: { registry: 'SELECT 1', observations: 'SELECT 2' } });
  });

  it('shows the KAP objects a new collection gets', () => {
    const w = pgDatasetWizard({ ds: null, source: SRC, check: ctx, finish: async () => '' });
    expect(w.initial).toMatchObject({ preset: PRESET_SCAI, published: 'Yes', schedule: 'Manual only' });
    const notes = w.fields(2, { ...w.initial, collection: 'askai_ind2' }, () => {}).filter((f) => f.type === 'note');
    expect(JSON.stringify(notes)).toContain('askai_ind2_pg');
    expect(JSON.stringify(notes)).toContain('askai_ind2_pipeline');
    expect(JSON.stringify(notes)).toContain('find_indicator');
    const custom = w.fields(1, { ...w.initial, preset: PRESET_CUSTOM }, () => {});
    expect(custom.filter((f) => f.type === 'textarea')).toHaveLength(3);
  });

  it('previews the first rows of each file in order', () => {
    const p = previewFiles({ files: { observations: { columns: ['indicator_id'], rows: [[1], [2], [3]], count: 300 }, registry: { columns: ['indicator_id'], rows: [[1]], count: 1 } }, problems: [] }, 2);
    expect(p.map((f) => [f.name, f.rows.length, f.more])).toEqual([
      ['registry.csv', 1, 0],
      ['observations.csv', 2, 298],
    ]);
    expect(pgRunId('12345678-aaaa')).toBe('pg-12345678');
  });
});
