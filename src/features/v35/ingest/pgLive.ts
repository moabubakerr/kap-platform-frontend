/**
 * Live tenant: the platform's PostgreSQL sources, datasets and export runs
 * (`pgStore`), plus session-only results the platform does not keep: the
 * tables of the last connection test and dataset previews.
 */
import { createStore } from '@/engine/store';
import { getPgExport, listPgDatasets, listPgExports, listPgSources, PgApiError, type ExportRun, type PgDatasetPreview, type PgTestResult } from '@/api/platformPg';
import type { IngestTenantKey } from '@/v35/data/ingest';
import { isActiveExport, type PgState } from './pgView';

export const pgStore = createStore<Partial<Record<IngestTenantKey, PgState>>>(() => ({}));

/** Last connection test per platform source id (the tables are not stored by the platform). */
export const pgTestStore = createStore<Record<string, PgTestResult & { at: number }>>(() => ({}));

export interface PreviewState {
  loading: boolean;
  data?: PgDatasetPreview;
  error?: string;
  at: number;
}
/** Dataset preview per dataset id. */
export const pgPreviewStore = createStore<Record<string, PreviewState>>(() => ({}));

/** Export runs read per load. */
export const PG_EXPORTS_PAGE = 100;
/** List refresh while an export is active; the run page reads its run every 2 s. */
export const PG_ACTIVE_REFRESH_MS = 3_000;
export const PG_RUN_MS = 2_000;

const EMPTY = (missing: boolean): PgState => ({ missing, sources: [], datasets: [], exports: [], exportsTotal: 0 });

export async function loadPg(tenantId: string, t: IngestTenantKey) {
  try {
    const [s, d, x] = await Promise.all([listPgSources(tenantId), listPgDatasets(tenantId), listPgExports(tenantId, { limit: PG_EXPORTS_PAGE })]);
    pgStore.update((all) => {
      all[t] = { missing: false, sources: s?.items ?? [], datasets: d?.items ?? [], exports: x?.items ?? [], exportsTotal: x?.total ?? 0 };
    });
  } catch (e) {
    // the platform API on the stand has no PostgreSQL routes yet: say so instead of failing
    if (e instanceof PgApiError && e.routeMissing) {
      pgStore.update((all) => {
        all[t] = EMPTY(true);
      });
      return;
    }
    throw e;
  }
}

/** Put one export run into the list (newest first). */
export function putExport(t: IngestTenantKey, x: ExportRun) {
  pgStore.update((all) => {
    const P = all[t] ?? EMPTY(false);
    const i = P.exports.findIndex((y) => y.id === x.id);
    if (i >= 0) P.exports[i] = x;
    else {
      P.exports.push(x);
      P.exportsTotal += 1;
    }
    P.exports.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    all[t] = P;
  });
}

export async function loadPgExport(tenantId: string, t: IngestTenantKey, id: string) {
  putExport(t, await getPgExport(tenantId, id));
}

export const hasActiveExport = (P: PgState | undefined) => !!P?.exports.some(isActiveExport);
