/**
 * Live ingestion run view (live tenant): pure mapping of a KAP pipeline job, its
 * pipeline, its collection's files and the later jobs of the same collection
 * onto what the run page shows: trigger label, progress, the step list
 * (queued → find files → one step per pipeline stage → finished), the
 * explanation of a run that found nothing, "what happened next" and the
 * processed files.
 *
 * KAP facts this relies on (verified on the test stand, 25 Nov 2026):
 * - a connector scans its bucket on its sync interval; each scan that finds new
 *   or changed objects registers its OWN job per collection with `connector_id` set;
 * - "Run now" processes files the connector has already found and that are not
 *   processed yet; it does not scan, so right after an upload it usually finds 0 files;
 * - KAP has no trigger field on jobs and no per-stage progress: stage progress
 *   is read from the states of the collection's files.
 */
import type { KapJob, KapPipeline, KapStage } from './fromKap';
import { isActiveJob, span } from './fromKap';

// ------------------------------------------------------------------ KAP file records (FileListItem)
export interface KapFileItem {
  id: string;
  collection_id?: string;
  connector_id?: string | null;
  name: string;
  source_path?: string;
  state: string;
  file_type?: string;
  size_bytes?: number | string | null;
  current_version_number?: number | null;
  version_count?: number;
  content_changed_at?: string | null;
}

/** File states before the final one (`state__in` for files still being processed). */
export const IN_PROGRESS_STATES = ['pending', 'syncing', 'synced', 'parsing', 'parsed', 'transforming', 'transformed', 'embedding', 'loading', 'validating', 'activating'];
export const isFailedState = (s: string) => s.startsWith('failed');
/** Final state of a file (documents end at `embedded`; indicator packages at `loaded`/`validated`; `activated` for both). */
export const isFinalState = (s: string, kind: 'document' | 'indicators') => s === 'activated' || (kind === 'document' ? s === 'embedded' : s === 'loaded' || s === 'validated');

// ------------------------------------------------------------------ trigger
export type TriggerKind = 'console' | 'scan' | 'outside';
export const TRIGGER_CONSOLE = 'Manual · started in the console';
export const TRIGGER_OUTSIDE = 'Manual · started outside the console';

/**
 * Who started a job. KAP records no trigger: jobs this console started are
 * remembered (`consoleRuns.ts`); a job with `connector_id` that the console did
 * not start was registered by that data source's scan.
 */
export function triggerOf(j: Pick<KapJob, 'connector_id'>, connName: string, ours: boolean): { kind: TriggerKind; label: string } {
  if (ours) return { kind: 'console', label: TRIGGER_CONSOLE };
  if (j.connector_id) return { kind: 'scan', label: `Data source scan · ${connName || 'connector not listed'}` };
  return { kind: 'outside', label: TRIGGER_OUTSIDE };
}

