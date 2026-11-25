/**
 * Live (KAP) ingestion runs: the run page's step view and processed files, and
 * the run list with status icons and progress. Data comes from `runView.ts`
 * (pure) over the records `liveIngest.ts` reads.
 */
import * as React from 'react';
import { AlertTriangle, Ban, CheckCircle2, ChevronRight, Circle, Clock, FileText, Info, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Section } from '@/engine/types';
import type { Run, RunStatus } from '@/v35/data/ingest';
import type { IngestNav } from './build';
import { kapOfRun, runId, type KapCollection, type KapConnector, type KapJob, type KapPipeline } from './fromKap';
import {
  earlierWork, followUp, hhmm, hhmmss, isZeroRun, progressOf, runDuration, runFiles, runItems, runSteps, splitRelated, triggerOf, zeroExplanation,
  type FollowUp, type KapFileItem, type RunStep, type StepState,
} from './runView';

// ------------------------------------------------------------------ small parts
const STATUS_ICON: Record<RunStatus, { icon: React.ElementType; cls: string; spin?: boolean }> = {
  Queued: { icon: Clock, cls: 'text-ink-muted' },
  Running: { icon: Loader2, cls: 'text-info', spin: true },
  Succeeded: { icon: CheckCircle2, cls: 'text-success' },
  'Partially succeeded': { icon: AlertTriangle, cls: 'text-warning' },
  Failed: { icon: XCircle, cls: 'text-danger' },
  Cancelled: { icon: Ban, cls: 'text-ink-muted' },
};

export function RunStatusIcon({ st, size = 16 }: { st: RunStatus; size?: number }) {
  const s = STATUS_ICON[st] ?? STATUS_ICON.Queued;
  const I = s.icon;
  return <I size={size} strokeWidth={1.75} aria-hidden className={cn('flex-none', s.cls, s.spin && 'animate-spin')} />;
}

function StatusBadge({ st }: { st: RunStatus }) {
  const tone =
    st === 'Succeeded' ? 'bg-success-bg text-success-fg' : st === 'Failed' ? 'bg-danger-bg text-danger-fg' : st === 'Partially succeeded' ? 'bg-warning-bg text-warning-fg' : st === 'Running' ? 'bg-info-bg text-info' : 'bg-surface-sunken text-ink-body';
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold', tone)}>
      <RunStatusIcon st={st} size={14} />
      {st}
    </span>
  );
}

const STEP_ICON: Record<StepState, { icon: React.ElementType; cls: string; label: string }> = {
  done: { icon: CheckCircle2, cls: 'text-success', label: 'Done' },
  current: { icon: Loader2, cls: 'text-info animate-spin', label: 'In progress' },
  failed: { icon: XCircle, cls: 'text-danger', label: 'Failed' },
  pending: { icon: Circle, cls: 'text-ink-subtle', label: 'Not reached yet' },
  skipped: { icon: MinusCircle, cls: 'text-ink-subtle', label: 'Skipped' },
};

