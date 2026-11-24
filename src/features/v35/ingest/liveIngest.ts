/**
 * Live tenant: loads connectors, pipelines, collections, model providers and
 * pipeline jobs from KAP, keeps the raw records (`liveIngestStore`, for ids and
 * request bodies) and replaces the tenant's slice of `ingestStore` with the
 * mapped records. Session-only records (types KAP lacks) survive reloads.
 */
import { createStore } from '@/engine/store';
import { kapAll, kapGet, type KapPage } from '@/api/kap';
import { ingestStore, type IngestTenantKey } from '@/v35/data/ingest';
import { isActiveJob, sortJobs, toIngestTenant, type KapCollection, type KapConnector, type KapConnectorCheck, type KapIngest, type KapJob, type KapModel, type KapPipeline } from './fromKap';

export const liveIngestStore = createStore<Partial<Record<IngestTenantKey, KapIngest>>>(() => ({}));

/** Jobs read per pipeline (newest first), runs kept in all, job details fetched per load. */
export const JOBS_PER_PIPELINE = 50;
export const MAX_RUNS = 200;
const DETAILS_PER_LOAD = 15;
/** Refresh while a run is waiting or running. */
export const ACTIVE_REFRESH_MS = 15_000;

const TERMINAL = (j: KapJob) => !isActiveJob(j);

/** Rewrite tenant t's hub slice from the raw KAP records. */
export function applyIngest(t: IngestTenantKey, now = Date.now()) {
  const K = liveIngestStore.get()[t];
  if (!K) return;
  ingestStore.update((all) => {
    all[t] = toIngestTenant(K, all[t], now);
  });
}

export function updateLive(t: IngestTenantKey, fn: (K: KapIngest) => void) {
  liveIngestStore.update((all) => {
    const K = all[t];
    if (K) fn(K);
  });
  applyIngest(t);
}

export async function loadIngest(tenantId: string, t: IngestTenantKey) {
  const [conns, pipes, colls, models] = await Promise.all([
    kapAll<KapConnector>(tenantId, 'connectors'),
    kapAll<KapPipeline>(tenantId, 'pipelines'),
    kapAll<KapCollection>(tenantId, 'collections'),
    // model names for the pipeline wizard; the hub still works without them
    kapAll<KapModel>(tenantId, 'model-providers').catch(() => [] as KapModel[]),
  ]);
  const pages = await Promise.all(
    pipes.map((p) =>
      kapGet<KapPage<KapJob>>(tenantId, `pipelines/${p.id}/jobs`, { limit: JOBS_PER_PIPELINE, offset: 0 })
        .then((x) => x.items)
        .catch(() => [] as KapJob[]),
    ),
  );
  const prev = liveIngestStore.get()[t];
  // keep the result and error of finished jobs already read (a finished job does not change)
  const known = new Map((prev?.jobs ?? []).filter((j) => TERMINAL(j) && j.result !== undefined).map((j) => [j.id, j]));
  let jobs = sortJobs(pages.flat(), MAX_RUNS).map((j) => {
    const k = known.get(j.id);
    return k && TERMINAL(j) ? { ...j, result: k.result, error: k.error } : j;
  });
  const need = jobs.filter((j) => TERMINAL(j) && j.result === undefined).slice(0, DETAILS_PER_LOAD);
  const details = await Promise.all(need.map((j) => kapGet<KapJob>(tenantId, `pipelines/${j.pipeline_id}/jobs/${j.id}`).catch(() => null)));
  const byId = new Map(details.filter((x): x is KapJob => !!x).map((d) => [d.id, d]));
  jobs = jobs.map((j) => byId.get(j.id) ?? j);
  liveIngestStore.update((all) => {
    all[t] = { conns, pipes, colls, jobs, models, checks: prev?.checks ?? {} };
  });
  applyIngest(t);
}

/** Read one job's detail (result, error) if it is not loaded yet. */
export async function ensureJobDetail(tenantId: string, t: IngestTenantKey, job: string) {
  const K = liveIngestStore.get()[t];
  const j = K?.jobs.find((x) => x.id === job);
  if (!j || j.result !== undefined) return;
  const d = await kapGet<KapJob>(tenantId, `pipelines/${j.pipeline_id}/jobs/${j.id}`);
  updateLive(t, (X) => {
    const i = X.jobs.findIndex((x) => x.id === job);
    if (i >= 0) X.jobs[i] = d;
  });
}

export function setCheck(t: IngestTenantKey, name: string, c: KapConnectorCheck) {
  updateLive(t, (K) => {
    K.checks[name] = c;
  });
}

export const hasActiveRun = (K: KapIngest | undefined) => !!K?.jobs.some(isActiveJob);
