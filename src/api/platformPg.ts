/**
 * PostgreSQL data sources through the platform API (our layer on top of KAP):
 * `/api/platform/t/{tenantId}/pg-sources|pg-datasets|pg-exports` → platform
 * `/api/t/{tid}/…`. The dev server / nginx adds the API key.
 *
 * The platform reads the customer database (read-only), writes KAP's indicator
 * CSVs, uploads them to S3 and provisions a KAP S3 connector, pipeline and
 * indicator collection for each dataset; KAP's scan then loads them.
 *
 * Errors keep the platform's `{type, message, data}` shape (`PgApiError`). A 404
 * without that shape means the route itself is missing: the platform API on the
 * stand does not have the feature yet (`routeMissing`).
 */

// ------------------------------------------------------------------ wire types
export type PgSslMode = 'disable' | 'prefer' | 'require' | 'verify-full';

export interface PgSource {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  sslmode: PgSslMode | string;
  password_set: boolean;
  last_test: { ok: boolean; message: string; at: string } | null;
  created_at: string;
  updated_at: string;
}

export interface PgSourceCreate {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslmode: string;
}
export type PgSourcePatch = Partial<PgSourceCreate>;

export interface PgTable {
  schema: string;
  name: string;
  rows_estimate: number | null;
}
export interface PgTestResult {
  ok: boolean;
  message: string;
  server_version: string | null;
  tables: PgTable[];
}

export interface PgSqlPreview {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}

export type PgPreset = 'scai_indicators' | 'mapped' | 'custom';
export type PgFile = 'registry' | 'observations' | 'narratives';
export interface PgQueries {
  registry: string;
  observations: string;
  narratives?: string;
}

/** A column of a table (`GET pg-sources/{id}/columns?table=`). `type`: PostgreSQL's type name. */
export interface PgColumn {
  name: string;
  type: string;
  nullable: boolean;
}
export interface PgColumns {
  table: string;
  columns: PgColumn[];
}

export type PgFreq = 'A' | 'Q' | 'M';
/** A fixed text for every row, or a column of the table. */
export type PgValueOrColumn = { value: string } | { column: string };
export type PgFilterOp = '=' | '!=' | 'is_true' | 'is_false' | 'is_not_null';
export interface PgMappingFilter {
  column: string;
  op: PgFilterOp;
  value?: string;
}

/**
 * Preset `mapped`: the platform writes the SQL from a column mapping of one table.
 * KAP ids: `<id_prefix>.<series key slug>.<a|q|m>.<overall|dimension slug>`.
 */
export interface PgMapping {
  /** `schema.name` */
  table: string;
  /** ≥1 column; their distinct values identify a series */
  series_key: string[];
  /** `[a-z0-9_]{1,24}` */
  id_prefix: string;
  /** `text`: values already look like YYYY, YYYY-Qn or YYYY-MM */
  period: { column: string; kind: 'date' | 'text' };
  frequency: { value: PgFreq } | { column: string; map: Record<string, PgFreq> };
  value: string;
  target?: string | null;
  name_en?: string | null;
  name_ar?: string | null;
  unit?: PgValueOrColumn | null;
  source?: PgValueOrColumn | null;
  definition?: string | null;
  dimension?: string | null;
  /** values of the dimension column that mean the main (overall) series */
  domestic_values?: string[] | null;
  filters?: PgMappingFilter[] | null;
}

