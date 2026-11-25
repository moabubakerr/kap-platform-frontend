/**
 * Business Data Hub ↔ KAP. Pure mapping of KAP records (collections, files,
 * indicator observations, entity types, pipelines, connectors, agents) onto the
 * hub's types (`businessData.ts`), and the KAP bodies for its writes.
 *
 * What KAP has no field for gets an honest default: '' / '—' / empty lists,
 * never an invented number. Session-only parts of the live tenant (document
 * classification, relationship types between live entity types) are kept from
 * the previous slice.
 */
import type { DhCollection, DhDataset, DhDocument, DhField, IngestPipelineRef, IngestRef, OntoAttr, OntoType, TenantData } from '@/v35/data/businessData';

// ------------------------------------------------------------------ KAP records (OpenAPI schemas)
export type KapSyncStrategy = 'overwrite' | 'unique_name';
export interface KapEntitySpec {
  enabled: boolean;
  entity_type_ref?: string | null;
  summary?: unknown;
  boundary?: unknown;
  identity?: unknown;
  metadata?: unknown;
}
/** CollectionOut */
export interface KapCollection {
  id: string;
  name: string;
  pipeline_ref: string;
  connectors: string[];
  sync_strategy: KapSyncStrategy;
  entity: KapEntitySpec;
  task_priority: number | null;
  max_in_flight_tasks: number | null;
  created_at: string;
  updated_at: string;
}
/** PipelineOut (the parts the hub reads) */
export interface KapPipeline {
  id: string;
  name: string;
  kind: 'document' | 'indicators';
  mode?: string | null;
  embedding_model_ref?: string | null;
  stages?: { name?: string; type?: string }[];
  is_active?: boolean;
}
/** ConnectorOut (the parts the hub reads) */
export interface KapConnector {
  id: string;
  name: string;
  type: string;
  is_active?: boolean;
}
/** AgentOut (the parts the hub reads) */
export interface KapAgent {
  id: string;
  name: string;
  type?: string;
  collections: string[];
}
/** FileVersionOut */
export interface KapFileVersion {
  id: string;
  version_number: number;
  content_sha256: string;
  hash_algorithm?: string;
  size_bytes: number | null;
  etag?: string | null;
  mtime?: string | null;
  is_current: boolean;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}
export type KapIngestState =
  | 'pending' | 'syncing' | 'synced' | 'failed_sync' | 'parsing' | 'parsed' | 'failed_parse' | 'transforming' | 'transformed' | 'failed_transform'
  | 'embedding' | 'embedded' | 'failed_embed' | 'loading' | 'loaded' | 'failed_load' | 'validating' | 'validated' | 'failed_validate'
  | 'activating' | 'activated' | 'failed_activate';