// ------------------------------------------------------------------ time
/** Local "HH:MM" of an ISO time. */
export function hhmm(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** Local "HH:MM:SS" of an ISO time. */
export function hhmmss(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${hhmm(iso)}:${String(d.getSeconds()).padStart(2, '0')}`;
}
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** "every 3 minutes", "every hour", "every 6 hours", "every day" for an ISO 8601 sync interval. */
export function intervalWords(iso: string | undefined | null): string {
  if (!iso) return '';
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return `every ${iso}`;
  const units: [string | undefined, string][] = [
    [m[1], 'day'],
    [m[2], 'hour'],
    [m[3], 'minute'],
    [m[4], 'second'],
  ];
  const parts = units.filter(([n]) => n && +n > 0).map(([n, u]) => [+n!, u] as const);
  if (!parts.length) return `every ${iso}`;
  if (parts.length === 1 && parts[0][0] === 1) return `every ${parts[0][1]}`;
  return `every ${parts.map(([n, u]) => `${n} ${n === 1 ? u : `${u}s`}`).join(' ')}`;
}

/** Run duration: finished − started, or so far while active. */
export function runDuration(j: KapJob, now: number): string {
  const start = ms(j.running_at);
  if (Number.isNaN(start)) return isActiveJob(j) ? 'not started' : '—';
  const end = j.finished_at ? ms(j.finished_at) : now;
  return span(end - start);
}

// ------------------------------------------------------------------ progress
export interface RunProgress {
  total: number | null;
  completed: number;
  percent: number | null;
  /** files not counted yet (discovery has not finished) */
  indeterminate: boolean;
  label: string;
}
const files = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'file' : 'files'}`;

export function progressOf(j: Pick<KapJob, 'state' | 'progress'>): RunProgress {
  const total = j.progress?.total ?? null;
  const completed = j.progress?.completed ?? 0;
  const percent = j.progress?.percent ?? (total ? Math.round((completed / total) * 100) : total === 0 ? 100 : null);
  const active = isActiveJob(j);
  const label =
    total == null
      ? active
        ? completed
          ? `${completed.toLocaleString('en-US')} files finished · counting files…`
          : 'Counting new and changed files…'
        : 'Not reported'
      : total === 0
        ? 'No files to process'
        : `${completed.toLocaleString('en-US')} of ${files(total)}`;
  return { total, completed, percent, indeterminate: total == null && active, label };
}

// ------------------------------------------------------------------ steps
export type StepState = 'done' | 'current' | 'failed' | 'pending' | 'skipped';
export interface RunStep {
  key: string;
  title: string;
  state: StepState;
  /** time or duration of the step ('' when KAP does not report it) */
  time: string;
  detail: string;
}

/** A pipeline stage as a step: the file states that mean "waiting for or in this step". */
export interface StageStep {
  key: string;
  title: string;
  what: string;
  states: string[];
  /** words in a `failed_*` state that place the failure in this step */
  failWords: string[];
}

const STEP_OF: Record<KapStage['type'], Omit<StageStep, 'key' | 'states'>> = {
  parser: { title: 'Parse', what: 'Read each file and turn it into text', failWords: ['sync', 'pars', 'upload', 'pending'] },
  transformer: { title: 'Transform', what: 'Summaries and metadata with the chat model', failWords: ['transform'] },
  embedding: { title: 'Embed', what: 'Split into chunks and store their embeddings for search', failWords: ['embed'] },
  csv_loader: { title: 'Load CSV', what: 'Read the registry and observation files into datasets', failWords: ['sync', 'load', 'upload', 'pending'] },
};

/** The steps the stages of `pipe` make (indicator pipelines get Load CSV and Validate). */
export function stageSteps(pipe: Pick<KapPipeline, 'kind' | 'stages'> | undefined): StageStep[] {
  const stages = pipe?.stages?.length ? pipe.stages : ([{ name: 'parse', type: 'parser' }, { name: 'embed', type: 'embedding' }] as Pick<KapStage, 'name' | 'type'>[]);
  const hasTr = stages.some((s) => s.type === 'transformer');
  const out: StageStep[] = [];
  for (const s of stages) {
    const def = STEP_OF[s.type];
    if (!def) continue;
    const states =
      s.type === 'parser'
        ? ['pending', 'syncing', 'synced', 'parsing']
        : s.type === 'transformer'
          ? ['parsed', 'transforming']
          : s.type === 'embedding'
            ? [hasTr ? 'transformed' : 'parsed', 'embedding']
            : ['pending', 'syncing', 'synced', 'loading'];
    out.push({ key: `stage:${s.name}`, ...def, states });
    if (s.type === 'csv_loader')
      out.push({ key: `stage:${s.name}:validate`, title: 'Validate', what: 'Check the loaded observations', states: ['validating', 'activating'], failWords: ['validat', 'activat'] });
  }
  return out;
}

/** Index of the step a failed file state belongs to (-1 = none). */
export function failedStep(state: string, steps: StageStep[]): number {
  if (!isFailedState(state)) return -1;
  const i = steps.findIndex((s) => s.failWords.some((w) => state.includes(w)));
  return i >= 0 ? i : 0;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * The steps of a run. `runFiles` are the collection's files that belong to the
 * run (see `runFiles`), or null while they are not read yet.
 */
export function runSteps(j: KapJob, pipe: Pick<KapPipeline, 'kind' | 'stages'> | undefined, runFilesList: KapFileItem[] | null, now: number): RunStep[] {
  const active = isActiveJob(j);
  const started = !!j.running_at;
  const total = j.progress?.total ?? null;
  const R = j.result ?? null;
  const steps: RunStep[] = [];

  // 1. queued
  if (started)
    steps.push({ key: 'queued', title: 'Queued', state: 'done', time: `${hhmmss(j.created_at)} → ${hhmmss(j.running_at)}`, detail: `A worker picked the run up after ${span(ms(j.running_at) - ms(j.created_at))}.` });
  else if (active) steps.push({ key: 'queued', title: 'Queued', state: 'current', time: `since ${hhmmss(j.created_at)}`, detail: `Waiting for a free worker (${span(now - ms(j.created_at))} so far).` });
  else steps.push({ key: 'queued', title: 'Queued', state: j.state === 'failed' ? 'failed' : 'skipped', time: hhmmss(j.created_at), detail: j.state === 'cancelled' ? 'Cancelled before a worker picked it up.' : 'Stopped before a worker picked it up.' });

  // 2. find new and changed files
  const disc: RunStep = { key: 'discover', title: 'Find new and changed files', state: 'pending', time: '', detail: 'Looks for files the data source has found that are not processed yet.' };
  if (total != null) {
    disc.state = 'done';
    disc.detail = total === 0 ? 'No new or changed files.' : `${plural(total, 'new or changed file')}.`;
  } else if (active && started) {
    disc.state = 'current';
    disc.time = `since ${hhmmss(j.running_at)}`;
    disc.detail = 'Looking for files the data source has found that are new or changed…';
  } else if (!active) {
    disc.state = j.state === 'failed' && started ? 'failed' : j.state === 'succeeded' ? 'done' : 'skipped';
    disc.detail = j.state === 'succeeded' ? 'KAP did not report how many files it found.' : started ? 'Stopped before the files were counted.' : 'Not reached.';
  }
  steps.push(disc);

  // 3. one step per pipeline stage
  const defs = stageSteps(pipe);
  const F = runFilesList ?? [];
  const inStage = defs.map((d) => F.filter((f) => d.states.includes(f.state)).length);
  const failedAt = defs.map((_, i) => F.filter((f) => failedStep(f.state, defs) === i).length);
  const failedBefore = (i: number) => failedAt.slice(0, i).reduce((a, b) => a + b, 0);
  const anyFailedFiles = failedAt.some(Boolean);
  const busy = inStage.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
  const firstCur = busy.length ? busy[0] : runFilesList == null ? 0 : (j.progress?.completed ?? 0) >= (total ?? Infinity) ? defs.length : 0;
  const lastCur = busy.length ? busy[busy.length - 1] : firstCur;
  defs.forEach((d, i) => {
    const s: RunStep = { key: d.key, title: d.title, state: 'pending', time: '', detail: d.what };
    const failN = failedAt[i];
    const failTxt = failN ? ` · ${plural(failN, 'file')} failed here` : '';
    if (total === 0) {
      s.state = 'skipped';
      s.detail = 'Nothing to process.';
    } else if (total == null) {
      s.state = active ? 'pending' : 'skipped';
      s.detail = active ? `${d.what}.` : 'Not reached.';
    } else if (active) {
      if (i < firstCur) {
        s.state = 'done';
        s.detail = `${d.what}. Done for the files of this run${failTxt}.`;
      } else if (i <= lastCur) {
        s.state = 'current';
        s.detail = runFilesList == null ? 'Reading the state of the files…' : inStage[i] ? `${plural(inStage[i], 'file')} in this step now${failTxt}.` : `No file in this step right now${failTxt}.`;
      } else s.detail = `${d.what}.`;
    } else {
      // finished
      const reached = Math.max(0, total - failedBefore(i));
      const ok = Math.max(0, reached - failN);
      if (j.state === 'failed' && !anyFailedFiles && !R?.succeeded) {
        s.state = 'skipped';
        s.detail = 'KAP does not report this step separately; see the error under Finished.';
      } else if (failN) {
        s.state = 'failed';
        s.detail = `${plural(ok, 'file')} done · ${plural(failN, 'file')} failed.`;
      } else if (j.state === 'cancelled' && !R?.succeeded) {
        s.state = 'skipped';
        s.detail = 'Not reached: the run was cancelled.';
      } else {
        s.state = 'done';
        s.detail = runFilesList ? `${plural(ok, 'file')} done.` : `${d.what}.`;
      }
    }
    steps.push(s);
  });

  // 4. finished
  const fin: RunStep = { key: 'finished', title: 'Finished', state: 'pending', time: '', detail: 'Not finished yet.' };
  if (!active) {
    fin.state = j.state === 'succeeded' ? 'done' : 'failed';
    fin.time = j.finished_at ? `${hhmmss(j.finished_at)} · ${span(ms(j.finished_at) - ms(j.created_at))} in all` : '';
    const counts = R ? `${R.succeeded.toLocaleString('en-US')} succeeded · ${R.failed.toLocaleString('en-US')} failed · ${R.cancelled.toLocaleString('en-US')} cancelled` : 'Result not loaded yet';
    fin.detail = `${j.state === 'succeeded' ? 'Succeeded' : j.state === 'failed' ? 'Failed' : 'Cancelled'}: ${counts}.${j.error ? ` ${j.error.code}: ${j.error.message}` : ''}`;
  }
  steps.push(fin);
  return steps;
}

// ------------------------------------------------------------------ zero files
/** A finished run that had nothing to process. */
export function isZeroRun(j: Pick<KapJob, 'state' | 'progress' | 'result'>): boolean {
  if (isActiveJob(j) || j.state !== 'succeeded') return false;
  if (j.progress?.total === 0) return true;
  const R = j.result;
  return j.progress?.total == null && !!R && R.succeeded + R.failed + R.cancelled === 0;
}

export interface ScanSource {
  name: string;
  interval?: string | null;
}

/** Why a run processed nothing, in plain words. */
export function zeroExplanation(conns: ScanSource[]): { title: string; lines: string[] } {
  const scans = conns.map((c) => (c.interval ? `${c.name} (${intervalWords(c.interval)})` : c.name));
  const who = scans.length ? `the next scan of ${scans.join(' or ')}` : "the data source's next scan";
  return {
    title: 'Nothing new to process',
    lines: [
      'This run found no new or changed files, so it finished at once without processing anything. That is expected, not an error.',
      'Every file the data source has found so far is already processed. A run only processes files the data source has already found: it does not look into the bucket itself.',
      `A file uploaded to the bucket is found by ${who}. That scan starts its own run, which then processes the file.`,
    ],
  };
}

// ------------------------------------------------------------------ what happened next
export interface FollowUp {
  job: KapJob;
  label: string;
  outcome: string;
  active: boolean;
}

/** Later jobs of the same collection, oldest first. */
export function laterRuns(j: Pick<KapJob, 'id' | 'collection_id' | 'created_at'>, jobs: KapJob[]): KapJob[] {
  const t = ms(j.created_at);
  return jobs.filter((x) => x.id !== j.id && x.collection_id === j.collection_id && ms(x.created_at) > t).sort((a, b) => ms(a.created_at) - ms(b.created_at));
}

/** "Scan of qa_s3 at 11:36" + "processed 1 file". */
export function followUp(x: KapJob, connName: string, ours: boolean): FollowUp {
  const tr = triggerOf(x, connName, ours);
  const at = hhmm(x.created_at);
  const label = tr.kind === 'scan' ? `Scan of ${connName || 'the data source'} at ${at}` : tr.kind === 'console' ? `Run started in the console at ${at}` : `Run started outside the console at ${at}`;
  const total = x.progress?.total ?? null;
  const R = x.result;
  const active = isActiveJob(x);
  const outcome = active
    ? x.state === 'waiting' && !x.running_at
      ? 'is queued'
      : total == null
        ? 'is looking for files'
        : `is processing ${files(total)} (${x.progress.completed.toLocaleString('en-US')} done)`
    : x.state === 'cancelled'
      ? 'was cancelled'
      : total === 0 || (R && R.succeeded + R.failed + R.cancelled === 0)
        ? 'found nothing new'
        : `${x.state === 'failed' ? 'failed after processing' : 'processed'} ${files(total ?? (R ? R.succeeded + R.failed + R.cancelled : 0))}${R?.failed ? ` (${R.failed.toLocaleString('en-US')} failed)` : ''}`;
  return { job: x, label, outcome, active };
}

// ------------------------------------------------------------------ processed items
export type ItemTone = 'ok' | 'bad' | 'run';
export interface RunItem {
  file: KapFileItem;
  /** "Processed", "Failed · parsing", "Embed · in progress" */
  result: string;
  tone: ItemTone;
  /** Business Data document id (`<collection>:<file name>`), document pipelines only */
  docId: string | null;
}

/** Slack around the run window: a scan registers the file just before its job. */
const SLACK_MS = 60_000;

/**
 * The collection's files that belong to the run: changed during the run window
 * (created − 1 min … finished + 1 min), or, while the run is active, still in
 * progress. Narrowed to the run's connector when it has one.
 */
export function runFiles(j: KapJob, all: KapFileItem[], now: number, kind: 'document' | 'indicators'): KapFileItem[] {
  const a = ms(j.created_at) - SLACK_MS;
  const b = j.finished_at ? ms(j.finished_at) + SLACK_MS : now + SLACK_MS;
  const active = isActiveJob(j);
  const seen = new Set<string>();
  return all.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    if (j.connector_id && f.connector_id && f.connector_id !== j.connector_id) return false;
    const t = ms(f.content_changed_at);
    const inWindow = !Number.isNaN(t) && t >= a && t <= b;
    const inProgress = active && !isFinalState(f.state, kind) && !isFailedState(f.state);
    return inWindow || inProgress;
  });
}

export function runItems(files: KapFileItem[], pipe: Pick<KapPipeline, 'kind' | 'stages'> | undefined, collection: string): RunItem[] {
  const kind = pipe?.kind ?? 'document';
  const defs = stageSteps(pipe);
  return files.map((f) => {
    let result: string;
    let tone: ItemTone;
    if (isFinalState(f.state, kind)) {
      result = 'Processed';
      tone = 'ok';
    } else if (isFailedState(f.state)) {
      const i = failedStep(f.state, defs);
      result = `Failed${i >= 0 ? ` in ${defs[i].title.toLowerCase()}` : ''} (${f.state})`;
      tone = 'bad';
    } else {
      const d = defs.find((x) => x.states.includes(f.state));
      result = `${d ? d.title : 'In progress'} · ${f.state}`;
      tone = 'run';
    }
    return { file: f, result, tone, docId: kind === 'document' ? `${collection}:${f.name}` : null };
  });
}