export interface PgDataset {
  id: string;
  source_id: string;
  source_name: string;
  name: string;
  preset: PgPreset;
  queries: PgQueries | null;
  /** preset `mapped` only (null otherwise; older platforms leave it out) */
  mapping?: PgMapping | null;
  published_only: boolean;
  collection_name: string;
  schedule_minutes: number | null;
  next_run_at: string | null;
  kap: { connector: string; pipeline: string; collection: string; collection_id: string | null; pipeline_id: string | null; provisioned_at: string | null } | null;
  last_run: { id: string; status: ExportStatus; finished_at: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface PgDatasetCreate {
  source_id: string;
  name: string;
  preset: PgPreset;
  queries?: PgQueries;
  mapping?: PgMapping;
  published_only?: boolean;
  collection_name: string;
  schedule_minutes?: number | null;
}
export type PgDatasetPatch = Partial<Omit<PgDatasetCreate, 'source_id'>>;

export interface PgFilePreview {
  columns: string[];
  rows: unknown[][];
  count: number;
}
export interface PgDatasetPreview {
  files: Partial<Record<PgFile, PgFilePreview>>;
  problems: string[];
  /** the SQL the platform generated (mapped datasets) */
  queries?: PgQueries;
}
/** `POST pg-sources/{id}/mapping-preview`: a mapping tried before it is saved. */
export interface PgMappingPreview extends PgDatasetPreview {
  queries: PgQueries;
}

export type ExportStatus = 'queued' | 'running' | 'waiting_for_kap' | 'succeeded' | 'failed';
export type ExportStepKey = 'read' | 'write' | 'upload' | 'kap_scan' | 'kap_load';
export type ExportStepState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface ExportStep {
  key: ExportStepKey | string;
  title: string;
  state: ExportStepState;
  detail: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface ExportRun {
  id: string;
  dataset_id: string;
  dataset_name: string;
  trigger: 'manual' | 'schedule';
  status: ExportStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  steps: ExportStep[];
  counts: { registry: number | null; observations: number | null; narratives: number | null } | null;
  files: { name: string; key: string; bytes: number | null }[];
  kap: { collection: string | null; pipeline_job_id: string | null; state: string | null; progress: unknown; result: unknown } | null;
  error: string | null;
}

export interface PgPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_next: boolean;
}

// ------------------------------------------------------------------ errors
export const PG_FEATURE_MISSING = 'The platform API on the test stand does not have the PostgreSQL feature yet — update platform-api.';

export class PgApiError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    message: string,
    readonly data: unknown = {},
    /** the route does not exist on the platform (feature not deployed) */
    readonly routeMissing = false,
  ) {
    super(message);
  }
}

/** FastAPI `detail`: a string, or validation errors `[{loc, msg}]`. */
function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length)
    return detail
      .slice(0, 3)
      .map((e: any) => [Array.isArray(e?.loc) ? e.loc.filter((x: unknown) => x !== 'body').join('.') : '', e?.msg ?? e?.message].filter(Boolean).join(': '))
      .join('; ');
  return undefined;
}

function platformMessage(json: any): string | undefined {
  const errs = json?.data?.errors;
  const base = json?.message;
  if (base && Array.isArray(errs) && errs.length) return `${base} (${errs.slice(0, 3).map((e: any) => [Array.isArray(e.loc) ? e.loc.filter((x: unknown) => x !== 'body').join('.') : e.field, e.msg ?? e.message].filter(Boolean).join(': ')).join('; ')})`;
  return base ?? detailMessage(json?.detail);
}

// ------------------------------------------------------------------ transport
type Query = Record<string, string | number | boolean | null | undefined>;