/** FileListItem / FileDetail */
export interface KapFile {
  id: string;
  collection_id: string;
  connector_id: string;
  name: string;
  source_path: string;
  state: KapIngestState | string;
  file_type: string;
  size_bytes: number | null;
  current_version_number: number | null;
  version_count: number;
  content_changed_at: string | null;
  processing_started_at: string | null;
  created_at: string;
  updated_at: string;
  /** FileDetail only */
  current_version?: KapFileVersion | null;
}
/** IndicatorObservationOut */
export interface KapObservation {
  id: string;
  indicator: { external_id: string; name_en: string; name_ar: string | null; unit: string | null; frequency: 'M' | 'Q' | 'A' | string; source: string | null };
  period_type: 'month' | 'quarter' | 'year' | string;
  period_start: string;
  dimension: string;
  value: string | null;
  status: 'valid' | 'needs_review' | string;
  issues: string[];
  source_file: string | null;
  source_row: number | null;
  updated_at: string;
}
/** EntityTypeOut */
export interface KapEntityType {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------ what the console has read from KAP (per live tenant)
export interface KapCache {
  /** the first full load has finished */
  loaded: boolean;
  collections: KapCollection[];
  /** null: KAP refused the list (permission) — kinds then fall back to the pipeline name */
  pipelines: KapPipeline[] | null;
  connectors: KapConnector[] | null;
  agents: KapAgent[] | null;
  entityTypes: KapEntityType[];
  /** files per collection id (KAP's `total`) */
  fileTotal: Record<string, number>;
  /** files per collection id that failed or are still being processed (KAP `state__in` counts) */
  fileStates: Record<string, { failed: number; busy: number }>;
  /** observations per collection id: all and needs_review */
  obsTotal: Record<string, { total: number; review: number }>;
  /** every file read so far, by file id */
  files: Record<string, KapFile>;
  /** versions per file id */
  versions: Record<string, KapFileVersion[]>;
  /** pages of files read for a collection's Data Scope: collection id → `offset:size` → file ids */
  filePages: Record<string, Record<string, string[]>>;
  /** pages of observations read for a dataset: collection id → `status:offset:size` → page */
  obs: Record<string, Record<string, { items: KapObservation[]; total: number }>>;
  /** collections whose file list was cut at the per-collection maximum (Unstructured Data) */
  truncated: string[];
}

export const emptyCache = (): KapCache => ({ loaded: false, collections: [], pipelines: null, connectors: null, agents: null, entityTypes: [], fileTotal: {}, fileStates: {}, obsTotal: {}, files: {}, versions: {}, filePages: {}, obs: {}, truncated: [] });
export const obsKey = (status: string, offset: number, size = PAGE) => `${status}:${offset}:${size}`;
export const pageKey = (offset: number, size = PAGE) => `${offset}:${size}`;

/** Non-final, non-failed ingest states of a document file (still being processed). */
export const BUSY_STATES: KapIngestState[] = ['pending', 'syncing', 'synced', 'parsing', 'parsed', 'transforming', 'transformed', 'embedding', 'embedded', 'loading', 'loaded', 'validating', 'validated', 'activating'];
export const FAILED_STATES: KapIngestState[] = ['failed_sync', 'failed_parse', 'failed_transform', 'failed_embed', 'failed_load', 'failed_validate', 'failed_activate'];

/** files read per document collection for Unstructured Data (newest first) */
export const MAX_DOCS = 500;
/** default page size of the lazy lists (files, observations) */
export const PAGE = 25;

// ------------------------------------------------------------------ small helpers
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

/** "5 min ago", "3 h ago", "2 d ago" — the prototype's relative times, from a KAP timestamp. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function bytes(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** Collection kind from its pipeline (`indicators` → structured observations, `document` → files). */
export function kindOf(c: KapCollection, pipelines: KapPipeline[] | null): 'indicators' | 'document' {
  const p = pipelines?.find((x) => x.name === c.pipeline_ref);
  if (p) return p.kind === 'indicators' ? 'indicators' : 'document';
  // pipelines not readable: fall back to the pipeline's name
  return /indicator/i.test(c.pipeline_ref) ? 'indicators' : 'document';
}

/** Structured dataset id of an indicator collection. */
export const datasetIdOf = (collection: string) => `${collection}_observations`;
export const collectionOfDataset = (cache: KapCache, datasetId: string) => cache.collections.find((c) => datasetIdOf(c.name) === datasetId) ?? null;

/** Document ids (`collection:file name`) of every file read so far; a duplicate name gets the file id's start. */
export function docIds(cache: KapCache): Map<string, KapFile> {
  const out = new Map<string, KapFile>();
  const files = Object.values(cache.files).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const f of files) {
    const c = cache.collections.find((x) => x.id === f.collection_id);
    if (!c) continue;
    let id = `${c.name}:${f.name}`;
    if (out.has(id)) id = `${id} #${f.id.slice(0, 8)}`;
    out.set(id, f);
  }
  return out;
}
export const docIdOf = (cache: KapCache, fileId: string): string | null => {
  for (const [id, f] of docIds(cache)) if (f.id === fileId) return id;
  return null;
};
/** `collection:file name` → its parts (for a deep link before the file is loaded). */
export function parseDocId(id: string): { collection: string; name: string } | null {
  const i = id.indexOf(':');
  if (i <= 0) return null;
  return { collection: id.slice(0, i), name: id.slice(i + 1).replace(/ #[0-9a-f]{8}$/, '') };
}

// ------------------------------------------------------------------ files → documents
const FAILED = (s: string) => s.startsWith('failed_');
/** Final state of a file. Documents end at `embedded` (KAP guide: "embedded indicates successful document
 * processing"; verified on the stand); indicator packages at `loaded`/`validated`; `activated` is final for both. */
const DONE = (s: string, kind: 'indicators' | 'document') => s === 'activated' || (kind === 'document' ? s === 'embedded' : s === 'loaded' || s === 'validated');

/** Processing status (Pending · Processing · Completed · Failed) of a KAP ingest state. */
export function procStatus(state: string, kind: 'indicators' | 'document' = 'document'): string {
  if (FAILED(state)) return 'Failed';
  if (state === 'pending') return 'Pending';
  return DONE(state, kind) ? 'Completed' : 'Processing';
}

/** Readable KAP ingest state: `failed_parse` → "Failed parse". */
export const stateLabel = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—');

export function toDocument(f: KapFile, id: string, c: KapCollection, kind: 'indicators' | 'document', versions: KapFileVersion[] | undefined, connectorName: string, prev?: DhDocument): DhDocument {
  const pst = procStatus(f.state, kind);
  const vs = (versions ?? []).slice().sort((a, b) => b.version_number - a.version_number);
  const vers: DhDocument['vers'] = vs.length
    ? vs.map((v) => [`v${v.version_number}`, day(v.created_at), [v.is_current ? 'Current' : '', v.processed_at ? `processed ${day(v.processed_at)}` : 'not processed'].filter(Boolean).join(' · ')])
    : f.current_version_number != null
      ? [[`v${f.current_version_number}`, day(f.content_changed_at ?? f.updated_at), f.version_count > 1 ? `${f.version_count} versions` : '']]
      : [['—', '—', 'No version stored yet']];
  return {
    id,
    ty: (f.file_type || f.name.split('.').pop() || '—').toUpperCase(),
    title: f.name,
    lang: '—',
    pages: 0,
    vers,
    ex: FAILED(f.state) ? 'Failed' : 'Done',
    chunks: 0,
    idx: FAILED(f.state) ? 'Not indexed' : pst === 'Completed' ? 'Indexed' : pst,
    text: '',
    err: FAILED(f.state) ? `KAP state: ${f.state}` : '',
    src: { conn: connectorName, pipe: c.pipeline_ref },
    coll: c.name,
    // classification is the console's own attribute (session only); KAP has none
    cls: prev?.cls ?? '',
    entSt: '—',
    entN: 0,
    at: day(f.content_changed_at ?? f.created_at),
    pst,
  };
}

// ------------------------------------------------------------------ observations → dataset
const F = (n: string, ty: string, d: string, k = ''): DhField => ({ n, ty, d, k });
export const OBS_FIELDS: DhField[] = [
  F('indicator', 'string', 'Indicator external ID', 'Key'),
  F('name', 'string', 'Indicator name (English)', ''),
  F('period', 'period', 'Period (month, quarter or year)', 'Key'),
  F('dimension', 'string', 'Dimension of the observation', 'Key'),
  F('value', 'decimal', 'Observed value', 'Unit from the indicator'),
  F('status', 'enum', 'valid · needs_review', ''),
  F('issues', 'list', 'Why the observation was flagged', ''),
  F('source', 'string', 'Package file and row', ''),
  F('updated_at', 'timestamp', 'Last change', ''),
];

/** "2026-Q2", "2026-04", "2026" from a period type and start date. */
export function periodLabel(type: string, start: string): string {
  const [y, m] = start.split('-');
  if (type === 'year') return y;
  if (type === 'quarter') return `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`;
  if (type === 'month') return `${y}-${m}`;
  return start;
}

export const obsValue = (o: KapObservation) => (o.value == null ? '—' : `${o.value}${o.indicator.unit ? ` ${o.indicator.unit}` : ''}`);
export const obsSource = (o: KapObservation) => (o.source_file ? `${o.source_file}${o.source_row != null ? ` · row ${o.source_row}` : ''}` : '—');
export const obsStatus = (s: string) => (s === 'valid' ? 'Valid' : s === 'needs_review' ? 'Needs review' : stateLabel(s));

export function obsPreviewRow(o: KapObservation, now = Date.now()): string[] {
  return [o.indicator.external_id, o.indicator.name_en, periodLabel(o.period_type, o.period_start), o.dimension || '—', obsValue(o), o.status, o.issues.join('; ') || '—', obsSource(o), ago(o.updated_at, now)];
}

export function toDataset(c: KapCollection, cache: KapCache, now = Date.now()): DhDataset {
  const cnt = cache.obsTotal[c.id];
  const files = Object.values(cache.files).filter((f) => f.collection_id === c.id).sort((a, b) => (b.content_changed_at ?? '').localeCompare(a.content_changed_at ?? ''));
  const conn = connectorNames(c, cache);
  const latest = files[0]?.content_changed_at ?? c.updated_at;
  return {
    id: datasetIdOf(c.name),
    kind: 'Time series',
    desc: `Indicator observations of collection ${c.name}.`,
    rows: cnt?.total ?? 0,
    fields: OBS_FIELDS,
    preview: (cache.obs[c.id]?.[obsKey('', 0)]?.items ?? []).map((o) => obsPreviewRow(o, now)),
    src: { conn, pipe: c.pipeline_ref },
    st: !cnt ? 'Not counted' : cnt.review ? `${cnt.review} to review` : cnt.total ? 'Ingested' : 'Empty',
    upd: ago(latest, now),
    // rows per package file: KAP does not report them
    files: files.map((f) => [f.name, f.current_version_number != null ? `v${f.current_version_number}` : '—', '—', ago(f.content_changed_at ?? f.updated_at, now)]),
  };
}

// ------------------------------------------------------------------ entity types ↔ ontology
const DT_OF = (p: any): string => {
  if (!p || typeof p !== 'object') return 'Text';
  if (Array.isArray(p.enum)) return 'Category';
  const t = Array.isArray(p.type) ? p.type.find((x: string) => x !== 'null') : p.type;
  if (t === 'number' || t === 'integer') return 'Number';
  if (t === 'boolean') return 'Boolean';
  if (t === 'array') return 'List';
  if (t === 'object') return 'Object';
  if (t === 'string' && (p.format === 'date' || p.format === 'date-time')) return 'Date';
  return 'Text';
};

/** JSON Schema of one attribute for a console data type (Category and Reference are plain strings in KAP). */
export function jsonOfDt(ty: string, hint = ''): Record<string, unknown> {
  const base: Record<string, unknown> =
    ty === 'Number' ? { type: 'number' } : ty === 'Boolean' ? { type: 'boolean' } : ty === 'Date' ? { type: 'string', format: 'date' } : { type: 'string' };
  return hint ? { ...base, description: hint } : base;
}

export function attrsOfSchema(schema: Record<string, any> | null | undefined): OntoAttr[] {
  const props: Record<string, any> = schema && typeof schema.properties === 'object' && schema.properties ? schema.properties : {};
  const req: string[] = Array.isArray(schema?.required) ? schema!.required : [];
  // KAP has no identifier attribute on an entity type (identity is set per collection)
  return Object.entries(props).map(([n, p]) => ({ n, ty: DT_OF(p), id: false, req: req.includes(n), hint: typeof p?.description === 'string' ? p.description : '' }));
}

export function toOntoType(e: KapEntityType): OntoType {
  // KAP has no extraction guidance and no count of extracted entities
  return { n: e.name, d: e.description ?? '', attrs: attrsOfSchema(e.schema), guide: '', cnt: 0 };
}

// ------------------------------------------------------------------ the live tenant's slice
const connectorNames = (c: KapCollection, _cache: KapCache) => c.connectors.join(', ');
const connectorOf = (f: KapFile, cache: KapCache) => cache.connectors?.find((x) => x.id === f.connector_id)?.name ?? '';

function toCollection(c: KapCollection, kind: 'indicators' | 'document', docs: string[], cache: KapCache): DhCollection {
  const total = cache.fileTotal[c.id];
  return {
    id: c.name,
    purpose: 'Data scope',
    desc: `${kind === 'indicators' ? 'Indicator metrics' : 'Documents'} · pipeline ${c.pipeline_ref}${c.connectors.length ? ` · ${c.connectors.join(', ')}` : ''}`,
    ds: kind === 'indicators' ? [datasetIdOf(c.name)] : [],
    docs,
    extraDocs: kind === 'document' && total != null ? Math.max(0, total - docs.length) : 0,
    sq: [],
    // retrieval settings, usage counts: KAP has no per-collection fields
    search: null,
    uses7: 0,
    last: '—',
    impl: true,
  };
}

/** The live tenant's Business Data from what has been read from KAP. `prev` keeps session-only parts. */
export function toTenantData(cache: KapCache, prev?: TenantData | null, now = Date.now()): TenantData {
  const ids = docIds(cache);
  const prevDoc = new Map((prev?.documents ?? []).map((d) => [d.id, d]));
  const kinds = new Map(cache.collections.map((c) => [c.id, kindOf(c, cache.pipelines)]));
  const documents: DhDocument[] = [];
  const docsOf: Record<string, string[]> = {};
  for (const [id, f] of ids) {
    const c = cache.collections.find((x) => x.id === f.collection_id)!;
    if (kinds.get(c.id) !== 'document') continue;
    documents.push(toDocument(f, id, c, 'document', cache.versions[f.id], connectorOf(f, cache), prevDoc.get(id)));
    (docsOf[c.id] ??= []).push(id);
  }
  const types = cache.entityTypes.map(toOntoType);
  const tn = new Set(types.map((t) => t.n));
  return {
    collections: cache.collections.map((c) => toCollection(c, kinds.get(c.id)!, docsOf[c.id] ?? [], cache)),
    datasets: cache.collections.filter((c) => kinds.get(c.id) === 'indicators').map((c) => toDataset(c, cache, now)),
    documents,
    // relationship types are session-only (KAP has none); keep those between live entity types
    onto: { types, rels: (prev?.onto.rels ?? []).filter((r) => tn.has(r.src) && tn.has(r.tgt)) },
    // KAP has no API for extracted entities
    inst: [],
  };
}

/** Collections each agent uses (`AgentOut.collections`, by name). */
export const agentCollections = (agents: KapAgent[] | null): Record<string, string[]> => Object.fromEntries((agents ?? []).map((a) => [a.name, a.collections ?? []]));

/** Provenance for the hub from KAP: connectors as data sources, KAP pipelines; runs are not read here. */
export function toIngestRef(cache: KapCache): IngestRef {
  const conns = cache.connectors ?? [...new Set(cache.collections.flatMap((c) => c.connectors))].map((n) => ({ id: n, name: n, type: '—' }));
  const pipes = cache.pipelines ?? [...new Set(cache.collections.map((c) => c.pipeline_ref))].map((n): KapPipeline => ({ id: n, name: n, kind: /indicator/i.test(n) ? 'indicators' : 'document' }));
  const pipelines: IngestPipelineRef[] = pipes.map((p) => {
    const cs = cache.collections.filter((c) => c.pipeline_ref === p.name);
    const ind = cs.find((c) => kindOf(c, cache.pipelines) === 'indicators');
    return {
      id: p.name,
      desc: `${p.kind === 'indicators' ? 'Indicator metrics' : 'Document'} pipeline${p.mode ? ` · ${p.mode}` : ''}${p.embedding_model_ref ? ` · embedding ${p.embedding_model_ref}` : ''}`,
      src: [...new Set(cs.flatMap((c) => c.connectors))].join(', ') || '—',
      dsName: ind ? datasetIdOf(ind.name) : undefined,
      uSteps: (p.stages ?? []).map((s) => s.name || s.type || '').filter(Boolean),
      entTypes: [...new Set(cs.filter((c) => c.entity?.enabled && c.entity.entity_type_ref).map((c) => c.entity.entity_type_ref!))],
    };
  });
  return { sources: conns.map((c) => ({ id: c.name, type: c.type, loc: '—' })), pipelines, runs: [] };
}

// ------------------------------------------------------------------ KAP bodies for writes
export interface CollectionForm {
  name?: string;
  pipeline?: string;
  connectors?: string[];
  sync?: string;
  /** entity type name or 'Off' */
  entity?: string;
}
export const ENTITY_OFF = 'Off';
export const SYNC_OPTS: KapSyncStrategy[] = ['unique_name', 'overwrite'];

/** Validation message for a collection form, '' when it is fine. */
export function checkCollection(v: CollectionForm, create: boolean, existing: string[]): string {
  if (create) {
    const n = String(v.name ?? '').trim();
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(n)) return 'Name: 4–32 letters, digits and underscores.';
    if (existing.includes(n)) return 'A collection with this name exists.';
  }
  if (!String(v.pipeline ?? '').trim()) return 'Select a pipeline.';
  if (!(v.connectors ?? []).length) return 'Select at least one connector.';
  return '';
}

/** POST /api/collections (CollectionCreate). */
export function toKapCollectionCreate(v: CollectionForm) {
  const ref = v.entity && v.entity !== ENTITY_OFF ? v.entity : null;
  return {
    name: String(v.name ?? '').trim(),
    pipeline_ref: String(v.pipeline ?? '').trim(),
    connectors: (v.connectors ?? []).slice(),
    sync_strategy: (SYNC_OPTS.includes(v.sync as KapSyncStrategy) ? v.sync : 'unique_name') as KapSyncStrategy,
    entity: ref ? { enabled: true, entity_type_ref: ref } : { enabled: false },
  };
}

/** PATCH /api/collections/{id} (CollectionUpdate): only what changed; null when nothing did. */
export function toKapCollectionPatch(c: KapCollection, v: CollectionForm): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  if (v.pipeline != null && v.pipeline !== c.pipeline_ref) out.pipeline_ref = v.pipeline;
  if (v.connectors && JSON.stringify([...v.connectors].sort()) !== JSON.stringify([...c.connectors].sort())) out.connectors = v.connectors.slice();
  if (v.sync && v.sync !== c.sync_strategy) out.sync_strategy = v.sync;
  if (v.entity != null) {
    const ref = v.entity !== ENTITY_OFF ? v.entity : null;
    const cur = c.entity?.enabled ? (c.entity.entity_type_ref ?? null) : null;
    // keep the collection's other entity rules (boundary, identity, summary, metadata)
    if (ref !== cur) out.entity = ref ? { ...c.entity, enabled: true, entity_type_ref: ref } : { ...c.entity, enabled: false };
  }
  return Object.keys(out).length ? out : null;
}

