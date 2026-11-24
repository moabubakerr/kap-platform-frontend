// Data area mocks (README §8.7): collections, connectors, ingest packages,
// pipelines and their runs. Copy and numbers follow design-ref/app.js
// (`collTabs`, `files`, `pipeKpi`, `pipes`, `runs`, generic `connectors`,
// `packages`, `ingest`).

export type PillStatus = 'approved' | 'hold' | 'rejected';
export type StepState = 'ok' | 'warn' | 'bad';
/** o = ok, w = warning, f = failed, - = not reached */
export type SegState = 'o' | 'w' | 'f' | '-';

export interface Collection {
  id: string; // slug used in routes
  uuid: string;
  name: string;
  description: string;
  status: 'healthy';
  project: string;
  created: string;
  lastIngestion: string;
  lastRun: { id: number; duration: string };
  observations: number;
  indicators: number;
  chunks: number;
  docxFiles: number;
  embedding: { provider: string; model: string };
  agents: string[];
}

export const COLLECTIONS: Collection[] = [
  {
    id: 'sceai_indicators',
    uuid: 'c7e19a02-5b3d-4f1e-8a6c-2d9f0b4e7a13',
    name: 'sceai_indicators',
    description: 'SCEAI economic indicators (3 CSV exports) and planning documents (DOCX), indexed for agents.',
    status: 'healthy',
    project: 'SCEAI',
    created: '142 d ago',
    lastIngestion: '6 h ago',
    lastRun: { id: 412, duration: '2 m 41 s' },
    observations: 8104,
    indicators: 186,
    chunks: 418,
    docxFiles: 12,
    embedding: { provider: 'embed_default', model: 'qwen3-embedding · 1024-d' },
    agents: ['sceai_indicators_agent', 'sceai_indicators_oxford'],
  },
];

export const collectionById = (id: string | undefined) => COLLECTIONS.find((c) => c.id === id || c.uuid === id);

export interface SourceFile {
  name: string;
  type: 'CSV' | 'DOCX';
  current: string;
  versions: number;
  content: string;
  updated: string;
  status: PillStatus;
  statusLabel: string;
  /** Run that last touched the file. */
  run: number;
}

export const FILES: SourceFile[] = (
  [
    ['sceai_indicators_quarterly.csv', 'CSV', 'v14', 14, '2,316 rows', '6 h ago', 'approved', 'Ingested', 412],
    ['sceai_indicators_monthly.csv', 'CSV', 'v31', 31, '4,920 rows', '6 h ago', 'approved', 'Ingested', 412],
    ['sceai_indicators_annual.csv', 'CSV', 'v6', 6, '868 rows', '6 h ago', 'approved', 'Ingested', 412],
    ['NDS2_Economic_Diversification.docx', 'DOCX', 'v2', 2, '96 chunks', '1 d ago', 'approved', 'Ingested', 87],
    ['SCEAI_Annual_Review_2024.docx', 'DOCX', 'v3', 3, '142 chunks', '1 d ago', 'approved', 'Ingested', 87],
    ['SCEAI_Annual_Review_draft.docx', 'DOCX', 'v1', 1, '—', '1 d ago', 'rejected', 'Parse failed', 87],
  ] as [string, 'CSV' | 'DOCX', string, number, string, string, PillStatus, string, number][]
).map(([name, type, current, versions, content, updated, status, statusLabel, run]) => ({ name, type, current, versions, content, updated, status, statusLabel, run }));

export interface Connector {
  name: string;
  type: string;
  location: string;
  credentials: string;
  lastSync: string;
  status: PillStatus;
  statusLabel: string;
  pipeline: string;
}

export const CONNECTORS: Connector[] = [
  { name: 'sceai_bucket', type: 'Bucket · CSV', location: 's3://sceai-indicators/exports/', credentials: 'AKIA••••••••7Q2F', lastSync: '6 h ago', status: 'approved', statusLabel: 'Healthy', pipeline: 'indicators_csv_ingest' },
  { name: 'sceai_docs', type: 'Bucket · DOCX', location: 's3://sceai-indicators/docs/', credentials: 'AKIA••••••••7Q2F', lastSync: '1 d ago', status: 'approved', statusLabel: 'Healthy', pipeline: 'docs_docx_ingest' },
];

export interface IngestPackage {
  name: string;
  files: string;
  collection: string;
  submittedBy: string;
  submitted: string;
  status: PillStatus;
  statusLabel: string;
  run?: number;
}

export const PACKAGES: IngestPackage[] = [
  { name: 'pkg_2024Q4_indicators', files: '3 CSV', collection: 'sceai_indicators', submittedBy: 'sceai_admin', submitted: '6 h ago', status: 'approved', statusLabel: 'Ingested', run: 412 },
  { name: 'pkg_docs_annual_review', files: '4 DOCX', collection: 'sceai_indicators', submittedBy: 'sceai_admin', submitted: '1 d ago', status: 'hold', statusLabel: 'Partial', run: 87 },
  { name: 'pkg_2024Q3_indicators', files: '3 CSV', collection: 'sceai_indicators', submittedBy: 'sceai_admin', submitted: '92 d ago', status: 'approved', statusLabel: 'Ingested' },
];

export interface PipelineStep {
  name: string;
  detail: string;
  metric: string;
  state: StepState;
}

export interface Pipeline {
  name: string;
  description: string;
  status: PillStatus;
  statusLabel: string;
  iconBg: string;
  iconFg: string;
  connector: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  output: string;
  warning: string;
  /** Last 12 runs, oldest first: o ok, f failed, p partial. */
  history: string;
  steps: PipelineStep[];
}

const steps = (rows: [string, string, string, StepState][]) => rows.map(([name, detail, metric, state]) => ({ name, detail, metric, state }));

