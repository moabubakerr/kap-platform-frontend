/**
 * Live tenant: loads connectors, pipelines, collections, model providers and
 * pipeline jobs from KAP, keeps the raw records (`liveIngestStore`, for ids and
 * request bodies) and replaces the tenant's slice of `ingestStore` with the
 * mapped records. Session-only records (types KAP lacks) survive reloads.
 */
import { createStore } from '@/engine/store';
import { kapAll, kapError, kapGet, type KapPage } from '@/api/kap';
import { ingestStore, type IngestTenantKey } from '@/v35/data/ingest';
import { isConsoleRun } from './consoleRuns';
import { IN_PROGRESS_STATES, isZeroRun, laterRuns, type KapFileItem } from './runView';
import { isActiveJob, sortJobs, toIngestTenant, type KapCollection, type KapConnector, type KapConnectorCheck, type KapIngest, type KapJob, type KapModel, type KapPipeline } from './fromKap';

export const liveIngestStore = createStore<Partial<Record<IngestTenantKey, KapIngest>>>(() => ({}));

/** Jobs read per pipeline (newest first, in pages of `JOBS_PAGE`), runs kept in all, job details fetched per load. */
export const JOBS_PER_PIPELINE = 100;
const JOBS_PAGE = 50;
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
    all[t] = toIngestTenant(K, all[t], now, isConsoleRun);
  });
}

export function updateLive(t: IngestTenantKey, fn: (K: KapIngest) => void) {
  liveIngestStore.update((all) => {
    const K = all[t];
    if (K) fn(K);
  });
  applyIngest(t);
}

/**
 * The newest runs of one pipeline: explicit `sort=-created_at`, paged while KAP
 * says `has_next`, up to `JOBS_PER_PIPELINE`. Returns KAP's `total` too.
 */
export async function pipelineJobs(tenantId: string, pipelineId: string, max = JOBS_PER_PIPELINE): Promise<{ jobs: KapJob[]; total: number }> {
  const jobs: KapJob[] = [];
  let total = 0;
  for (let offset = 0; jobs.length < max; ) {
    const page = await kapGet<KapPage<KapJob>>(tenantId, `pipelines/${pipelineId}/jobs`, { sort: '-created_at', limit: Math.min(JOBS_PAGE, max - jobs.length), offset });
    const items = page?.items ?? [];
    jobs.push(...items);
    total = Math.max(page?.total ?? 0, jobs.length);
    if (!page?.has_next || !items.length) break;
    offset += items.length;
  }
  return { jobs, total };
}

export async function loadIngest(tenantId: string, t: IngestTenantKey) {
  const [conns, pipes, colls, models] = await Promise.all([
    kapAll<KapConnector>(tenantId, 'connectors'),
    kapAll<KapPipeline>(tenantId, 'pipelines'),
    kapAll<KapCollection>(tenantId, 'collections'),
    // model names for the pipeline wizard; the hub still works without them
    kapAll<KapModel>(tenantId, 'model-providers').catch(() => [] as KapModel[]),
  ]);
  const prev = liveIngestStore.get()[t];
  const jobTotals: Record<string, number> = {};
  const jobErrors: Record<string, string> = {};
  const pages = await Promise.all(
    pipes.map((p) =>
      pipelineJobs(tenantId, p.id).then(
        (x) => {
          jobTotals[p.id] = x.total;
          return x.jobs;
        },
        (e) => {
          // do not drop the pipeline's runs on a failed read: keep the ones already shown and say so
          jobErrors[p.name] = kapError(e);
          return (prev?.jobs ?? []).filter((j) => j.pipeline_id === p.id);
        },
      ),
    ),
  );
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
    all[t] = { conns, pipes, colls, jobs, models, checks: prev?.checks ?? {}, jobTotals, jobErrors };
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

// ------------------------------------------------------------------ one run, live (run page)
export interface RunLive {
  /** job detail (progress, result, error) */
  job: KapJob;
  /** the collection's recently changed and in-progress files; null when KAP could not list them */
  files: KapFileItem[] | null;
  /** later jobs of the same collection (read for runs that found nothing); null when not read */
  later: KapJob[] | null;
  at: number;
}
export const liveRunStore = createStore<Record<string, RunLive>>(() => ({}));

/** How often an open run page reads its run: fast while active, slowly after a run that found nothing (to show the next scan), else not. */
export function runRefreshMs(r: RunLive | undefined): number {
  if (!r) return RUN_ACTIVE_MS;
  if (isActiveJob(r.job)) return RUN_ACTIVE_MS;
  if (isZeroRun(r.job)) return RUN_NEXT_SCAN_MS;
  return 0;
}
export const RUN_ACTIVE_MS = 2_000;
export const RUN_NEXT_SCAN_MS = 10_000;

/**
 * Read one run for its page: the job detail, the collection's files (recently
 * changed, and in progress while the run is active) and, after a run that found
 * nothing, the later runs of the collection. Writes the job (and later jobs)
 * into the hub slice too, so the list and the links stay in step.
 */
export async function loadRun(tenantId: string, t: IngestTenantKey, jobId: string) {
  const j0 = liveIngestStore.get()[t]?.jobs.find((x) => x.id === jobId);
  if (!j0) return;
  const job = await kapGet<KapJob>(tenantId, `pipelines/${j0.pipeline_id}/jobs/${jobId}`);
  const active = isActiveJob(job);
  const fpath = `collections/${job.collection_id}/files`;
  const items = (p: KapPage<KapFileItem> | undefined) => p?.items ?? [];
  const [recent, busy, later] = await Promise.all([
    kapGet<KapPage<KapFileItem>>(tenantId, fpath, { sort: '-content_changed_at', limit: 100 }).then(items, () => null),
    active ? kapGet<KapPage<KapFileItem>>(tenantId, fpath, { state__in: IN_PROGRESS_STATES, limit: 200 }).then(items, () => [] as KapFileItem[]) : Promise.resolve([] as KapFileItem[]),
    isZeroRun(job)
      ? kapGet<KapPage<KapJob>>(tenantId, `pipelines/${job.pipeline_id}/jobs`, { collection_id: job.collection_id, sort: '-created_at', limit: 20 }).then((p) => p?.items ?? [], () => null)
      : Promise.resolve(null),
  ]);
  const files = recent == null ? null : [...busy, ...recent];
  liveRunStore.update((all) => {
    all[jobId] = { job, files, later: later ? laterRuns(job, later) : null, at: Date.now() };
  });
  updateLive(t, (K) => {
    const put = (x: KapJob) => {
      const i = K.jobs.findIndex((y) => y.id === x.id);
      if (i >= 0) K.jobs[i] = { ...K.jobs[i], ...x };
      else K.jobs.push(x);
    };
    put(job);
    (later ?? []).forEach(put);
    K.jobs = sortJobs(K.jobs, MAX_RUNS);
  });
}
