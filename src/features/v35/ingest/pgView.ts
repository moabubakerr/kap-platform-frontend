/**
 * PostgreSQL data sources (live tenant, through the platform API): pure mapping
 * and validation. Platform records → the hub's `Source` and `Run` shapes (so the
 * Data Sources and Ingestion Runs lists show them next to KAP's), export-run
 * steps for the live step view, labels, schedules, the custom SQL templates and
 * the client-side column hints for custom queries.
 */
import type { FormValues } from '@/engine/dialogs';
import type { IngestTenant, Run, RunStatus, Source, SourceStatus } from '@/v35/data/ingest';
import type { ExportRun, ExportStatus, ExportStepState, PgDataset, PgDatasetCreate, PgDatasetPatch, PgDatasetPreview, PgFile, PgPreset, PgSource, PgSourceCreate, PgSourcePatch, PgTestResult } from '@/api/platformPg';
import { kapOfRun, rel, span } from './fromKap';
import { hhmmss, type RunStep, type StepState } from './runView';
import { mappingKey, mappingValues, toMapping } from './pgMapping';
import { isRecordsRun, KAP_LOAD_NOTE, recordCountsText, recordsKey, recordsValues, toRecords } from './pgRecords';

// ------------------------------------------------------------------ state
/** The platform's PostgreSQL records of a live tenant. `missing`: the platform API has no such routes yet. */
export interface PgState {
  missing: boolean;
  sources: PgSource[];
  datasets: PgDataset[];
  /** newest first */
  exports: ExportRun[];
  exportsTotal: number;
}

export const PG_TYPE = 'PostgreSQL';

export interface PgSourceRef {
  id: string;
  datasets: number;
}
export interface PgRunRef {
  id: string;
  datasetId: string;
  dataset: string;
  source: string;
  collection: string;
  status: ExportStatus;
  createdAt: string;
  percent: number;
  /** current step title or the final status */
  label: string;
}
export type PgHubSource = Source & { pg?: PgSourceRef };
export type PgHubRun = Run & { pg?: PgRunRef };

export const pgOfSource = (s: Source | null | undefined) => (s as PgHubSource | null | undefined)?.pg;
export const pgOfRun = (r: Run | null | undefined) => (r as PgHubRun | null | undefined)?.pg;

// ------------------------------------------------------------------ labels
export const SSL_MODES = ['disable', 'prefer', 'require', 'verify-full'];
export const SSL_HINT: Record<string, string> = {
  disable: 'No encryption (a database on the same internal network, as on the test stand).',
  prefer: 'Encrypt when the server supports it.',
  require: 'Always encrypt; the server certificate is not verified.',
  'verify-full': 'Always encrypt and verify the certificate and host name.',
};

/** Options of the wizard's Mapping choice (form values hold these labels). */
export const PRESET_SCAI = 'SCEAI indicators (built-in)';
export const PRESET_MAPPED = 'Map columns (no SQL)';
export const PRESET_CUSTOM = 'Custom SQL';
export const PRESET_RECORDS = 'Records → searchable documents';
export const PRESET_OPTS = [PRESET_SCAI, PRESET_MAPPED, PRESET_CUSTOM, PRESET_RECORDS];
export const presetLabel = (p: PgPreset | string) => (p === 'scai_indicators' ? PRESET_SCAI : p === 'mapped' ? PRESET_MAPPED : p === 'records' ? PRESET_RECORDS : PRESET_CUSTOM);
export const presetOf = (label: string): PgPreset => (label === PRESET_CUSTOM ? 'custom' : label === PRESET_MAPPED ? 'mapped' : label === PRESET_RECORDS ? 'records' : 'scai_indicators');
/** Short name of a preset for lists and the audit trail. */
export const presetName = (p: PgPreset | string) => (p === 'scai_indicators' ? 'SCEAI indicators' : p === 'mapped' ? 'Column mapping' : p === 'records' ? 'Records as documents' : 'Custom SQL');
export const RECORDS_HINT = 'Each row becomes a document agents can search — for tickets, contracts, products…';
export const SCAI_HINT = 'Built-in mapping for the Ask AI database (scai_indicators: indicators, indicator_details, indicator_values, indicator_analysis).';
export const MAPPED_HINT = 'Recommended for other databases: choose a table and say which column is the series, the period and the value. The platform writes the SQL.';