export const PIPELINES: Pipeline[] = [
  {
    name: 'indicators_csv_ingest',
    description: 'sceai_bucket → sceai_indicators · 3 CSV exports',
    status: 'approved',
    statusLabel: 'Succeeded',
    iconBg: '#F6E8EC',
    iconFg: '#8A1538',
    connector: 'sceai_bucket',
    schedule: 'Daily · 02:00 AST',
    lastRun: '6 h ago · 2 m 41 s',
    nextRun: 'Tomorrow, 02:00',
    output: '8,104 rows · 0 errors',
    warning: '',
    history: 'ooooofoooooo',
    steps: steps([
      ['Read', 'sceai_bucket · 3 files', '2.1 MB', 'ok'],
      ['Parse', 'CSV → rows', '8,104 rows', 'ok'],
      ['Validate', 'Schema, units, periods', '0 rejected', 'ok'],
      ['Upsert', 'Indicators DB', '8,104 written', 'ok'],
      ['Publish', 'sceai_indicators', 'v14 live', 'ok'],
    ]),
  },
  {
    name: 'docs_docx_ingest',
    description: 'sceai_docs → sceai_indicators · Word documents',
    status: 'hold',
    statusLabel: 'Partial',
    iconBg: 'var(--sand-tint)',
    iconFg: 'var(--sand-ink)',
    connector: 'sceai_docs',
    schedule: 'On upload',
    lastRun: '1 d ago · 4 m 02 s',
    nextRun: 'When a file is uploaded',
    output: '418 chunks · 1 file skipped',
    warning: 'SCEAI_Annual_Review_draft.docx could not be parsed. Re-upload a clean copy to include it.',
    history: 'oooopoooopoo',
    steps: steps([
      ['Read', 'sceai_docs · 4 files', '6.8 MB', 'ok'],
      ['Extract', 'DOCX → text', '3 of 4 files', 'warn'],
      ['Chunk', '~800 tokens', '418 chunks', 'ok'],
      ['Embed', 'embed_default · 1024-d', '418 vectors', 'ok'],
      ['Publish', 'sceai_indicators', 'v3 live', 'ok'],
    ]),
  },
];

export const pipelineByName = (n: string | undefined) => PIPELINES.find((p) => p.name === n);

export const PIPELINE_KPIS: { k: string; v: string; d: string }[] = [
  { k: 'Pipelines', v: '2', d: '1 scheduled · 1 on upload' },
  { k: 'Runs · 7 d', v: '9', d: '7 succeeded' },
  { k: 'Rows ingested · 7 d', v: '32,310', d: '+ 814 doc chunks' },
  { k: 'Success rate', v: '88.9%', d: '1 failed · 1 partial' },
  { k: 'kap.pipeline', v: '0 / 2', d: 'In flight · idle' },
];

export interface PipelineRun {
  id: number;
  label: string;
  pipeline: string;
  status: PillStatus;
  statusLabel: string;
  rows: string;
  errors: number;
  duration: string;
  durationPct: number;
  triggeredBy: string;
  started: string;
  /** Rough age in days, for the "Last 7 d" filter. */
  ageDays: number;
  segs: SegState[];
  reason: string;
  skipped?: string[];
}

export const RUNS: PipelineRun[] = (
  [
    [412, 'indicators_csv_ingest', 'approved', 'Succeeded', '8,104', 0, '2 m 41 s', 67, 'Schedule', '6 h ago', 0.25, 'ooooo', ''],
    [87, 'docs_docx_ingest', 'hold', 'Partial', '418 chunks', 1, '4 m 02 s', 100, 'sceai_admin · upload', '1 d ago', 1, 'owooo', ''],
    [411, 'indicators_csv_ingest', 'approved', 'Succeeded', '8,051', 0, '2 m 38 s', 65, 'Schedule', '1 d ago', 1, 'ooooo', ''],
    [410, 'indicators_csv_ingest', 'rejected', 'Failed', '0', 1, '12 s', 5, 'Schedule', '2 d ago', 2, 'oof--', 'Validate: unit "%" missing in 14 rows'],
    [409, 'indicators_csv_ingest', 'approved', 'Succeeded', '8,051', 0, '2 m 35 s', 64, 'm.alkuwari · manual', '3 d ago', 3, 'ooooo', ''],
    [86, 'docs_docx_ingest', 'approved', 'Succeeded', '396 chunks', 0, '3 m 47 s', 94, 'sceai_admin · upload', '8 d ago', 8, 'ooooo', ''],
  ] as [number, string, PillStatus, string, string, number, string, number, string, string, number, string, string][]
).map(([id, pipeline, status, statusLabel, rows, errors, duration, durationPct, triggeredBy, started, ageDays, segs, reason]) => ({
  id,
  label: `run ${id}`,
  pipeline,
  status,
  statusLabel,
  rows,
  errors,
  duration,
  durationPct,
  triggeredBy,
  started,
  ageDays,
  segs: segs.split('') as SegState[],
  reason,
  skipped: id === 87 ? ['SCEAI_Annual_Review_draft.docx'] : undefined,
}));

export const runById = (id: string | number | undefined) => RUNS.find((r) => String(r.id) === String(id));

/** Access to the collection (design grants: groups × roles). */
export const COLLECTION_ACCESS: { group: string; members: string; role: 'administrator' | 'analyst' | 'viewer'; via: string }[] = [
  { group: 'tenant_admins', members: '1 member', role: 'administrator', via: 'All SCEAI resources' },
  { group: 'catalog_readers', members: '2 members', role: 'viewer', via: 'sceai_indicators' },
  { group: 'ai_team', members: '3 members · platform', role: 'administrator', via: 'Platform' },
];
