/**
 * Live tenant: evaluation test sets and runs from the platform API, kept per
 * KAP tenant id. Lists refresh every 30 s, every 3 s while a run is going; a
 * single set or run is read on its own page.
 */
import { createStore } from '@/engine/store';
import { PgApiError } from '@/api/platformPg';
import { getEvalRun, getEvalSet, listEvalRuns, listEvalSets, type EvalRun, type EvalSet } from '@/api/platformEval';
import { liveTenantId, useLiveLoad } from '@/v35/live';
import { isActiveRun } from './evalView';

export interface EvalState {
  /** the platform API has no evaluation routes (not updated on the stand) */
  missing: boolean;
  sets: EvalSet[];
  runs: EvalRun[];
  /** single reads: set with its cases, run with its results */
  set: Record<string, EvalSet>;
  run: Record<string, EvalRun>;
}

const EMPTY = (): EvalState => ({ missing: false, sets: [], runs: [], set: {}, run: {} });
export const evalStore = createStore<Record<string, EvalState>>(() => ({}));

export const EVAL_ACTIVE_REFRESH_MS = 3_000;

function put(tid: string, f: (s: EvalState) => void) {
  evalStore.update((all) => {
    const s = all[tid] ?? EMPTY();
    f(s);
    all[tid] = s;
  });
}

const missing = (e: unknown) => e instanceof PgApiError && e.routeMissing;

export async function loadEvals(tid: string) {
  try {
    const [sets, runs] = await Promise.all([listEvalSets(tid), listEvalRuns(tid, { limit: 200 })]);
    put(tid, (s) => {
      s.missing = false;
      s.sets = sets.items;
      s.runs = runs.items;
    });
  } catch (e) {
    if (missing(e)) return put(tid, (s) => void (s.missing = true));
    throw e;
  }
}

export async function loadEvalSet(tid: string, id: string) {
  try {
    const x = await getEvalSet(tid, id);
    put(tid, (s) => {
      s.set[id] = x;
      const i = s.sets.findIndex((y) => y.id === id);
      const brief = { ...x, cases: undefined };
      if (i >= 0) s.sets[i] = brief;
      else s.sets.push(brief);
    });
  } catch (e) {
    if (missing(e)) return put(tid, (s) => void (s.missing = true));
    throw e;
  }
}

export async function loadEvalRun(tid: string, id: string) {
  try {
    const x = await getEvalRun(tid, id);
    putRun(tid, x);
  } catch (e) {
    if (missing(e)) return put(tid, (s) => void (s.missing = true));
    throw e;
  }
}

/** A run read on its own (with results) also updates the list. */
export function putRun(tid: string, x: EvalRun) {
  put(tid, (s) => {
    s.run[x.id] = x;
    const brief = { ...x, results: undefined };
    const i = s.runs.findIndex((y) => y.id === x.id);
    if (i >= 0) s.runs[i] = brief;
    else s.runs.unshift(brief);
  });
}

export function forgetRun(tid: string, id: string) {
  put(tid, (s) => {
    s.runs = s.runs.filter((r) => r.id !== id);
    delete s.run[id];
  });
}

export function forgetSet(tid: string, id: string) {
  put(tid, (s) => {
    s.sets = s.sets.filter((x) => x.id !== id);
    s.runs = s.runs.filter((r) => r.set_id !== id);
    delete s.set[id];
  });
}

export const evalStateOf = (all: Record<string, EvalState>, tid: string | null) => (tid ? all[tid] : undefined);

/** Lists of the live tenant (sets and runs). */
export function useEvalLists(tenantKey: string | null) {
  const all = evalStore.use();
  const st = evalStateOf(all, liveTenantId(tenantKey));
  // 3 s while a run is going, else the default
  const live = useLiveLoad('evals', tenantKey, loadEvals, st?.runs.some(isActiveRun) ? EVAL_ACTIVE_REFRESH_MS : undefined);
  return { live, st };
}