/** Progress bar: determinate, or a moving stripe while the total is unknown. */
export function ProgressBar({ percent, indeterminate, tone = 'info', thin }: { percent: number | null; indeterminate?: boolean; tone?: 'info' | 'ok' | 'bad' | 'warn'; thin?: boolean }) {
  const bg = tone === 'ok' ? 'bg-success' : tone === 'bad' ? 'bg-danger' : tone === 'warn' ? 'bg-warning' : 'bg-info';
  return (
    <div className={cn('relative w-full overflow-hidden rounded-full bg-surface-sunken', thin ? 'h-1.5' : 'h-2.5')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : (percent ?? 0)}>
      {indeterminate ? (
        <div className={cn('absolute inset-y-0 w-1/3 animate-pulse rounded-full', bg)} style={{ left: '33%' }} />
      ) : (
        <div className={cn('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }} />
      )}
    </div>
  );
}

const LinkBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline">
    {children}
  </button>
);

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-ink-muted">{k}</div>
      <div className="mt-0.5 min-w-0 break-words text-[13.5px] text-ink-strong">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ run page: overview
export interface LiveRunData {
  run: Run;
  job: KapJob;
  pipe?: KapPipeline;
  collection?: KapCollection;
  conns: KapConnector[];
  /** the collection's recent and in-progress files (null: not readable); undefined: not read yet */
  files: KapFileItem[] | null | undefined;
  /** later jobs of the collection (zero-file runs); null/undefined: not read yet */
  later: KapJob[] | null | undefined;
  ours: (jobId: string) => boolean;
  now: number;
  go: IngestNav;
}

const connName = (D: LiveRunData, id: string | null | undefined) => (id ? D.conns.find((c) => c.id === id)?.name ?? 'connector not listed' : '');

/** Connectors that bring files into the run's collection (the run's own connector when it has one). */
function scanSources(D: LiveRunData) {
  const own = D.job.connector_id ? D.conns.filter((c) => c.id === D.job.connector_id) : [];
  const list = own.length ? own : D.conns.filter((c) => D.collection?.connectors.includes(c.name));
  return list.map((c) => ({ name: c.name, interval: c.settings?.sync?.interval ?? null }));
}

export function LiveRunOverview({ D }: { D: LiveRunData }) {
  const { job: j, run: r, go } = D;
  const kind = D.pipe?.kind ?? 'document';
  const files = D.files === undefined ? null : D.files === null ? null : runFiles(j, D.files, D.now, kind);
  const steps = runSteps(j, D.pipe, files, D.now);
  const pr = progressOf(j);
  const zero = isZeroRun(j);
  const conn = connName(D, j.connector_id);
  const tr = triggerOf(j, conn, D.ours(j.id));
  const srcs = scanSources(D);
  const final = !['Queued', 'Running'].includes(r.st);
  const R = j.result;
  const barTone = !final ? 'info' : r.st === 'Failed' ? 'bad' : r.st === 'Partially succeeded' ? 'warn' : r.st === 'Cancelled' ? 'info' : 'ok';
  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="card px-4 py-3.5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <StatusBadge st={r.st} />
          <span className="text-[13px] text-ink-muted">{tr.label}</span>
          {!final && <span className="ml-auto text-[12px] text-ink-muted">Updates every 2 seconds</span>}
        </div>
        <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          <Field k="Pipeline">
            <LinkBtn onClick={() => go.pipe(r.pipe)}>{r.pipe}</LinkBtn>
          </Field>
          <Field k="Collection">{D.collection ? <LinkBtn onClick={() => go.collection(D.collection!.name)}>{D.collection.name}</LinkBtn> : 'collection not listed'}</Field>
          <Field k="Data source">
            {srcs.length ? (
              <span className="flex flex-wrap gap-x-2">
                {srcs.map((s) => (
                  <LinkBtn key={s.name} onClick={() => go.source(s.name)}>
                    {s.name}
                  </LinkBtn>
                ))}
              </span>
            ) : (
              '—'
            )}
            {!j.connector_id && srcs.length > 0 && <div className="text-[12px] text-ink-muted">All data sources of the collection</div>}
          </Field>
          <Field k="Started">
            {hhmmss(j.created_at)}
            <div className="text-[12px] text-ink-muted">{r.start}</div>
          </Field>
          <Field k="Duration">{runDuration(j, D.now)}{!final && j.running_at ? ' so far' : ''}</Field>
        </div>
      </div>

      {/* progress */}
      <div className="card px-4 py-3.5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13.5px] font-semibold text-ink-strong">Files</span>
          <span className="text-[13px] text-ink-body">
            {pr.label}
            {pr.percent != null && pr.total ? <span className="ml-2 font-mono text-ink-muted">{pr.percent}%</span> : null}
          </span>
        </div>
        <ProgressBar percent={pr.percent} indeterminate={pr.indeterminate} tone={barTone} />
        {R && (R.succeeded || R.failed || R.cancelled) ? (
          <div className="mt-2 flex flex-wrap gap-4 text-[12.5px] text-ink-muted">
            <span>
              <span className="font-semibold text-success-fg">{R.succeeded}</span> succeeded
            </span>
            <span>
              <span className={cn('font-semibold', R.failed ? 'text-danger-fg' : 'text-ink-body')}>{R.failed}</span> failed
            </span>
            <span>
              <span className="font-semibold text-ink-body">{R.cancelled}</span> cancelled
            </span>
          </div>
        ) : null}
      </div>

      {/* zero files */}
      {zero && <ZeroBox D={D} srcs={srcs} />}

      {/* steps */}
      <div className="card px-4 py-4">
        <div className="mb-3 text-[15px] font-semibold text-ink-strong">Steps</div>
        <Stepper steps={steps} />
        <div className="mt-3 text-[12px] text-ink-muted">
          KAP reports progress for the whole run. The files in each pipeline step are read from the states of the collection&apos;s files{j.connector_id ? ` that came from ${conn}` : ''}.
        </div>
      </div>

      {zero && <WhatNext D={D} srcs={srcs} />}
    </div>
  );
}