/** PATCH …/indicator-observations/{id} (IndicatorObservationUpdate): only what changed; null when nothing did. */
export function toKapObservationPatch(o: KapObservation, v: { value?: string; status?: string }): { value?: string | number | null; status?: string } | null {
  const out: { value?: string | number | null; status?: string } = {};
  const val = String(v.value ?? '').trim();
  if (val !== (o.value ?? '')) out.value = val === '' ? null : Number.isFinite(Number(val)) ? Number(val) : val;
  if (v.status && v.status !== o.status) out.status = v.status;
  return Object.keys(out).length ? out : null;
}

/** Validation message for an observation correction, '' when it is fine. */
export function checkObservation(v: { value?: string; status?: string }): string {
  const val = String(v.value ?? '').trim();
  if (val && !Number.isFinite(Number(val))) return 'The value must be a number.';
  if (v.status === 'valid' && !val) return 'An observation can only be valid with a value.';
  return '';
}

/** POST /api/entity-types (EntityTypeRequest). The first attribute is required. */
export function toKapEntityTypeCreate(v: { n?: string; d?: string; idn?: string; idt?: string }) {
  const a = String(v.idn ?? '').trim();
  return {
    name: String(v.n ?? '').trim(),
    description: String(v.d ?? '').trim(),
    schema: { type: 'object', properties: a ? { [a]: jsonOfDt(String(v.idt || 'Text')) } : {}, ...(a ? { required: [a] } : {}) },
  };
}

