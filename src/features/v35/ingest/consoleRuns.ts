/**
 * Job ids of the KAP pipeline runs this console started (Run now, Run again).
 * KAP records no trigger on a job, so the console remembers its own runs to
 * label them "Manual · started in the console". Kept in memory and in
 * localStorage (`kap.consoleRuns`); storage errors are ignored.
 */
const KEY = 'kap.consoleRuns';
const MAX = 500;

const mem = new Set<string>();
let loaded = false;

function store(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = store()?.getItem(KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) ids.forEach((x) => typeof x === 'string' && mem.add(x));
  } catch {
    /* unreadable storage: memory only */
  }
}

export function markConsoleRun(jobId: string) {
  if (!jobId) return;
  load();
  mem.add(jobId);
  try {
    store()?.setItem(KEY, JSON.stringify([...mem].slice(-MAX)));
  } catch {
    /* storage full or blocked: memory only */
  }
}

export function isConsoleRun(jobId: string): boolean {
  load();
  return mem.has(jobId);
}
