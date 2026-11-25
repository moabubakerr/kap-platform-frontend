/**
 * KAP ↔ Data Ingestion Hub (live tenant). Pure mapping of KAP connectors,
 * pipelines, collections and pipeline jobs onto the hub's types
 * (`src/v35/data/ingest.ts`), and the KAP request bodies the hub's writes send.
 *
 * KAP concepts: a connector (S3; `fs` connectors exist but the REST API manages
 * S3 only) brings files in on its sync interval; a collection references one
 * pipeline (`pipeline_ref`) and its connectors by name; a pipeline is an ordered
 * list of stages (document: parser → transformer? → embedding; indicators: one
 * csv_loader); a pipeline job is one manual run of one collection.
 *
 * Fields KAP doesn't have get honest defaults ('—', empty lists).
 */
import type { FormValues } from '@/engine/dialogs';
import type { IngestTenant, PipeCfg, Pipeline, Run, RunStatus, Source, SourceStatus, Stage } from '@/v35/data/ingest';
import { triggerOf } from './runView';

// ------------------------------------------------------------------ KAP records (subset of the OpenAPI schemas)
export interface KapSecretStatus {
  is_set: boolean;
}
export interface KapSecretRef {
  $secret: { backend: 'vault' | 'azure_key_vault'; secret_id: string; version: string };
}
/** ConnectorOut */
export interface KapConnector {
  id: string;
  name: string;
  type: 's3' | 'fs' | string;
  settings?: {
    object_selector?: { prefix?: string; include_globs?: string[]; exclude_globs?: string[] };
    sync?: { interval?: string; max_file_size?: number };
  };
  config?: {
    bucket_name?: string;
    region?: string;
    endpoint_url?: string;
    use_ssl?: boolean;
    verify_tls?: boolean;
    tls_ca_file?: string | null;
    addressing_style?: 'auto' | 'path' | 'virtual';
    auth?: { type?: string; access_key?: KapSecretStatus; secret_key?: KapSecretStatus };
    [k: string]: unknown;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
/** ConnectorCheckOut */
export interface KapConnectorCheck {
  status: 'ok' | 'unavailable';
  checked_at: string;
  reason_code: string | null;
}

export interface KapParseRoute {
  match: { extensions: string[] };
  parser: { provider: string; output?: string; config?: Record<string, unknown> };
}
export type KapStage =
  | { name: string; type: 'parser'; routes: KapParseRoute[] }
  | { name: string; type: 'transformer'; config: { model_ref: string; tasks: { name: string; enabled?: boolean; config?: unknown }[] } }
  | { name: string; type: 'embedding'; config: { model_ref: string; chunking?: { chunk_size?: number; overlap?: number } } }
  | { name: string; type: 'csv_loader'; config: { files: Record<string, string>; [k: string]: unknown } };

/** PipelineOut */
export interface KapPipeline {
  id: string;
  name: string;
  kind: 'document' | 'indicators';
  mode?: 'snapshot' | 'delta' | null;
  semantic?: { measure_texts?: Record<string, unknown> } | null;
  embedding_model_ref?: string | null;
  stages: KapStage[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
/** CollectionOut (only active collections are listed) */
export interface KapCollection {
  id: string;
  name: string;
  pipeline_ref: string;
  connectors: string[];
  sync_strategy?: string;
  created_at?: string;
  updated_at?: string;
}
export type KapJobState = 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled';
/** PipelineJobListItem; `result` and `error` only in PipelineJobDetail */
export interface KapJob {
  id: string;
  pipeline_id: string;
  collection_id: string;
  connector_id?: string | null;
  state: KapJobState;
  progress: { total: number | null; completed: number; percent: number | null };
  created_at: string;
  running_at?: string | null;
  finished_at?: string | null;
  result?: { succeeded: number; failed: number; cancelled: number } | null;
  error?: { code: string; message: string } | null;
}
/** ModelProviderOut (subset) */
export interface KapModel {
  id: string;
  name: string;
  model_type: 'chat' | 'embedding' | string;
  model_name?: string;
}

/** Raw KAP records of a live tenant's ingestion slice. */
export interface KapIngest {
  conns: KapConnector[];
  pipes: KapPipeline[];
  colls: KapCollection[];
  /** newest first */
  jobs: KapJob[];
  models: KapModel[];
  /** last check per connector name (KAP stores no check state; session only) */
  checks: Record<string, KapConnectorCheck>;
  /** runs KAP reports per pipeline id (`total` of the jobs list) */
  jobTotals?: Record<string, number>;
  /** pipelines whose runs could not be read on the last load: name → KAP's message */
  jobErrors?: Record<string, string>;
}

// ------------------------------------------------------------------ hub records with their KAP identity
export interface KapSourceRef {
  id: string;
  type: string;
  active: boolean;
}
export interface KapStageRef {
  /** label shown in the hub: "<stage name> · <type>" */
  n: string;
  type: KapStage['type'];
  /** settings summary */
  cfg: string;
}
export interface KapPipeRef {
  id: string;
  kind: 'document' | 'indicators';
  stages: KapStageRef[];
  /** connectors of the collections that reference the pipeline */
  conns: string[];
}
export interface KapRunRef {
  job: string;
  pipelineId: string;
  collectionId: string;
  collection: string;
  connector: string;
  state: KapJobState;
  percent: number | null;
  /** files discovered (null until discovery has finished) and finished */
  total: number | null;
  completed: number;
  createdAt: string;
  trigger: 'console' | 'scan' | 'outside';
  error: { code: string; message: string } | null;
  /** detail (result, error) loaded */
  detail: boolean;
}

export type LiveSource = Source & { kap?: KapSourceRef; sess?: boolean };
export type LivePipeCfg = PipeCfg & { kap?: KapPipeRef };
export type LivePipeline = Omit<Pipeline, 'v'> & { v: LivePipeCfg; sess?: boolean };
export type LiveRun = Run & { kap?: KapRunRef };

export const kapOfSource = (s: Source | null | undefined) => (s as LiveSource | null | undefined)?.kap;
export const kapOfPipe = (p: Pipeline | null | undefined) => (p?.v as LivePipeCfg | undefined)?.kap;
export const kapOfRun = (r: Run | null | undefined) => (r as LiveRun | null | undefined)?.kap;
export const isSess = (x: Source | Pipeline | null | undefined) => !!(x as { sess?: boolean } | null | undefined)?.sess;

// ------------------------------------------------------------------ time
/** "just now", "12 min ago", "3 h ago", "4 d ago" (the hub's relative times; `ageDays` reads them). */
export function rel(iso: string | null | undefined, now: number): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** "48 s", "1 min 12 s", "2 h 05 min" */
export function span(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
}

const clock = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(11, 19);
};

// ------------------------------------------------------------------ connectors → sources
export const CHECK_REASON: Record<string, string> = {
  connection_error: 'The endpoint could not be reached.',
  tls_error: 'The TLS handshake failed (certificate or protocol).',
  authorization_error: 'The keys were not authorized for the bucket.',
  bucket_not_found: 'The bucket does not exist.',
  not_writable: 'The bucket is readable but KAP could not write its test object.',
  timeout: 'The storage did not answer in time.',
  secret_unavailable: 'The referenced secrets could not be read from the secret store.',
};

export function checkMessage(c: KapConnectorCheck): string {
  return c.status === 'ok'
    ? 'KAP reached the endpoint and bucket, authorized the keys, and wrote and removed a test object.'
    : `${CHECK_REASON[c.reason_code ?? ''] ?? 'The connector is unavailable.'}${c.reason_code ? ` (${c.reason_code})` : ''}`;
}

const yn = (b: boolean | undefined) => (b === undefined ? '—' : b ? 'Yes' : 'No');
const MB = (n: number | undefined) => (n == null ? '—' : `${Math.round(n / 1048576).toLocaleString('en-US')} MB`);

/** ISO 8601 durations KAP uses for sync intervals, in words. */
export function intervalL(iso: string | undefined): string {
  if (!iso) return '—';
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return iso;
  const [, d, h, mi, s] = m;
  const parts = [d && `${d} d`, h && `${h} h`, mi && `${mi} min`, s && `${s} s`].filter(Boolean);
  return parts.length ? `Every ${parts.join(' ')} (${iso})` : iso;
}

export function toSource(c: KapConnector, now: number, check?: KapConnectorCheck): LiveSource {
  const sel = c.settings?.object_selector ?? {};
  const sync = c.settings?.sync ?? {};
  const k = c.config ?? {};
  const s3 = c.type === 's3';
  const prefix = sel.prefix ?? '';
  const cfg: Record<string, string> = s3
    ? {
        endpoint: String(k.endpoint_url ?? '—'),
        region: String(k.region || '—'),
        bucket: String(k.bucket_name ?? '—'),
        base: prefix ? `/${prefix.replace(/^\/+/, '')}` : '/',
        include: (sel.include_globs ?? []).join(', ') || 'All objects',
        exclude: (sel.exclude_globs ?? []).join(', ') || 'None',
        interval: intervalL(sync.interval),
        maxsize: MB(sync.max_file_size),
        ssl: yn(k.use_ssl),
        verify: yn(k.verify_tls),
        addressing: String(k.addressing_style ?? '—'),
        ca: k.tls_ca_file ? String(k.tls_ca_file) : 'System trust store',
      }
    : {
        // fs connectors are configured by the platform; their config shape is not in the OpenAPI spec
        path: String(k.path ?? k.root_path ?? k.root ?? k.base_path ?? '—'),
        include: (sel.include_globs ?? []).join(', ') || 'All files',
        exclude: (sel.exclude_globs ?? []).join(', ') || 'None',
        interval: intervalL(sync.interval),
      };
  const keysSet = !!(k.auth?.access_key?.is_set && k.auth?.secret_key?.is_set);
  const st: SourceStatus = !c.is_active ? 'Disabled' : check ? (check.status === 'ok' ? 'Connected' : 'Failed') : 'Not tested';
  const act: [string, string, string][] = [];
  if (check) act.push([rel(check.checked_at, now), '—', `Connection check ${check.status === 'ok' ? 'succeeded' : `failed: ${checkMessage(check)}`}`]);
  if (!c.is_active) act.push([rel(c.updated_at, now), '—', 'Deactivated in KAP (scanning stopped)']);
  else if (c.updated_at && c.updated_at !== c.created_at) act.push([rel(c.updated_at, now), '—', 'Configuration changed in KAP']);
  act.push([rel(c.created_at, now), '—', 'Created in KAP']);
  return {
    id: c.name,
    type: s3 ? 'S3' : 'File repository',
    desc: s3 ? '' : 'File-system connector (configured by the platform; the KAP API manages S3 connectors only).',
    cfg,
    auth: s3 ? (k.auth?.type === 'static_keys' || !k.auth?.type ? 'Access key and secret key' : String(k.auth.type)) : 'Platform-managed',
    cred: s3 ? (keysSet ? 'Secret references (values never shown)' : 'Keys not set') : '',
    ident: s3 ? '' : 'Platform-managed',
    st,
    chk: check ? rel(check.checked_at, now) : 'Not checked',
    err: check && check.status !== 'ok' ? checkMessage(check) : '',
    impl: 'Implemented',
    browse: [],
    act,
    kap: { id: c.id, type: c.type, active: c.is_active },
  };
}

// ------------------------------------------------------------------ pipelines
const STAGE_TYPE: Record<string, string> = { parser: 'Parser', transformer: 'Transformer', embedding: 'Embedding', csv_loader: 'CSV loader' };
export const stageLabel = (s: Pick<KapStage, 'name' | 'type'>) => `${s.name} · ${STAGE_TYPE[s.type] ?? s.type}`;

export function stageSettings(s: KapStage): string {
  switch (s.type) {
    case 'parser':
      return s.routes.map((r) => `${r.match.extensions.join(', ')} → ${r.parser.provider}${r.parser.provider === 'vision_model' && r.parser.config?.model_ref ? ` (${r.parser.config.model_ref})` : ''}`).join(' · ') || 'No routes';
    case 'transformer':
      return `${s.config.tasks.filter((x) => x.enabled !== false).map((x) => x.name).join(', ') || 'No tasks'} · model ${s.config.model_ref}`;
    case 'embedding': {
      const ch = s.config.chunking ?? {};
      return `Model ${s.config.model_ref} · chunks of ${ch.chunk_size ?? 800} tokens, ${ch.overlap ?? 120} overlap`;
    }
    case 'csv_loader':
      return Object.entries(s.config.files || {}).map(([pat, ds]) => `${pat} → ${ds}`).join(' · ') || 'No file mappings';
    default:
      return '—';
  }
}

export const parserExts = (p: Pick<KapPipeline, 'stages'>) => [...new Set(p.stages.flatMap((s) => (s.type === 'parser' ? s.routes.flatMap((r) => r.match.extensions) : [])))];

export function toPipeline(p: KapPipeline, colls: KapCollection[]): LivePipeline {
  const used = colls.filter((c) => c.pipeline_ref === p.name);
  const conns = [...new Set(used.flatMap((c) => c.connectors))];
  const stages: KapStageRef[] = p.stages.map((s) => ({ n: stageLabel(s), type: s.type, cfg: stageSettings(s) }));
  const doc = p.kind === 'document';
  const csv = p.stages.find((s) => s.type === 'csv_loader') as Extract<KapStage, { type: 'csv_loader' }> | undefined;
  const emb = p.stages.find((s) => s.type === 'embedding') as Extract<KapStage, { type: 'embedding' }> | undefined;
  const exts = parserExts(p);
  const v: LivePipeCfg = {
    src: conns[0] ?? '',
    sel: 'Folder / prefix',
    path: '',
    pat: doc ? exts.map((e) => `*.${e}`).join(', ') : Object.keys(csv?.config.files ?? {}).join(', '),
    rec: 'Yes',
    zip: 'No',
    which: 'New or changed files only',
    chg: 'Content fingerprint and file version',
    sSteps: doc ? [] : stages.map((s) => s.n),
    uSteps: doc ? stages.map((s) => s.n) : [],
    chunk: emb ? `${emb.config.chunking?.chunk_size ?? 800} tokens · ${emb.config.chunking?.overlap ?? 120} overlap` : undefined,
    entTypes: [],
    dsName: doc ? '' : Object.values(csv?.config.files ?? {}).join(', '),
    mode: doc ? undefined : p.mode === 'delta' ? 'Delta (additions and updates only)' : p.mode === 'snapshot' ? 'Snapshot (complete state; missing rows are deleted)' : '—',
    keys: '',
    colls: used.map((c) => c.name),
    trig: 'Manual run or connector sync',
    sched: '',
    ev: '',
    kap: { id: p.id, kind: p.kind, stages, conns },
  };
  return {
    id: p.name,
    on: p.is_active,
    impl: 'Implemented',
    desc: `${doc ? 'Document' : 'Indicator'} pipeline · ${p.stages.length} ${p.stages.length === 1 ? 'stage' : 'stages'}${doc ? '' : ` · embeddings ${p.embedding_model_ref ?? '—'}`}${p.is_active ? '' : ' · deleted in KAP (restore to use it again)'}`,
    v,
  };
}

// ------------------------------------------------------------------ jobs → runs
/** Hub id of a job: the first 8 characters of its UUID. */
export const runId = (jobId: string) => jobId.slice(0, 8);

export function runStatus(j: Pick<KapJob, 'state' | 'result'>): RunStatus {
  switch (j.state) {
    case 'waiting':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'succeeded':
      return j.result && j.result.failed > 0 ? 'Partially succeeded' : 'Succeeded';
    case 'failed':
      return 'Failed';
    default:
      return 'Cancelled';
  }
}

export const ACTIVE_STATES: KapJobState[] = ['waiting', 'running'];
export const isActiveJob = (j: Pick<KapJob, 'state'>) => ACTIVE_STATES.includes(j.state);

export interface RunNames {
  pipes: Record<string, string>;
  colls: Record<string, string>;
  conns: Record<string, string>;
  /** the console started this job (`consoleRuns.ts`) */
  ours?: (jobId: string) => boolean;
}

export function toRun(j: KapJob, now: number, names: RunNames): LiveRun {
  const st = runStatus(j);
  const active = isActiveJob(j);
  const startIso = j.running_at ?? null;
  const dur = j.finished_at && startIso ? span(Date.parse(j.finished_at) - Date.parse(startIso)) : active && startIso ? `${span(now - Date.parse(startIso))} (running)` : j.finished_at ? '—' : 'not started';
  const coll = names.colls[j.collection_id] ?? 'collection not listed';
  const conn = j.connector_id ? names.conns[j.connector_id] ?? 'connector not listed' : '';
  const trig = triggerOf(j, conn, !!names.ours?.(j.id));
  const total = j.progress?.total;
  const done = j.progress?.completed ?? 0;
  const R = j.result;
  const inN = total == null ? (active ? 'Counting files…' : '—') : total === 0 ? 'No new or changed files' : `${total.toLocaleString('en-US')} ${total === 1 ? 'file' : 'files'}`;
  const outN = R
    ? total === 0 && !R.succeeded && !R.failed && !R.cancelled
      ? 'Nothing to process'
      : [`${R.succeeded.toLocaleString('en-US')} succeeded`, R.failed ? `${R.failed.toLocaleString('en-US')} failed` : '', R.cancelled ? `${R.cancelled.toLocaleString('en-US')} cancelled` : ''].filter(Boolean).join(' · ')
    : active
      ? `${done.toLocaleString('en-US')} of ${total == null ? '?' : total.toLocaleString('en-US')} files finished`
      : '—';
  const errN = (R?.failed ?? 0) || (j.state === 'failed' ? 1 : 0);
  // KAP reports progress per run, not per stage: the run page derives its steps from the files (runView.ts)
  const stages: Stage[] = [];
  const logs: [string, string, string][] = [[clock(j.created_at), 'INFO', `Run registered for collection ${coll} · ${trig.label}${conn && trig.kind !== 'scan' ? ` · narrowed to connector ${conn}` : ''}`]];
  if (j.running_at) logs.push([clock(j.running_at), 'INFO', 'A worker started the run']);
  if (j.progress?.total != null && j.running_at) logs.push(['—', 'INFO', j.progress.total === 0 ? 'No new or changed files to process' : `Found ${j.progress.total} new or changed ${j.progress.total === 1 ? 'file' : 'files'}`]);
  if (j.finished_at) logs.push([clock(j.finished_at), j.state === 'failed' ? 'ERROR' : j.state === 'cancelled' ? 'WARN' : 'INFO', `Run ${j.state}${R ? ` · ${R.succeeded} succeeded, ${R.failed} failed, ${R.cancelled} cancelled` : ''}`]);
  if (j.error) logs.push([clock(j.finished_at), 'ERROR', `${j.error.code}: ${j.error.message}`]);
  return {
    id: runId(j.id),
    pipe: names.pipes[j.pipeline_id] ?? j.pipeline_id.slice(0, 8),
    trig: trig.label,
    start: rel(j.created_at, now),
    dur,
    st,
    inN,
    outN,
    errN,
    stages,
    items: [],
    logs,
    outDs: [],
    outDocs: [],
    batch: null,
    kap: {
      job: j.id,
      pipelineId: j.pipeline_id,
      collectionId: j.collection_id,
      collection: coll,
      connector: conn,
      state: j.state,
      percent: j.progress?.percent ?? null,
      total: j.progress?.total ?? null,
      completed: j.progress?.completed ?? 0,
      createdAt: j.created_at,
      trigger: trig.kind,
      error: j.error ?? null,
      detail: j.result !== undefined || j.error !== undefined,
    },
  };
}

/** Newest first, at most `max`. */
export const sortJobs = (jobs: KapJob[], max = 200) => [...jobs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, max);

// ------------------------------------------------------------------ the tenant slice
/**
 * The hub slice for a live tenant: KAP records, plus the session-only records
 * (non-S3 sources, their pipelines and simulated runs) already in `prev`.
 */
export function toIngestTenant(K: KapIngest, prev: IngestTenant | undefined, now: number, ours?: (jobId: string) => boolean): IngestTenant {
  const sessSources = (prev?.sources ?? []).filter((s) => isSess(s));
  const sessPipes = (prev?.pipelines ?? []).filter((p) => isSess(p));
  const sessPipeIds = new Set(sessPipes.map((p) => p.id));
  const sessRuns = (prev?.runs ?? []).filter((r) => !kapOfRun(r) && sessPipeIds.has(r.pipe));
  const names = {
    pipes: Object.fromEntries(K.pipes.map((p) => [p.id, p.name])),
    colls: Object.fromEntries(K.colls.map((c) => [c.id, c.name])),
    conns: Object.fromEntries(K.conns.map((c) => [c.id, c.name])),
    ours,
  };
  const runs =[...K.jobs.map((j) => toRun(j, now, names)), ...sessRuns];
  return {
    sources: [...K.conns.map((c) => toSource(c, now, K.checks[c.name])), ...sessSources],
    pipelines: [...(K.pipes.map((p) => toPipeline(p, K.colls)) as Pipeline[]), ...sessPipes],
    runs,
    pub: {
      colls: [...K.colls.map((c) => ({ id: c.name, ds: [], docs: [] })), ...(prev?.pub.colls ?? []).filter((c) => sessPipes.some((p) => p.v.colls.includes(c.id)) && !K.colls.some((k) => k.name === c.id))],
      datasets: prev?.pub.datasets.filter(() => sessPipes.length) ?? [],
      documents: prev?.pub.documents.filter(() => sessPipes.length) ?? [],
    },
    onto: prev?.onto ?? [],
    creds: prev?.creds ?? [],
  };
}

// ------------------------------------------------------------------ connector bodies
export const NAME_RX_KAP = /^[a-zA-Z0-9_]{4,32}$/;
export const PIPE_NAME_RX_KAP = /^[a-zA-Z0-9_]{4,64}$/;
export const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const INTERVALS = ['PT1M', 'PT3M', 'PT5M', 'PT15M', 'PT30M', 'PT1H', 'PT6H', 'P1D'];
/** File types KAP pipelines can read (OpenAPI `SupportedFileExtension`). */
export const KAP_EXTS = ['csv', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpeg', 'jpg', 'png', 'tiff', 'tif', 'wav', 'mp3', 'mp4', 'zip'];
/** Extensions named in include patterns that KAP cannot read (e.g. `**\/*.txt` → ['txt']). */
export function unsupportedExts(include: unknown): string[] {
  const exts = String(include ?? '')
    .split(',')
    .map((g) => g.trim().match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase())
    .filter((x): x is string => !!x && !x.includes('*'));
  return [...new Set(exts.filter((x) => !KAP_EXTS.includes(x)))];
}
export const KEEP_KEYS = 'Keep the stored keys';
export const NEW_KEYS = 'Set new keys';
/** How the keys are given: typed values (KAP with SECRET_PROVIDER_MODE=disabled, e.g. the test stand) or secret-store references. */
export const KEYS_TYPED = 'Type the key values';
export const KEYS_REF = 'Secret store reference';

const globs = (s: unknown) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const bool = (s: unknown) => s === 'Yes';
const ref = (backend: string, id: unknown, version: unknown): KapSecretRef => ({ $secret: { backend: (backend === 'azure_key_vault' ? 'azure_key_vault' : 'vault'), secret_id: String(id ?? '').trim(), version: String(version ?? '').trim() || '1' } });
/** `auth` for KAP: typed values are sent as plain strings (KAP rejects them when its secret store is required). */
const authOf = (v: FormValues) =>
  v.key_mode === KEYS_REF
    ? { type: 'static_keys' as const, access_key: ref(v.backend, v.ak_id, v.ak_ver), secret_key: ref(v.backend, v.sk_id, v.sk_ver) }
    : { type: 'static_keys' as const, access_key: String(v.ak_value ?? ''), secret_key: String(v.sk_value ?? '') };

/** Wizard values for an S3 connector (new, or prefilled from KAP). */
export function connectorValues(c: KapConnector | null): FormValues {
  const sel = c?.settings?.object_selector ?? {};
  const k = c?.config ?? {};
  return {
    name: c?.name ?? '',
    endpoint_url: k.endpoint_url ?? '',
    region: k.region ?? '',
    bucket_name: k.bucket_name ?? '',
    prefix: sel.prefix ?? '',
    include: (sel.include_globs ?? []).join(', '),
    exclude: (sel.exclude_globs ?? []).join(', '),
    interval: c?.settings?.sync?.interval ?? 'PT3M',
    use_ssl: k.use_ssl === false ? 'No' : 'Yes',
    verify_tls: k.verify_tls === false ? 'No' : 'Yes',
    addressing_style: k.addressing_style ?? 'auto',
    keys: c ? KEEP_KEYS : NEW_KEYS,
    key_mode: KEYS_TYPED,
    ak_value: '',
    sk_value: '',
    backend: 'vault',
    ak_id: '',
    ak_ver: '1',
    sk_id: '',
    sk_ver: '1',
    check: 'Yes',
  };
}

/** Problem with the S3 wizard values at `step` ('' = fine). Steps: 1 name, 2 connection, 3 credentials. */
export function validateConnector(step: number, v: FormValues, existing: string[], edit: boolean, needKeys: boolean): string {
  if (step === 1 && !edit) {
    const n = String(v.name || '').trim();
    if (!NAME_RX_KAP.test(n)) return 'Name: 4–32 letters, digits and underscores.';
    if (existing.includes(n)) return 'A data source with this name exists in KAP. Reactivate it instead.';
  }
  if (step === 2) {
    if (!/^https?:\/\/\S+$/.test(String(v.endpoint_url || '').trim())) return 'Enter the endpoint URL, e.g. https://s3.example.internal.';
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(String(v.bucket_name || '').trim())) return 'Bucket: 3–63 lower-case letters, digits, dots and hyphens.';
    if (!/^P(?!$)(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/.test(String(v.interval || ''))) return 'Sync interval: an ISO 8601 duration such as PT3M or P1D.';
  }
  if (step === 3 && (needKeys || v.keys === NEW_KEYS) && v.key_mode !== KEYS_REF) {
    if (!String(v.ak_value ?? '').trim() || !String(v.sk_value ?? '')) return 'Enter the access key and the secret key.';
  }
  if (step === 3 && (needKeys || v.keys === NEW_KEYS) && v.key_mode === KEYS_REF) {
    if (!UUID_RX.test(String(v.ak_id || '').trim())) return 'Access key: enter the secret id (a UUID) of its version in the secret store.';
    if (!UUID_RX.test(String(v.sk_id || '').trim())) return 'Secret key: enter the secret id (a UUID) of its version in the secret store.';
    if (!String(v.ak_ver || '').trim() || !String(v.sk_ver || '').trim()) return 'Enter the secret versions.';
  }
  return '';
}

/** POST /api/connectors body (also reactivates a deactivated connector of that name). */
export function toKapConnectorCreate(v: FormValues) {
  return {
    name: String(v.name).trim(),
    type: 's3' as const,
    settings: {
      object_selector: { prefix: String(v.prefix ?? '').trim(), include_globs: globs(v.include), exclude_globs: globs(v.exclude) },
      sync: { interval: String(v.interval || 'PT3M') },
    },
    config: {
      bucket_name: String(v.bucket_name).trim(),
      ...(String(v.region ?? '').trim() ? { region: String(v.region).trim() } : {}),
      endpoint_url: String(v.endpoint_url).trim(),
      use_ssl: bool(v.use_ssl),
      verify_tls: bool(v.verify_tls),
      addressing_style: (v.addressing_style || 'auto') as 'auto' | 'path' | 'virtual',
      auth: authOf(v),
    },
  };
}

/** PATCH /api/connectors/{id} body: only what changed (null = nothing to send). */
export function toKapConnectorPatch(c: KapConnector, v: FormValues): Record<string, unknown> | null {
  const cur = connectorValues(c);
  const out: Record<string, any> = {};
  const os: Record<string, unknown> = {};
  if (String(v.prefix ?? '').trim() !== cur.prefix) os.prefix = String(v.prefix ?? '').trim();
  if (globs(v.include).join(',') !== globs(cur.include).join(',')) os.include_globs = globs(v.include);
  if (globs(v.exclude).join(',') !== globs(cur.exclude).join(',')) os.exclude_globs = globs(v.exclude);
  const settings: Record<string, unknown> = {};
  if (Object.keys(os).length) settings.object_selector = os;
  if (v.interval !== cur.interval) settings.sync = { interval: v.interval };
  if (Object.keys(settings).length) out.settings = settings;
  const config: Record<string, unknown> = {};
  for (const k of ['endpoint_url', 'region', 'bucket_name'] as const) if (String(v[k] ?? '').trim() !== String(cur[k] ?? '')) config[k] = String(v[k] ?? '').trim();
  for (const k of ['use_ssl', 'verify_tls'] as const) if (v[k] !== cur[k]) config[k] = bool(v[k]);
  if (v.addressing_style !== cur.addressing_style) config.addressing_style = v.addressing_style;
  if (v.keys === NEW_KEYS) config.auth = authOf(v);
  if (Object.keys(config).length) out.config = config;
  return Object.keys(out).length ? out : null;
}

// ------------------------------------------------------------------ pipeline bodies
export const DOC_EXTS = ['pdf', 'doc', 'docx'];
export const IMG_EXTS = ['jpeg', 'jpg', 'png', 'tiff', 'tif'];
export const TASKS = ['summary', 'metadata'];
export const NO_MODEL = 'None';

/** Wizard values for a KAP pipeline (new, or prefilled from KAP). */
export function pipelineValues(p: KapPipeline | null): FormValues {
  if (!p) return { name: '', kind: 'document', exts: ['pdf', 'docx'], imgs: [], vision: NO_MODEL, tasks: [], chat: NO_MODEL, embed: '', chunk: '800', overlap: '120', mode: 'delta', registry: 'registry*.csv', observations: 'observations*.csv' };
  const routes = p.stages.flatMap((s) => (s.type === 'parser' ? s.routes : []));
  const tr = p.stages.find((s) => s.type === 'transformer') as Extract<KapStage, { type: 'transformer' }> | undefined;
  const em = p.stages.find((s) => s.type === 'embedding') as Extract<KapStage, { type: 'embedding' }> | undefined;
  const csv = p.stages.find((s) => s.type === 'csv_loader') as Extract<KapStage, { type: 'csv_loader' }> | undefined;
  const vis = routes.find((r) => r.parser.provider === 'vision_model');
  const files = Object.entries(csv?.config.files ?? {});
  return {
    name: p.name,
    kind: p.kind,
    exts: routes.filter((r) => r.parser.provider !== 'vision_model').flatMap((r) => r.match.extensions),
    imgs: vis ? vis.match.extensions : [],
    vision: String(vis?.parser.config?.model_ref ?? NO_MODEL),
    tasks: tr ? tr.config.tasks.filter((x) => x.enabled !== false).map((x) => x.name) : [],
    chat: tr?.config.model_ref ?? NO_MODEL,
    embed: (p.kind === 'indicators' ? p.embedding_model_ref : em?.config.model_ref) ?? '',
    chunk: String(em?.config.chunking?.chunk_size ?? 800),
    overlap: String(em?.config.chunking?.overlap ?? 120),
    mode: p.mode ?? 'delta',
    registry: files.find(([, d]) => d === 'registry')?.[0] ?? 'registry*.csv',
    observations: files.find(([, d]) => d === 'observations')?.[0] ?? 'observations*.csv',
  };
}

/** Problem with the pipeline wizard values at `step` ('' = fine). Steps: 0 general, 1 stages. */
export function validatePipeline(step: number, v: FormValues, existing: string[], edit: boolean): string {
  if (step === 0 && !edit) {
    const n = String(v.name || '').trim();
    if (!PIPE_NAME_RX_KAP.test(n)) return 'Name: 4–64 letters, digits and underscores.';
    if (existing.includes(n)) return 'A pipeline with this name exists in KAP. Restore it instead.';
  }
  if (step === 1) {
    if (!v.embed || v.embed === NO_MODEL) return 'Choose an embedding model.';
    if (v.kind === 'indicators') {
      if (!String(v.registry || '').trim() || !String(v.observations || '').trim()) return 'Enter the file patterns for the registry and the observations.';
      return '';
    }
    if (!(v.exts || []).length && !(v.imgs || []).length) return 'Choose at least one file type to parse.';
    if ((v.imgs || []).length && (!v.vision || v.vision === NO_MODEL)) return 'Images are parsed by a vision model: choose a chat model.';
    if ((v.tasks || []).length && (!v.chat || v.chat === NO_MODEL)) return 'Summary and metadata need a chat model.';
    const cs = Number(v.chunk);
    const ov = Number(v.overlap);
    if (!Number.isInteger(cs) || cs < 50 || cs > 4096) return 'Chunk size: 50–4096 tokens.';
    if (!Number.isInteger(ov) || ov < 0 || ov > 1024) return 'Overlap: 0–1024 tokens.';
  }
  return '';
}

/** The stages the wizard values describe; parser configs, transformer task configs and stage names of `orig` are kept where they still apply. */
export function toKapStages(v: FormValues, orig?: KapPipeline | null): KapStage[] {
  const o = orig?.stages ?? [];
  const nameOf = (type: KapStage['type'], dflt: string) => o.find((s) => s.type === type)?.name ?? dflt;
  if (v.kind === 'indicators') {
    const old = o.find((s) => s.type === 'csv_loader') as Extract<KapStage, { type: 'csv_loader' }> | undefined;
    const files: Record<string, string> = Object.fromEntries(Object.entries(old?.config.files ?? {}).filter(([, d]) => d !== 'registry' && d !== 'observations'));
    files[String(v.registry).trim()] = 'registry';
    files[String(v.observations).trim()] = 'observations';
    return [{ name: nameOf('csv_loader', 'load_csv'), type: 'csv_loader', config: { ...(old?.config ?? {}), files } }];
  }
  const oldRoutes = o.flatMap((s) => (s.type === 'parser' ? s.routes : []));
  const exts: string[] = v.exts || [];
  // keep the stored routes (and their grouping and parser settings) for the extensions still selected
  const routes: KapParseRoute[] = oldRoutes
    .filter((r) => r.parser.provider !== 'vision_model')
    .map((r) => ({ ...r, match: { ...r.match, extensions: r.match.extensions.filter((e) => exts.includes(e)) } }))
    .filter((r) => r.match.extensions.length);
  const covered = new Set(routes.flatMap((r) => r.match.extensions));
  exts.filter((e) => !covered.has(e)).forEach((ext) => routes.push({ match: { extensions: [ext] }, parser: { provider: ext, output: 'markdown' } }));
  if ((v.imgs || []).length) {
    const old = oldRoutes.find((r) => r.parser.provider === 'vision_model');
    routes.push({ match: { extensions: v.imgs }, parser: { provider: 'vision_model', output: 'markdown', config: { ...(old?.parser.config ?? {}), model_ref: v.vision } } });
  }
  const stages: KapStage[] = [{ name: nameOf('parser', 'parse'), type: 'parser', routes }];
  if ((v.tasks || []).length) {
    const old = o.find((s) => s.type === 'transformer') as Extract<KapStage, { type: 'transformer' }> | undefined;
    stages.push({
      name: nameOf('transformer', 'transform'),
      type: 'transformer',
      config: { ...(old?.config ?? {}), model_ref: v.chat, tasks: (v.tasks as string[]).map((n) => ({ ...(old?.config.tasks.find((t) => t.name === n) ?? {}), name: n, enabled: true })) },
    });
  }
  const oldE = o.find((s) => s.type === 'embedding') as Extract<KapStage, { type: 'embedding' }> | undefined;
  stages.push({ name: nameOf('embedding', 'embed'), type: 'embedding', config: { ...(oldE?.config ?? {}), model_ref: v.embed, chunking: { chunk_size: Number(v.chunk), overlap: Number(v.overlap) } } });
  return stages;
}

/** POST /api/pipelines body. */
export function toKapPipelineCreate(v: FormValues) {
  const ind = v.kind === 'indicators';
  return {
    name: String(v.name).trim(),
    kind: ind ? ('indicators' as const) : ('document' as const),
    ...(ind ? { mode: v.mode === 'snapshot' ? 'snapshot' : 'delta', embedding_model_ref: v.embed } : {}),
    stages: toKapStages(v),
  };
}

/** POST /api/pipelines body that restores a deleted (deactivated) pipeline with its stored configuration. */
export function toKapPipelineRestore(p: KapPipeline) {
  return {
    name: p.name,
    kind: p.kind,
    ...(p.mode ? { mode: p.mode } : {}),
    ...(p.semantic && Object.keys(p.semantic).length ? { semantic: p.semantic } : {}),
    ...(p.embedding_model_ref ? { embedding_model_ref: p.embedding_model_ref } : {}),
    stages: p.stages,
  };
}

/** PATCH /api/pipelines/{id} body: only what changed (null = nothing to send). */
export function toKapPipelinePatch(p: KapPipeline, v: FormValues): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  // compare what the wizard shows, not the regenerated stages, so an unchanged pipeline is not reprocessed
  const cur = pipelineValues(p);
  const norm = (x: FormValues) =>
    JSON.stringify(
      x.kind === 'indicators'
        ? [String(x.registry).trim(), String(x.observations).trim()]
        : [[...(x.exts || [])].sort(), [...(x.imgs || [])].sort(), (x.imgs || []).length ? x.vision : '', [...(x.tasks || [])].sort(), (x.tasks || []).length ? x.chat : '', x.embed, String(x.chunk), String(x.overlap)],
    );
  if (norm(v) !== norm(cur)) out.stages = toKapStages(v, p);
  if (p.kind === 'indicators') {
    if (v.mode !== (p.mode ?? 'delta')) out.mode = v.mode;
    if (v.embed !== p.embedding_model_ref) out.embedding_model_ref = v.embed;
  }
  return Object.keys(out).length ? out : null;
}

/** POST /api/pipelines/{id}/run body. */
export const toKapRun = (collectionId: string, connectorId?: string | null) => ({ collection_id: collectionId, ...(connectorId ? { connector_id: connectorId } : {}) });
