/**
 * Agent Workflows on the live tenant: workflows and their runs come from the
 * platform API, and every change the hub makes to a workflow (designer save,
 * new draft, publish, roll-back, emergency disable) is written back to the
 * platform. The hub keeps working on the AI Agent Factory store as before;
 * this module mirrors the store's workflows to the platform (`startWfSync`).
 *
 * Test runs and executions are real: the platform runs the graph, each agent
 * step is a KAP job. `runToSim` turns a platform run into the designer's test
 * overlay (steps, path, answer), so test and replay modes show real runs.
 */
import { toast } from 'sonner';
import { createStore } from '@/engine/store';
import { PgApiError } from '@/api/platformPg';
import { deleteWorkflow, getWfRun, listWfRuns, listWorkflows, putWorkflow, startWfRun, type WfDocRecord, type WfRunRec, type WfRunStep } from '@/api/platformWf';
import { agentFactoryStore, type AfMetrics, type WfRun } from '@/v35/data/agentFactory';
import { relTime } from '@/features/v35/agents/fromKap';
import type { PathSt, WfSimResult } from './model';
import { uiKey, uiStore } from './state';
import type { WfTenantKey, Workflow } from './types';

// ------------------------------------------------------------------ pure mapping
export const RUN_ST: Record<WfRunRec['status'], string> = {
  queued: 'Running',
  running: 'Running',
  waiting: 'Waiting for review',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
export const runSt = (r: Pick<WfRunRec, 'status' | 'fallback_used'>) => (r.status === 'succeeded' && r.fallback_used ? 'Succeeded with fallback' : RUN_ST[r.status]);
export const isActiveWfRun = (r: Pick<WfRunRec, 'status'> | null | undefined) => !!r && (r.status === 'queued' || r.status === 'running' || r.status === 'waiting');

const STEP_ST: Record<WfRunStep['status'], string> = { pending: 'Pending', running: 'Running', waiting: 'Waiting for review', done: 'Succeeded', failed: 'Failed', skipped: 'Skipped' };
export const stepSt = (s: Pick<WfRunStep, 'status'>) => STEP_ST[s.status];

const ms = (a: string | null, b: string | null) => (a && b ? Math.max(0, Date.parse(b) - Date.parse(a)) : null);
export function fmtDur(m: number | null): string {
  if (m == null) return '—';
  if (m < 1000) return `${m} ms`;
  const s = m / 1000;
  return s < 60 ? `${(Math.round(s * 10) / 10).toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

/** The fields of a Workflow kept by the platform (the rest is derived per session). */
export function docOf(w: Workflow): Record<string, unknown> {
  const { id: _id, m: _m, ...doc } = w;
  return doc;
}

/** The designer's path: started steps in run order, then the rest as skipped. */
export function pathOf(steps: { node_id: string; status: WfRunStep['status']; seq: number | null }[]): Record<string, PathSt> {
  const path: Record<string, PathSt> = {};
  const ordered = [...steps].sort((a, b) => (a.seq ?? 1e9) - (b.seq ?? 1e9));
  for (const s of ordered) path[s.node_id] = s.status === 'failed' ? 'bad' : s.seq == null || s.status === 'skipped' || s.status === 'pending' ? 'skip' : 'ok';
  return path;
}

export function toWfRun(r: WfRunRec, now = Date.now()): WfRun {
  const path = pathOf((r.path ?? []).map(([node_id, status, seq]) => ({ node_id, status, seq })));
  return {
    id: r.id,
    wf: r.workflow_id,
    v: r.version,
    caller: r.created_by || (r.trigger === 'test' ? 'Test' : r.trigger),
    q: r.input,
    st: runSt(r),
    dur: fmtDur(ms(r.started_at ?? r.created_at, r.finished_at)),
    at: relTime(r.created_at, now),
    lang: /[؀-ۿ]/.test(r.input) ? 'Arabic' : 'English',
    reason: r.error ?? undefined,
    path,
  };
}

/** Last 7 days: [runs, success %, p95 duration, fallback rate, 0]. */
export function metricsOf(runs: WfRunRec[], now = Date.now()): AfMetrics {
  const recent = runs.filter((r) => now - Date.parse(r.created_at) < 7 * 86_400_000);
  const done = recent.filter((r) => r.status === 'succeeded' || r.status === 'failed');
  const ok = done.filter((r) => r.status === 'succeeded');
  const durs = done.map((r) => ms(r.started_at, r.finished_at)).filter((x): x is number => x != null).sort((a, b) => a - b);
  const p95 = durs.length ? durs[Math.min(durs.length - 1, Math.ceil(0.95 * durs.length) - 1)] : null;
  const fb = ok.filter((r) => r.fallback_used).length;
  return [recent.length, done.length ? Math.round((ok.length / done.length) * 100) : 0, fmtDur(p95), ok.length ? `${Math.round((fb / ok.length) * 100)}%` : '—', 0];
}

export function fromDoc(rec: WfDocRecord, runs: WfRunRec[], now = Date.now()): Workflow {
  const d = rec.doc as Partial<Workflow>;
  return {
    id: rec.id,
    n: String(d.n ?? rec.id),
    purpose: String(d.purpose ?? ''),
    entry: String(d.entry ?? 'Chat'),
    evSets: Array.isArray(d.evSets) ? d.evSets : [],
    dis: (d.dis as Workflow['dis']) ?? null,
    thr: d.thr ?? {},
    ...(d.st ? { st: d.st } : {}),
    vers: Array.isArray(d.vers) ? (d.vers as Workflow['vers']) : [],
    m: metricsOf(runs.filter((r) => r.workflow_id === rec.id), now),
  };
}

/** A platform run as the designer's test result (steps, path, answer) with its progress. */
export function runToSim(r: WfRunRec): WfSimResult & { running: boolean; stepI: number } {
  const steps = r.steps ?? [];
  const started = steps.filter((s) => s.seq != null).sort((a, b) => a.seq! - b.seq!);
  const finished = started.filter((s) => s.status === 'done' || s.status === 'failed').length;
  const note = (s: WfRunStep) => {
    const parts = [s.note, s.kind === 'agent' || s.kind === 'aggregate' ? s.output?.slice(0, 160) : null].filter(Boolean);
    return parts.join(' · ');
  };
  return {
    id: r.id,
    kind: 'workflow',
    w: r.workflow_id,
    ver: r.version,
    q: r.input,
    lang: /[؀-ۿ]/.test(r.input) ? 'Arabic' : 'English',
    st: runSt(r),
    err: r.error ?? '',
    answer: r.answer ?? '',
    steps: started.map((s) => [s.label, s.kind, stepSt(s), note(s), s.node_id]),
    path: pathOf(steps),
    running: isActiveWfRun(r),
    stepI: finished,
  };
}

/** The message for a refused run: the platform's problems list when the graph cannot run. */
export function startError(e: unknown): string {
  if (e instanceof PgApiError) {
    const probs = (e.data as { problems?: string[] } | undefined)?.problems;
    if (probs?.length) return 'The workflow cannot run: ' + probs.join(' ');
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

// ------------------------------------------------------------------ live state
export interface WfLiveState {
  missing: boolean;
  runs: WfRunRec[];
  /** single runs read with their steps */
  run: Record<string, WfRunRec>;
}
export const wfLiveStore = createStore<Record<string, WfLiveState>>(() => ({}));

const snapshots: Record<string, Record<string, string>> = {}; // tenant key → workflow id → doc JSON as last saved/loaded

export async function loadWorkflows(tid: string, t: WfTenantKey) {
  let docs: WfDocRecord[], runs: WfRunRec[];
  try {
    const [w, r] = await Promise.all([listWorkflows(tid), listWfRuns(tid, { limit: 200 })]);
    docs = w.items;
    runs = r.items;
  } catch (e) {
    if (e instanceof PgApiError && e.routeMissing) {
      wfLiveStore.update((s) => void (s[t] = { missing: true, runs: [], run: s[t]?.run ?? {} }));
      return;
    }
    throw e;
  }
  const now = Date.now();
  const wfs = docs.map((d) => fromDoc(d, runs, now));
  const writing = !!syncing[t]?.pending();
  if (!writing) snapshots[t] = Object.fromEntries(wfs.map((w) => [w.id, JSON.stringify(docOf(w))]));
  agentFactoryStore.update((af) => {
    // while a change is being written, keep the store's workflows (the next refresh brings the saved ones)
    if (!writing) af.tenants[t].workflows = wfs;
    af.tenants[t].wfruns = runs.map((r) => toWfRun(r, now));
  });
  wfLiveStore.update((s) => void (s[t] = { missing: false, runs, run: s[t]?.run ?? {} }));
}

export async function loadWfRun(tid: string, t: WfTenantKey, id: string): Promise<WfRunRec> {
  const r = await getWfRun(tid, id);
  wfLiveStore.update((s) => {
    const x = s[t] ?? { missing: false, runs: [], run: {} };
    x.run[id] = r;
    const i = x.runs.findIndex((y) => y.id === id);
    const brief = { ...r, steps: undefined, cfg: undefined, path: r.steps?.map((st): [string, WfRunStep['status'], number | null] => [st.node_id, st.status, st.seq]) };
    if (i >= 0) x.runs[i] = brief;
    else x.runs.unshift(brief);
    s[t] = x;
  });
  agentFactoryStore.update((af) => {
    const list = af.tenants[t].wfruns;
    const run = toWfRun({ ...r, path: r.steps?.map((st) => [st.node_id, st.status, st.seq]) });
    const i = list.findIndex((y) => y.id === id);
    if (i >= 0) list[i] = run;
    else list.unshift(run);
  });
  return r;
}

// ------------------------------------------------------------------ write-back
const syncing: Record<string, { tid: string; off: () => void; pending: () => boolean }> = {};

/** Mirror the store's workflows of tenant `t` to the platform: changed documents are saved, removed ones deleted. */
export function startWfSync(tid: string, t: WfTenantKey) {
  if (syncing[t]?.tid === tid) return;
  syncing[t]?.off();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing = false;
  const flush = async () => {
    timer = null;
    writing = true;
    try {
      await write();
    } finally {
      writing = false;
    }
  };
  const write = async () => {
    const snap = snapshots[t];
    if (!snap) return; // not loaded yet: nothing to compare with
    const wfs = agentFactoryStore.get().tenants[t].workflows;
    const ids = new Set(wfs.map((w) => w.id));
    for (const w of wfs) {
      const json = JSON.stringify(docOf(w));
      if (snap[w.id] === json) continue;
      snap[w.id] = json;
      try {
        await putWorkflow(tid, w.id, docOf(w));
      } catch (e) {
        delete snap[w.id];
        toast.error(`Could not save workflow ${w.n} to the platform: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    for (const id of Object.keys(snap)) {
      if (ids.has(id)) continue;
      delete snap[id];
      try {
        await deleteWorkflow(tid, id);
      } catch (e) {
        toast.error(`Could not delete workflow ${id} on the platform: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  const off = agentFactoryStore.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), 400);
  });
  syncing[t] = { tid, off, pending: () => writing || timer != null };
}

// ------------------------------------------------------------------ test runs
const POLL_MS = 1500;
const POLL_MAX_MS = 30 * 60_000;

/** Start a real run of a version (or of the designer's unsaved copy) and follow it in the designer's test overlay. */
export async function startLiveTest(tid: string, t: WfTenantKey, w: Workflow, v: string, q: string, cfg: unknown | null, who: string): Promise<string> {
  const kk = uiKey(t, w.id);
  let run: WfRunRec;
  try {
    run = await startWfRun(tid, { workflow_id: w.id, input: q, version: v, ...(cfg ? { cfg } : {}), trigger: 'test', created_by: who });
  } catch (e) {
    return startError(e);
  }
  uiStore.update((s) => void (s.test[kk] = runToSim(run)));
  const t0 = Date.now();
  const follow = async () => {
    const cur = uiStore.get().test[kk];
    if (!cur || cur.id !== run.id) return; // another test replaced this one
    try {
      const r = await loadWfRun(tid, t, run.id);
      uiStore.update((s) => void (s.test[kk] = runToSim(r)));
      if (isActiveWfRun(r) && Date.now() - t0 < POLL_MAX_MS) setTimeout(() => void follow(), r.status === 'waiting' ? 5000 : POLL_MS);
    } catch {
      setTimeout(() => void follow(), POLL_MS * 2);
    }
  };
  setTimeout(() => void follow(), POLL_MS);
  return '';
}