function Stepper({ steps }: { steps: RunStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const ic = STEP_ICON[s.state];
        const I = ic.icon;
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden className={cn('absolute bottom-0 left-[11px] top-7 w-px', s.state === 'done' ? 'bg-success' : 'bg-line')} />}
            <span className="relative z-[1] flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface" title={ic.label}>
              <I size={20} strokeWidth={1.75} className={ic.cls} aria-label={ic.label} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={cn('text-[13.5px] font-semibold', s.state === 'pending' || s.state === 'skipped' ? 'text-ink-muted' : 'text-ink-strong')}>{s.title}</span>
                {s.time && <span className="font-mono text-[12px] text-ink-muted">{s.time}</span>}
              </div>
              <div className={cn('text-[13px]', s.state === 'failed' ? 'text-danger-fg' : 'text-ink-muted')}>{s.detail}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ZeroBox({ D, srcs }: { D: LiveRunData; srcs: { name: string; interval: string | null }[] }) {
  const e = D.later ? earlierWork(D.job, D.later) : null;
  const ef = e ? followUp(e, connName(D, e.connector_id), D.ours(e.id)) : null;
  const z = zeroExplanation(srcs, ef);
  return (
    <div className="flex items-start gap-3 rounded-card border border-line-subtle bg-info-bg px-4 py-3.5 text-info">
      <Info size={18} className="mt-0.5 flex-none" />
      <div className="flex flex-col gap-1.5 text-[13px]">
        <div className="text-[14px] font-semibold">{z.title}</div>
        {z.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        {e && (
          <div>
            <LinkBtn onClick={() => D.go.run(runId(e.id))}>
              Open run {runId(e.id)}
              <ChevronRight size={14} />
            </LinkBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function WhatNext({ D, srcs }: { D: LiveRunData; srcs: { name: string; interval: string | null }[] }) {
  const later = D.later;
  const rel = later ? splitRelated(D.job, later) : { before: [], after: [] };
  const fs = rel.after.map((x) => followUp(x, connName(D, x.connector_id), D.ours(x.id)));
  const before = rel.before.map((x) => followUp(x, connName(D, x.connector_id), D.ours(x.id)));
  const scanNames = srcs.map((s) => s.name).join(' or ') || 'the data source';
  return (
    <div className="card px-4 py-4">
      <div className="mb-1 text-[15px] font-semibold text-ink-strong">Other runs of {D.collection?.name ?? 'this collection'}</div>
      <div className="mb-3 text-[13px] text-ink-muted">Runs from 15 minutes before this one onwards, checked every 10 seconds while this page is open.</div>
      {before.length > 0 && (
        <>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Just before</div>
          <ul className="mb-3 flex flex-col gap-2">
            {before.map((f) => (
              <FollowRow key={f.job.id} f={f} D={D} />
            ))}
          </ul>
        </>
      )}
      <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">After</div>
      <ul className="flex flex-col gap-2">
        {fs.map((f) => (
          <FollowRow key={f.job.id} f={f} D={D} />
        ))}
        {later === undefined || later === null ? (
          <li className="flex items-center gap-2 text-[13.5px] text-ink-muted">
            <Loader2 size={16} className="animate-spin" /> Checking for later runs…
          </li>
        ) : !fs.some((f) => f.job.connector_id) ? (
          <li className="flex items-center gap-2 text-[13.5px] text-ink-muted">
            <Loader2 size={16} className="animate-spin text-info" /> Waiting for the next scan of {scanNames}…
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function FollowRow({ f, D }: { f: FollowUp; D: LiveRunData }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-[13.5px]">
      {f.active ? <Loader2 size={16} className="animate-spin text-info" /> : f.outcome === 'found nothing new' ? <MinusCircle size={16} className="text-ink-subtle" /> : <CheckCircle2 size={16} className={f.job.state === 'failed' ? 'text-danger' : 'text-success'} />}
      <span className="text-ink-strong">
        {f.label} {f.outcome}
      </span>
      <LinkBtn onClick={() => D.go.run(runId(f.job.id))}>
        Open run {runId(f.job.id)}
        <ChevronRight size={14} />
      </LinkBtn>
    </li>
  );
}

// ------------------------------------------------------------------ run page: processed items
export function LiveRunItems({ D }: { D: LiveRunData }) {
  const kind = D.pipe?.kind ?? 'document';
  const coll = D.collection?.name ?? '';
  if (D.files === undefined)
    return (
      <div className="card flex items-center gap-2 p-6 text-ink-muted">
        <Loader2 size={16} className="animate-spin" /> Reading the files of {coll || 'the collection'} from KAP…
      </div>
    );
  if (D.files === null) return <div className="card p-6 text-ink-muted">KAP could not list the files of {coll || 'the collection'}. Open the collection in Business Data Hub to see them.</div>;
  const items = runItems(runFiles(D.job, D.files, D.now, kind), D.pipe, coll);
  const active = ['Queued', 'Running'].includes(D.run.st);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] text-ink-muted">
        KAP does not list the files of a run. These are the files of {coll} that changed while the run was going{active ? ', and the ones still being processed' : ''}
        {D.job.connector_id ? `, from ${connName(D, D.job.connector_id)}` : ''}.
      </div>
      <div className="card overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
              {['File', 'Path in the source', 'State', 'Changed', 'Size', ''].map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-[9px] font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.file.id} className={cn('border-t border-line-subtle hover:bg-surface-hover', it.docId && 'cursor-pointer')} onClick={it.docId ? () => D.go.document(it.docId!) : undefined}>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-ink-strong">
                    <FileText size={14} className="text-ink-muted" />
                    {it.file.name}
                  </span>
                </td>
                <td className="max-w-[280px] truncate px-3 py-2.5 text-ink-muted" title={it.file.source_path}>
                  {it.file.source_path || '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className={cn('inline-flex items-center gap-1.5', it.tone === 'ok' ? 'text-success-fg' : it.tone === 'bad' ? 'text-danger-fg' : 'text-info')}>
                    {it.tone === 'ok' ? <CheckCircle2 size={14} /> : it.tone === 'bad' ? <XCircle size={14} /> : <Loader2 size={14} className="animate-spin" />}
                    {it.result}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px] text-ink-muted">{hhmmss(it.file.content_changed_at)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{size(it.file.size_bytes)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">{it.docId && <LinkBtn onClick={() => D.go.document(it.docId!)}>Open document</LinkBtn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="p-7 text-center text-ink-muted">
            {isZeroRun(D.job) ? 'No files: the run found nothing new to process.' : active ? 'No files are being processed yet.' : 'No file of the collection changed while the run was going.'}
          </div>
        )}
      </div>
    </div>
  );
}

function size(b: number | string | null | undefined): string {
  const n = Number(b);
  if (b == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ------------------------------------------------------------------ run list
export interface LiveRunsTableProps {
  runs: Run[];
  srcOf: (r: Run) => string;
  go: IngestNav;
  canCancel: (r: Run) => boolean;
  cancel: (r: Run) => void;
  empty: string;
}

function RunProgressCell({ r }: { r: Run }) {
  const K = kapOfRun(r);
  if (!K) return <span className="text-ink-body">{`${r.inN} → ${r.outN}`}</span>;
  const active = K.state === 'waiting' || K.state === 'running';
  if (active) {
    const pr = progressOf({ state: K.state, progress: { total: K.total, completed: K.completed, percent: K.percent } });
    return (
      <div className="flex min-w-[150px] flex-col gap-1">
        <span className="text-[12.5px] text-ink-body">{K.state === 'waiting' && K.total == null && !K.completed ? 'Waiting for a worker' : pr.label}</span>
        <ProgressBar percent={pr.percent} indeterminate={pr.indeterminate} thin />
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="text-ink-body">{r.outN}</span>
      <span className="text-[12px] text-ink-muted">{r.inN}</span>
    </div>
  );
}

export function liveRunsSection(p: LiveRunsTableProps): Section {
  return { custom: <LiveRunsTable {...p} /> };
}

export function LiveRunsTable({ runs, srcOf, go, canCancel, cancel, empty }: LiveRunsTableProps) {
  return (
    <div className="card overflow-auto">
      <table className="w-full min-w-[920px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
            {['Status', 'Run', 'Pipeline · collection', 'Data source', 'Started', 'Duration', 'Files', ''].map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-[9px] font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const K = kapOfRun(r);
            return (
              <tr key={r.id} onClick={() => go.run(r.id)} className="cursor-pointer border-t border-line-subtle align-top hover:bg-surface-hover">
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-ink-strong">
                    <RunStatusIcon st={r.st} />
                    {r.st}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-mono font-semibold text-ink-strong">{r.id}</div>
                  <div className="text-[12px] text-ink-muted">{r.trig}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-ink-strong">{r.pipe}</div>
                  {K && <div className="text-[12px] text-ink-muted">{K.collection}</div>}
                </td>
                <td className="px-3 py-2.5 text-ink-body">{srcOf(r) || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="text-ink-body">{r.start}</div>
                  {K && <div className="font-mono text-[12px] text-ink-muted">{hhmm(K.createdAt)}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-body">{r.dur.replace(' (running)', '')}</td>
                <td className="px-3 py-2.5">
                  <RunProgressCell r={r} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {canCancel(r) && (
                    <button
                      type="button"
                      className="mr-3 font-medium text-brand hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancel(r);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <ChevronRight size={15} className="inline text-ink-muted" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!runs.length && <div className="p-7 text-center text-ink-muted">{empty}</div>}
    </div>
  );
}