export function checkEntityTypeName(n: string, existing: string[]): string {
  if (!/^[a-zA-Z0-9_]{4,64}$/.test(n)) return 'Name: 4–64 letters, digits and underscores (no spaces).';
  if (existing.some((x) => x.toLowerCase() === n.toLowerCase())) return 'This entity type exists.';
  return '';
}

/** Entity type schema with one attribute added (PATCH replaces the schema as a whole). */
export function schemaWithAttr(schema: Record<string, any> | null | undefined, a: { n: string; ty: string; req: boolean; hint?: string }): Record<string, any> {
  const s = structuredClone(schema && typeof schema === 'object' ? schema : {});
  s.type ??= 'object';
  s.properties = { ...(s.properties ?? {}), [a.n]: jsonOfDt(a.ty, a.hint) };
  const req: string[] = Array.isArray(s.required) ? s.required.filter((x: string) => x !== a.n) : [];
  if (a.req) req.push(a.n);
  if (req.length) s.required = req;
  else delete s.required;
  return s;
}

/** Entity type schema without one attribute. */
export function schemaWithoutAttr(schema: Record<string, any> | null | undefined, n: string): Record<string, any> {
  const s = structuredClone(schema && typeof schema === 'object' ? schema : {});
  if (s.properties) delete s.properties[n];
  if (Array.isArray(s.required)) {
    s.required = s.required.filter((x: string) => x !== n);
    if (!s.required.length) delete s.required;
  }
  return s;
}

/** Collections that reference an entity type (KAP refuses to delete or rename it while they do). */
export const collectionsUsingType = (cache: KapCache, type: string) => cache.collections.filter((c) => c.entity?.entity_type_ref === type).map((c) => c.name);