function qs(q?: Query): string {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v != null && v !== '') p.append(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const pgUrl = (tenantId: string, path: string, q?: Query) => `/api/platform/t/${tenantId}/${path.replace(/^\/+/, '')}${qs(q)}`;

/** One platform call. Resolves to the JSON body (undefined for 204). */
export async function pgCall<T = unknown>(tenantId: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, q?: Query): Promise<T> {
  let r: Response;
  try {
    r = await fetch(pgUrl(tenantId, path, q), {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new PgApiError(0, 'network', `The platform API is not reachable (${e instanceof Error ? e.message : String(e)}).`);
  }
  const text = await r.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!r.ok) {
    // a platform error has {type, message}; FastAPI's own 404 for an unknown route is {"detail": "Not Found"}
    const routeMissing = r.status === 404 && typeof json?.type !== 'string' && (json === undefined || json?.detail === 'Not Found');
    const msg = routeMissing
      ? PG_FEATURE_MISSING
      : (platformMessage(json) ?? (r.status === 502 || r.status === 504 ? 'The platform API is not reachable.' : text.slice(0, 200) || r.statusText || `Platform API error ${r.status}`));
    throw new PgApiError(r.status, json?.type ?? 'error', msg, json?.data, routeMissing);
  }
  return json as T;
}

// ------------------------------------------------------------------ sources
export const listPgSources = (tid: string, q: { limit?: number; offset?: number } = {}) => pgCall<PgPage<PgSource>>(tid, 'GET', 'pg-sources', undefined, { limit: 200, ...q });
export const getPgSource = (tid: string, id: string) => pgCall<PgSource>(tid, 'GET', `pg-sources/${id}`);
export const createPgSource = (tid: string, body: PgSourceCreate) => pgCall<PgSource>(tid, 'POST', 'pg-sources', body);
export const patchPgSource = (tid: string, id: string, body: PgSourcePatch) => pgCall<PgSource>(tid, 'PATCH', `pg-sources/${id}`, body);
/** 409 when datasets use the source. */
export const deletePgSource = (tid: string, id: string) => pgCall<void>(tid, 'DELETE', `pg-sources/${id}`);
export const testPgSource = (tid: string, id: string) => pgCall<PgTestResult>(tid, 'POST', `pg-sources/${id}/test`);
export const previewPgSql = (tid: string, id: string, sql: string, limit = 20) => pgCall<PgSqlPreview>(tid, 'POST', `pg-sources/${id}/preview`, { sql, limit });
/** Columns of `schema.name`; 404 `not_found` when the table is unknown. */
export const getPgColumns = (tid: string, id: string, table: string) => pgCall<PgColumns>(tid, 'GET', `pg-sources/${id}/columns`, undefined, { table });
/** The three files and the generated SQL of a column mapping, before it is saved. */
export const previewPgMapping = (tid: string, id: string, mapping: PgMapping, limit?: number) =>
  pgCall<PgMappingPreview>(tid, 'POST', `pg-sources/${id}/mapping-preview`, limit != null ? { mapping, limit } : { mapping });

// ------------------------------------------------------------------ datasets
export const listPgDatasets = (tid: string, q: { source_id?: string; limit?: number; offset?: number } = {}) => pgCall<PgPage<PgDataset>>(tid, 'GET', 'pg-datasets', undefined, { limit: 200, ...q });
export const getPgDataset = (tid: string, id: string) => pgCall<PgDataset>(tid, 'GET', `pg-datasets/${id}`);
export const createPgDataset = (tid: string, body: PgDatasetCreate) => pgCall<PgDataset>(tid, 'POST', 'pg-datasets', body);
export const patchPgDataset = (tid: string, id: string, body: PgDatasetPatch) => pgCall<PgDataset>(tid, 'PATCH', `pg-datasets/${id}`, body);
export const deletePgDataset = (tid: string, id: string) => pgCall<void>(tid, 'DELETE', `pg-datasets/${id}`);
export const previewPgDataset = (tid: string, id: string) => pgCall<PgDatasetPreview>(tid, 'POST', `pg-datasets/${id}/preview`);
export const runPgDataset = (tid: string, id: string) => pgCall<ExportRun>(tid, 'POST', `pg-datasets/${id}/run`);

// ------------------------------------------------------------------ export runs
export const listPgExports = (tid: string, q: { dataset_id?: string; limit?: number; offset?: number } = {}) => pgCall<PgPage<ExportRun>>(tid, 'GET', 'pg-exports', undefined, { limit: 100, ...q });
export const getPgExport = (tid: string, id: string) => pgCall<ExportRun>(tid, 'GET', `pg-exports/${id}`);