export const SCHEDULES: [string, number | null][] = [
  ['Manual only', null],
  ['Every 15 minutes', 15],
  ['Every hour', 60],
  ['Every 6 hours', 360],
  ['Every day', 1440],
];

export function scheduleLabel(min: number | null | undefined): string {
  if (!min) return 'Manual only';
  const f = SCHEDULES.find(([, m]) => m === min);
  if (f) return f[0];
  if (min % 1440 === 0) return `Every ${min / 1440} days`;
  if (min % 60 === 0) return `Every ${min / 60} hours`;
  return `Every ${min} minutes`;
}
/** Minutes of a schedule label; `cur` keeps a schedule set elsewhere that is not one of `SCHEDULES`. */
export function scheduleMinutes(label: string, cur?: number | null): number | null {
  const f = SCHEDULES.find(([l]) => l === label);
  if (f) return f[1];
  return cur && label === scheduleLabel(cur) ? cur : null;
}
/** "Next run in 12 min", "Next run due now", '' when not known. */
export function nextRunText(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.round((t - now) / 1000);
  if (s <= 30) return 'Next run due now';
  if (s < 3600) return `Next run in ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `Next run in ${Math.round(s / 3600)} h`;
  return `Next run in ${Math.round(s / 86400)} d`;
}
export const scheduleOpts = (cur?: number | null) => [...new Set([...SCHEDULES.map(([l]) => l), scheduleLabel(cur)])];

export const EXPORT_STATUS_LABEL: Record<ExportStatus, string> = { queued: 'Queued', running: 'Running', waiting_for_kap: 'Waiting for KAP', succeeded: 'Succeeded', failed: 'Failed' };
const EXPORT_RUN_STATUS: Record<ExportStatus, RunStatus> = { queued: 'Queued', running: 'Running', waiting_for_kap: 'Running', succeeded: 'Succeeded', failed: 'Failed' };
export const exportStatus = (s: ExportStatus | string): RunStatus => EXPORT_RUN_STATUS[s as ExportStatus] ?? 'Queued';
export const ACTIVE_EXPORT: ExportStatus[] = ['queued', 'running', 'waiting_for_kap'];
export const isActiveExport = (r: Pick<ExportRun, 'status'>) => ACTIVE_EXPORT.includes(r.status);

export const PG_RUN_PREFIX = 'pg-';
/** Hub id of an export run: `pg-` + the first 8 characters of its UUID. */
export const pgRunId = (id: string) => `${PG_RUN_PREFIX}${id.slice(0, 8)}`;
export const isPgRunId = (id: string) => id.startsWith(PG_RUN_PREFIX);
export const exportOf = (P: PgState | undefined, hubId: string) => P?.exports.find((x) => pgRunId(x.id) === hubId) ?? null;

export const runLabel = (datasetName: string) => `Postgres export · ${datasetName}`;
export const triggerLabel = (t: ExportRun['trigger']) => (t === 'schedule' ? 'Schedule · platform' : 'Manual · run now');

export function fmtBytes(b: number | null | undefined): string {
  if (b == null || Number.isNaN(Number(b))) return '—';
  const n = Number(b);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
export const fmtCount = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'));
export const fmtRowsEstimate = (n: number | null | undefined) => (n == null || n < 0 ? '—' : `~${n.toLocaleString('en-US')}`);

/** "Connected · PostgreSQL 16.4 · 4 readable tables" */
export function testSummary(r: PgTestResult): string {
  if (!r.ok) return r.message || 'The connection test failed.';
  const n = r.tables.length;
  return [r.server_version ? `PostgreSQL ${r.server_version.replace(/^PostgreSQL\s+/i, '')}` : '', `${n} readable ${n === 1 ? 'table' : 'tables'}`].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------------ sources → hub
export function toPgHubSource(s: PgSource, datasets: number, now: number): PgHubSource {
  const t = s.last_test;
  const st: SourceStatus = t ? (t.ok ? 'Connected' : 'Failed') : 'Not tested';
  const act: [string, string, string][] = [];
  if (t) act.push([rel(t.at, now), '—', `Connection test ${t.ok ? 'succeeded' : `failed: ${t.message}`}`]);
  if (s.updated_at && s.updated_at !== s.created_at) act.push([rel(s.updated_at, now), '—', 'Connection settings changed']);
  act.push([rel(s.created_at, now), '—', 'Created in the platform']);
  return {
    id: s.name,
    type: PG_TYPE,
    desc: `Read by the platform (read-only) and exported to KAP as indicator files · ${datasets} ${datasets === 1 ? 'dataset' : 'datasets'}`,
    cfg: { server: s.host, port: String(s.port), db: s.database, user: s.username, tls: s.sslmode },
    auth: 'Username and password',
    cred: s.password_set ? 'Password stored by the platform (never shown)' : 'No password stored',
    st,
    chk: t ? rel(t.at, now) : 'Not checked',
    err: t && !t.ok ? t.message : '',
    impl: 'Implemented',
    browse: [],
    act,
    pg: { id: s.id, datasets },
  };
}

// ------------------------------------------------------------------ export runs
export const STEP_ORDER = ['read', 'write', 'upload', 'kap_scan', 'kap_load'];
export const STEP_TITLE: Record<string, string> = {
  read: 'Read from PostgreSQL',
  write: 'Write the indicator files',
  upload: 'Upload to S3',
  kap_scan: 'KAP scan',
  kap_load: 'KAP load',
};
const STEP_WHAT: Record<string, string> = {
  read: 'The platform runs the queries on the source database with a read-only user.',
  write: 'registry.csv, observations.csv and narratives.csv in the columns KAP expects.',
  upload: 'The files go to the bucket that the dataset’s KAP connector scans.',
  kap_scan: 'KAP’s connector finds the new files and starts a pipeline run.',
  kap_load: 'KAP’s pipeline loads the indicators into the collection.',
};
/** Records datasets: the same five steps, about documents. */
const STEP_TITLE_REC: Record<string, string> = { ...STEP_TITLE, write: 'Write the record documents' };
const STEP_WHAT_REC: Record<string, string> = {
  read: 'The platform reads the table with a read-only user.',
  write: 'One Word document per record (title, fields and sections), each in its own folder.',
  upload: 'New and changed documents go to the bucket that the dataset’s KAP connector scans; removed records are deleted.',
  kap_scan: 'KAP’s connector finds the new, changed and removed documents and starts a pipeline run.',
  kap_load: KAP_LOAD_NOTE,
};
const STEP_STATE: Record<ExportStepState, StepState> = { pending: 'pending', running: 'current', done: 'done', failed: 'failed', skipped: 'skipped' };

/** KAP's progress as a percentage: a number (0–100) or `{percent}` / `{completed, total}`. */
export function kapPercent(p: unknown): number | null {
  if (typeof p === 'number' && Number.isFinite(p)) return Math.max(0, Math.min(100, p <= 1 && p > 0 && !Number.isInteger(p) ? Math.round(p * 100) : Math.round(p)));
  if (p && typeof p === 'object') {
    const o = p as { percent?: unknown; completed?: unknown; total?: unknown };
    if (typeof o.percent === 'number') return Math.round(o.percent);
    if (typeof o.completed === 'number' && typeof o.total === 'number' && o.total > 0) return Math.round((o.completed / o.total) * 100);
  }
  return null;
}

/** KAP's result in words: `{succeeded, failed, cancelled}` counts, or the value as text. */
export function kapResultText(r: unknown): string {
  if (r == null || r === '') return '';
  if (typeof r === 'object' && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    if ('succeeded' in o || 'failed' in o) return ['succeeded', 'failed', 'cancelled'].filter((k) => typeof o[k] === 'number').map((k) => `${o[k]} ${k}`).join(' · ');
    return JSON.stringify(r);
  }
  return String(r);
}

/** The run's steps in order (read → write → upload → kap_scan → kap_load), for the step view. `records`: a records dataset (documents). */
export function exportSteps(r: Pick<ExportRun, 'steps' | 'status' | 'kap'>, now: number, records = false): RunStep[] {
  const TITLE = records ? STEP_TITLE_REC : STEP_TITLE;
  const WHAT = records ? STEP_WHAT_REC : STEP_WHAT;
  const by = new Map(r.steps.map((s) => [s.key, s]));
  const keys = [...STEP_ORDER, ...r.steps.map((s) => s.key).filter((k) => !STEP_ORDER.includes(k))];
  return keys.map((k) => {
    const s = by.get(k);
    const state: StepState = s ? STEP_STATE[s.state] ?? 'pending' : 'pending';
    const t0 = s?.started_at ? Date.parse(s.started_at) : NaN;
    const t1 = s?.finished_at ? Date.parse(s.finished_at) : NaN;
    const time = !Number.isNaN(t0) && !Number.isNaN(t1) ? span(t1 - t0) : !Number.isNaN(t0) && state === 'current' ? `${hhmmss(s!.started_at)} · ${span(now - t0)} so far` : '';
    let detail = s?.detail || WHAT[k] || '';
    if (k === 'kap_load' && state === 'current') {
      if (records && s?.detail && !/summar/i.test(s.detail)) detail = `${detail} · ${KAP_LOAD_NOTE}`;
      const p = kapPercent(r.kap?.progress);
      if (p != null) detail = `${detail} · ${p}%`;
    }
    if (state === 'skipped' && !s?.detail) detail = 'Skipped.';
    return { key: k, title: s?.title || TITLE[k] || k, state, time, detail };
  });
}

/** Overall progress of an export run: the share of finished steps (KAP's load progress counts within its step). */
export function exportProgress(r: Pick<ExportRun, 'steps' | 'status' | 'kap'>, now: number, records = false): { percent: number; label: string; indeterminate: boolean } {
  const steps = exportSteps(r, now, records);
  const n = steps.length || 1;
  if (!isActiveExport(r)) return { percent: r.status === 'succeeded' ? 100 : Math.round((steps.filter((s) => s.state === 'done' || s.state === 'skipped').length / n) * 100), label: EXPORT_STATUS_LABEL[r.status] ?? r.status, indeterminate: false };
  const done = steps.filter((s) => s.state === 'done' || s.state === 'skipped').length;
  const cur = steps.find((s) => s.state === 'current');
  const within = cur?.key === 'kap_load' ? (kapPercent(r.kap?.progress) ?? 0) / 100 : 0;
  const percent = Math.round(((done + within) / n) * 100);
  const label = cur ? cur.title : r.status === 'queued' ? 'Waiting for the platform' : r.status === 'waiting_for_kap' ? 'Waiting for KAP' : 'Starting';
  return { percent, label, indeterminate: r.status === 'queued' && done === 0 && !cur };
}

/** Counts per file in words: "120 indicators · 4,512 observations · 98 narratives". */
export function countsText(c: ExportRun['counts']): string {
  if (!c) return '—';
  if (c.documents != null) return recordCountsText(c);
  const parts: string[] = [];
  if (c.registry != null) parts.push(`${fmtCount(c.registry)} ${c.registry === 1 ? 'indicator' : 'indicators'}`);
  if (c.observations != null) parts.push(`${fmtCount(c.observations)} ${c.observations === 1 ? 'observation' : 'observations'}`);
  if (c.narratives != null) parts.push(`${fmtCount(c.narratives)} ${c.narratives === 1 ? 'narrative' : 'narratives'}`);
  return parts.join(' · ') || '—';
}

/** The files of a run with their row counts: the three indicator files first, then any other file. */
export function runFileRows(x: Pick<ExportRun, 'files' | 'counts'>) {
  const used = new Set<number>();
  const rows = PG_FILES.map((f) => {
    const i = x.files.findIndex((y, j) => !used.has(j) && (y.name === FILE_NAME[f] || y.name.startsWith(f) || y.key.endsWith(`/${FILE_NAME[f]}`)));
    if (i >= 0) used.add(i);
    const file = i >= 0 ? x.files[i] : null;
    return { name: file?.name ?? FILE_NAME[f], rows: x.counts?.[f] ?? null, bytes: file?.bytes ?? null, key: file?.key ?? '' };
  });
  const extra = x.files.filter((_, j) => !used.has(j)).map((y) => ({ name: y.name, rows: null as number | null, bytes: y.bytes, key: y.key }));
  return [...rows, ...extra].filter((r) => r.key || r.rows != null);
}

export function toPgRun(x: ExportRun, now: number, source: string, collection: string): PgHubRun {
  const st = exportStatus(x.status);
  const active = isActiveExport(x);
  const t0 = x.started_at ? Date.parse(x.started_at) : NaN;
  const dur = x.finished_at && !Number.isNaN(t0) ? span(Date.parse(x.finished_at) - t0) : active && !Number.isNaN(t0) ? `${span(now - t0)} (running)` : active ? 'not started' : '—';
  const pr = exportProgress(x, now, isRecordsRun(x));
  const logs: [string, string, string][] = [[hhmmss(x.created_at), 'INFO', `Export registered · ${triggerLabel(x.trigger)}`]];
  for (const s of x.steps) {
    if (s.started_at) logs.push([hhmmss(s.started_at), 'INFO', `${s.title || STEP_TITLE[s.key] || s.key} started`]);
    if (s.finished_at) logs.push([hhmmss(s.finished_at), s.state === 'failed' ? 'ERROR' : 'INFO', `${s.title || STEP_TITLE[s.key] || s.key} ${s.state === 'failed' ? 'failed' : s.state === 'skipped' ? 'skipped' : 'done'}${s.detail ? ` · ${s.detail}` : ''}`]);
  }
  if (x.error) logs.push([hhmmss(x.finished_at), 'ERROR', x.error]);
  return {
    id: pgRunId(x.id),
    pipe: runLabel(x.dataset_name),
    trig: triggerLabel(x.trigger),
    start: rel(x.created_at, now),
    dur,
    st,
    inN: countsText(x.counts),
    outN: x.files.length ? `${x.files.length} ${x.files.length === 1 ? 'file' : 'files'} · ${fmtBytes(x.files.reduce((a, f) => a + (f.bytes ?? 0), 0))}` : '—',
    errN: x.status === 'failed' ? 1 : 0,
    stages: [],
    items: [],
    logs,
    outDs: [],
    outDocs: [],
    batch: null,
    pg: { id: x.id, datasetId: x.dataset_id, dataset: x.dataset_name, source, collection, status: x.status, createdAt: x.created_at, percent: pr.percent, label: pr.label },
  };
}

const createdOf = (r: Run) => {
  const s = kapOfRun(r)?.createdAt ?? pgOfRun(r)?.createdAt;
  return s ? Date.parse(s) : NaN;
};

/**
 * The hub slice with the platform's PostgreSQL sources and export runs added:
 * sources after KAP's, runs merged with KAP's runs newest first (session-only
 * runs, which have no time, stay at the end).
 */
export function withPg(H: IngestTenant, P: PgState | undefined, now: number): IngestTenant {
  if (!P || P.missing) return H;
  const names = new Map(P.sources.map((s) => [s.id, s.name]));
  const taken = new Set(H.sources.map((s) => s.id));
  const sources = P.sources.filter((s) => !taken.has(s.name)).map((s) => toPgHubSource(s, P.datasets.filter((d) => d.source_id === s.id).length, now));
  const ds = new Map(P.datasets.map((d) => [d.id, d]));
  const runs = P.exports.map((x) => {
    const d = ds.get(x.dataset_id);
    return toPgRun(x, now, d ? names.get(d.source_id) ?? d.source_name : '', d?.collection_name ?? x.kap?.collection ?? '');
  });
  const timed = [...H.runs.filter((r) => !!kapOfRun(r)), ...runs].sort((a, b) => (createdOf(b) || 0) - (createdOf(a) || 0));
  return { ...H, sources: [...H.sources, ...sources], runs: [...timed, ...H.runs.filter((r) => !kapOfRun(r))] };
}

// ------------------------------------------------------------------ source form
export const PG_NAME_RX = /^[A-Za-z0-9_-]{3,64}$/;

export function pgSourceValues(s: PgSource | null): FormValues {
  return s
    ? { name: s.name, host: s.host, port: String(s.port), database: s.database, username: s.username, password: '', sslmode: s.sslmode }
    : { name: '', host: '', port: '5432', database: '', username: '', password: '', sslmode: 'disable' };
}

/** '' or the first problem with the source form. `existing`: names of the tenant's data sources (all kinds). */
export function validatePgSource(v: FormValues, existing: string[], edit: boolean, part: 'all' | 'connection' | 'credentials' = 'all'): string {
  const name = String(v.name ?? '').trim();
  if (part !== 'credentials') {
    if (!edit) {
      if (!PG_NAME_RX.test(name)) return 'Name: 3–64 letters, digits, hyphens and underscores.';
      if (existing.some((x) => x.toLowerCase() === name.toLowerCase())) return `A data source named ${name} already exists.`;
    }
    const host = String(v.host ?? '').trim();
    if (!host) return 'Enter the host.';
    if (/\s/.test(host)) return 'The host cannot contain spaces.';
    const port = Number(v.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Port: a number from 1 to 65535.';
    if (!String(v.database ?? '').trim()) return 'Enter the database name.';
    if (!SSL_MODES.includes(v.sslmode || 'disable')) return 'Choose an SSL mode.';
  }
  if (part !== 'connection') {
    if (!String(v.username ?? '').trim()) return 'Enter the user name.';
    if (!edit && !String(v.password ?? '')) return 'Enter the password.';
  }
  return '';
}

export function toPgSourceCreate(v: FormValues): PgSourceCreate {
  return { name: String(v.name).trim(), host: String(v.host).trim(), port: Number(v.port), database: String(v.database).trim(), username: String(v.username).trim(), password: String(v.password ?? ''), sslmode: v.sslmode || 'disable' };
}

/** Changed fields only; the password only when one was typed. null = nothing changed. */
export function toPgSourcePatch(s: PgSource, v: FormValues): PgSourcePatch | null {
  const p: PgSourcePatch = {};
  const host = String(v.host ?? '').trim();
  const db = String(v.database ?? '').trim();
  const user = String(v.username ?? '').trim();
  if (host !== s.host) p.host = host;
  if (Number(v.port) !== s.port) p.port = Number(v.port);
  if (db !== s.database) p.database = db;
  if (user !== s.username) p.username = user;
  if ((v.sslmode || 'disable') !== s.sslmode) p.sslmode = v.sslmode || 'disable';
  if (String(v.password ?? '')) p.password = String(v.password);
  return Object.keys(p).length ? p : null;
}

// ------------------------------------------------------------------ custom SQL
export const PG_FILES: PgFile[] = ['registry', 'observations', 'narratives'];
export const FILE_NAME: Record<PgFile, string> = { registry: 'registry.csv', observations: 'observations.csv', narratives: 'narratives.csv' };
export const FILE_WHAT: Record<PgFile, string> = { registry: 'One row per indicator', observations: 'One row per indicator value and period', narratives: 'Text per indicator and period (optional)' };

export const REQUIRED_COLUMNS: Record<PgFile, string[]> = {
  registry: ['indicator_id', 'name_en', 'name_ar', 'frequency', 'unit', 'dimension', 'geography', 'seasonal_adjustment', 'price_basis', 'definition', 'methodology', 'source', 'sector_id', 'programme_id', 'project_id', 'cms_benchmark_countries', 'cms_country', 'cms_detail', 'cms_intervals', 'cms_parent', 'source_document_metadata', 'source_documents'],
  observations: ['indicator_id', 'period', 'dimension', 'unit', 'value', 'target_value', 'baseline_value', 'baseline_year', 'revision_status', 'approval_status', 'publication_status', 'snapshot_date'],
  narratives: ['indicator_id', 'language', 'period', 'summary', 'details', 'additional_info', 'benchmark', 'source', 'snapshot_date'],
};

/** A commented template for a custom query: the columns it must return, and a SELECT skeleton to edit. */
export function sqlTemplate(f: PgFile): string {
  const cols = REQUIRED_COLUMNS[f];
  return [
    `-- ${FILE_NAME[f]}: ${FILE_WHAT[f].toLowerCase()}.`,
    `-- The query must return these ${cols.length} columns, named exactly like this (use NULL AS <column> for a column you do not have):`,
    ...(f === 'narratives' ? ['-- Optional: leave only comments here to export no narratives.'] : []),
    '-- SELECT',
    ...cols.map((c, i) => `--   NULL AS ${c}${i < cols.length - 1 ? ',' : ''}`),
    '-- FROM my_schema.my_table',
  ].join('\n');
}

/** The SQL without comments, trimmed ('' when the query is only comments). */
export const sqlBody = (sql: string | null | undefined) =>
  String(sql ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, '')
    .trim();

/** Required columns the query does not mention; null when it cannot tell (empty query or `*`). Client-side hint only: the preview checks for real. */
export function missingColumns(sql: string | null | undefined, f: PgFile): string[] | null {
  const body = sqlBody(sql);
  if (!body) return null;
  if (/\bselect\s+(distinct\s+)?\*/i.test(body) || /\.\*/.test(body)) return null;
  return REQUIRED_COLUMNS[f].filter((c) => !new RegExp(`\\b${c}\\b`, 'i').test(body));
}

/** Errors (block saving) and warnings (hints) for the three custom queries. */
export function checkQueries(q: Partial<Record<PgFile, string>>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const f of PG_FILES) {
    const body = sqlBody(q[f]);
    if (!body) {
      if (f !== 'narratives') errors.push(`Write the ${f} query (${FILE_NAME[f]}).`);
      continue;
    }
    if (!/^(select|with)\b/i.test(body)) warnings.push(`${FILE_NAME[f]}: the query should start with SELECT or WITH; the platform reads with a read-only user.`);
    if (/;\s*\S/.test(body)) warnings.push(`${FILE_NAME[f]}: write one statement only.`);
    const miss = missingColumns(q[f], f);
    if (miss === null) warnings.push(`${FILE_NAME[f]}: the query selects *, so its columns are checked by the preview only.`);
    else if (miss.length) warnings.push(`${FILE_NAME[f]}: ${miss.length} required ${miss.length === 1 ? 'column is' : 'columns are'} not named in the query: ${miss.join(', ')}.`);
  }
  return { errors, warnings };
}

// ------------------------------------------------------------------ dataset form
/** KAP names the connector `<collection>_pg` (at most 32 characters) and the pipeline `<collection>_pipeline`. */
export const COLL_RX = /^[A-Za-z0-9_]{4,29}$/;
export const DS_NAME_RX = /^.{3,64}$/;
const YES = 'Yes';

export function datasetValues(d: PgDataset | null): FormValues {
  return {
    // records share the mapping's table and filter keys: the stored setting of the preset wins
    ...(d?.preset === 'records' ? recordsValues(d.records) : { ...recordsValues(null), ...mappingValues(d?.preset === 'mapped' ? d.mapping : null) }),
    name: d?.name ?? '',
    preset: presetLabel(d?.preset ?? 'scai_indicators'),
    published: d ? (d.published_only ? YES : 'No') : YES,
    registry: d?.queries?.registry ?? sqlTemplate('registry'),
    observations: d?.queries?.observations ?? sqlTemplate('observations'),
    narratives: d?.queries?.narratives ?? sqlTemplate('narratives'),
    collection: d?.collection_name ?? '',
    schedule: scheduleLabel(d?.schedule_minutes),
  };
}

export interface DatasetCheckCtx {
  /** names of the other datasets in the tenant */
  names: string[];
  /** collection names already used: KAP collections and other datasets' targets */
  collections: string[];
  edit: boolean;
}

/** Wizard steps: 0 general, 1 data, 2 target collection, 3 schedule, 4 review. */
export function validateDataset(step: number, v: FormValues, c: DatasetCheckCtx): string {
  if (step === 0) {
    const n = String(v.name ?? '').trim();
    if (!DS_NAME_RX.test(n)) return 'Name: 3–64 characters.';
    if (c.names.some((x) => x.toLowerCase() === n.toLowerCase())) return `A dataset named ${n} already exists.`;
  }
  if (step === 1 && v.preset === PRESET_CUSTOM) {
    const { errors } = checkQueries({ registry: v.registry, observations: v.observations, narratives: v.narratives });
    if (errors.length) return errors[0];
  }
  if (step === 2 && !c.edit) {
    const n = String(v.collection ?? '').trim();
    if (!COLL_RX.test(n)) return 'Collection name: 4–29 letters, digits and underscores.';
    if (c.collections.some((x) => x.toLowerCase() === n.toLowerCase())) return `A collection named ${n} already exists. Choose a new name: the export creates its own collection.`;
  }
  return '';
}

function queriesOf(v: FormValues) {
  const narr = sqlBody(v.narratives) ? String(v.narratives) : undefined;
  return { registry: String(v.registry ?? ''), observations: String(v.observations ?? ''), ...(narr ? { narratives: narr } : {}) };
}

export function toPgDatasetCreate(v: FormValues, sourceId: string): PgDatasetCreate {
  const preset = presetOf(v.preset);
  return {
    source_id: sourceId,
    name: String(v.name).trim(),
    preset,
    ...(preset === 'custom' ? { queries: queriesOf(v) } : preset === 'mapped' ? { mapping: toMapping(v) } : preset === 'records' ? { records: toRecords(v) } : { published_only: v.published !== 'No' }),
    collection_name: String(v.collection).trim(),
    schedule_minutes: scheduleMinutes(v.schedule),
  };
}

/** Changed fields only (the target collection does not change once set). null = nothing changed. */
export function toPgDatasetPatch(d: PgDataset, v: FormValues): PgDatasetPatch | null {
  const p: PgDatasetPatch = {};
  const name = String(v.name ?? '').trim();
  const preset = presetOf(v.preset);
  if (name !== d.name) p.name = name;
  if (preset !== d.preset) p.preset = preset;
  if (preset === 'custom') {
    const q = queriesOf(v);
    const cur = d.queries ?? { registry: '', observations: '' };
    if (q.registry !== cur.registry || q.observations !== cur.observations || (q.narratives ?? '') !== (cur.narratives ?? '')) p.queries = q;
  } else if (preset === 'mapped') {
    const m = toMapping(v);
    if (d.preset !== 'mapped' || mappingKey(m) !== mappingKey(d.mapping)) p.mapping = m;
  } else if (preset === 'records') {
    const r = toRecords(v);
    if (d.preset !== 'records' || recordsKey(r) !== recordsKey(d.records)) p.records = r;
  } else if ((v.published !== 'No') !== d.published_only) p.published_only = v.published !== 'No';
  const min = scheduleMinutes(v.schedule, d.schedule_minutes);
  if ((min ?? null) !== (d.schedule_minutes ?? null)) p.schedule_minutes = min;
  return Object.keys(p).length ? p : null;
}

// ------------------------------------------------------------------ dataset rows
export function lastRunText(d: PgDataset, now: number): string {
  if (!d.last_run) return 'Never run';
  return `${EXPORT_STATUS_LABEL[d.last_run.status] ?? d.last_run.status}${d.last_run.finished_at ? ` · ${rel(d.last_run.finished_at, now)}` : ''}`;
}

/** The files of a dataset preview in order, with at most `max` rows each. */
export function previewFiles(p: PgDatasetPreview, max = 5) {
  const files = p.files ?? {};
  return PG_FILES.filter((f) => files[f]).map((f) => {
    const x = files[f]!;
    return { file: f, name: FILE_NAME[f], columns: x.columns, rows: x.rows.slice(0, max), count: x.count, more: Math.max(0, x.count - Math.min(max, x.rows.length)) };
  });
}

export const cellText = (v: unknown) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
