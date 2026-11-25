/**
 * Monitoring & Insights (v35): Jobs, Traces and run details as ScreenModels.
 * Built from the console's Job and Trace shapes, so the same builders serve
 * mock tenants and live ones (sandbox, from the platform API).
 */
import { act, cell, fr, kv, statusPill } from '@/engine/build';
import type { Filters, PageHead, Row, ScreenModel, Section, TimelineSpan } from '@/engine/types';
import type { Trace, TraceSpan } from '@/mocks/traces';
import type { Job } from '@/types';

export const MONITOR_TABS = [
  { value: 'jobs', label: 'Jobs' },
  { value: 'traces', label: 'Traces' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'gaps', label: 'Knowledge Gaps' },
];

const STATUS: Record<Job['status'], string> = { running: 'Running', succeeded: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled', queued: 'Queued' };

export interface JobFilters {
  q: string;
  kind: string;
  status: string;
}
export const JOB_FILTERS_DEFAULT: JobFilters = { q: '', kind: 'All executions', status: 'Any status' };

interface Ctx {
  head: PageHead;
  live: boolean;
  openRun: (id: string, tab?: string) => void;
  openAgent: (agent: string) => void;
}

function matches(j: Job, f: JobFilters) {
  const q = f.q.trim().toLowerCase();
  return (
    (f.kind === 'All executions' || f.kind === 'Agent jobs') &&
    (f.status === 'Any status' || STATUS[j.status] === f.status) &&
    (!q || `${j.id} ${j.agent} ${j.question} ${j.user}`.toLowerCase().includes(q))
  );
}

function jobFiltersModel(f: JobFilters, set: (f: JobFilters) => void, count: string, statusOpts = ['Any status', 'Running', 'Succeeded', 'Failed', 'Cancelled']): Filters {
  return {
    q: f.q,
    qPlaceholder: 'Job ID, agent, workflow, caller or request',
    setQ: (q) => set({ ...f, q }),
    main: [
      { label: 'Execution type', value: f.kind, options: ['All executions', 'Agent jobs', 'Workflow runs', 'Reproductions'], onChange: (kind) => set({ ...f, kind }) },
      { label: 'Status', value: f.status, options: statusOpts, onChange: (status) => set({ ...f, status }) },
    ],
    count,
  };
}

const short = (id: string) => (id.length > 12 ? id.slice(0, 8) : id);

export function jobsScreen(jobs: Job[], f: JobFilters, setF: (f: JobFilters) => void, c: Ctx): ScreenModel {
  const rows = jobs.filter((j) => matches(j, f)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const ok = jobs.filter((j) => j.status === 'succeeded').length;
  const stats: Section = {
    stats: [
      { k: 'Executions · 7 d', v: String(jobs.length), c: '#8C8487' },
      { k: 'Succeeded', v: `${Math.round((ok / Math.max(jobs.length, 1)) * 100)}%`, c: 'var(--success)' },
      { k: 'Failed', v: String(jobs.filter((j) => j.status === 'failed').length), c: 'var(--danger)' },
      { k: 'Running', v: String(jobs.filter((j) => j.status === 'running' || j.status === 'queued').length), c: 'var(--info)' },
      { k: c.live ? 'Traced' : 'Under investigation', v: c.live ? String(jobs.filter((j) => j.traceStatus === 'linked').length) : String(jobs.filter((j) => j.status === 'failed').length), c: c.live ? 'var(--brand)' : 'var(--warning)' },
    ],
  };
  const table: Section = {
    empty: f.q || f.status !== 'Any status' || f.kind !== 'All executions' ? 'No executions match.' : 'No executions yet.',
    cols: ['Job', 'Type', 'Agent or workflow', 'Version', 'Caller', 'Status', 'Duration', c.live ? 'Trace' : 'Investigation', 'Started'],
    mode: 'inline',
    rows: rows.map(
      (j): Row => ({
        key: `j:${j.id}`,
        cells: [
          cell(short(j.id), { m: true, tip: j.uuid }),
          cell('Agent'),
          cell(j.agent, { sub: j.question.slice(0, 70) + (j.question.length > 70 ? '…' : '') }),
          cell(c.live ? 'Current' : 'v6'),
          cell(j.user, { m: true }),
          cell('', { p: statusPill(STATUS[j.status]), tip: j.reason }),
          cell(j.duration),
          cell(c.live ? traceLabel(j) : j.status === 'failed' ? '1 of 4 done' : 'Not started'),
          cell(j.rel, { tip: j.abs }),
        ],
        acts: [act('Open', () => c.openRun(j.id))],
        onClick: () => c.openRun(j.id),
      }),
    ),
  };
  return { head: c.head, filters: jobFiltersModel(f, setF, `${rows.length} of ${jobs.length} executions`), sections: [stats, table] };
}

function traceLabel(j: Job) {
  switch (j.traceStatus) {
    case 'linked':
      return `Linked · ${j.traceCalls} model calls`;
    case 'pending':
      return 'Linking…';
    case 'ambiguous':
      return 'Ambiguous';
    default:
      return 'Not traced';
  }
}

export function tracesScreen(jobs: Job[], f: JobFilters, setF: (f: JobFilters) => void, c: Ctx): ScreenModel {
  const visible = c.live ? jobs.filter((j) => j.traceStatus === 'linked') : jobs;
  const rows = visible.filter((j) => matches(j, f)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return {
    head: c.head,
    filters: { ...jobFiltersModel(f, setF, `${rows.length} of ${visible.length} traces`), main: jobFiltersModel(f, setF, '').main.slice(0, 1) },
    sections: [
      {
        empty: c.live ? 'No traced runs yet. Runs are traced once their model calls go through the platform gateway.' : 'No traces match the filters.',
        cols: ['Trace', 'Root', 'Spans', 'Errors', 'Duration', 'Started'],
        mode: 'inline',
        rows: rows.map(
          (j): Row => ({
            key: `tr:${j.id}`,
            cells: [
              cell(short(j.id), { m: true, tip: j.uuid }),
              cell(j.agent, { sub: 'Agent · current' }),
              cell(c.live ? String(Math.max(1, (j.traceCalls ?? 0) * 2)) : String(j.toolCalls + j.modelRequests + 1)),
              cell('', { p: j.status === 'failed' ? ['rejected', '1 error'] : ['approved', 'None'] }),
              cell(j.duration),
              cell(j.rel, { tip: j.abs }),
            ],
            acts: [act('Open trace', () => c.openRun(j.id, 'trace'))],
            onClick: () => c.openRun(j.id, 'trace'),
          }),
        ),
      },
    ],
  };
}

// ------------------------------------------------------------------ run detail
export const RUN_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'trace', label: 'Path and Trace' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'repro', label: 'Reproductions' },
];

const SPAN_COLOR = (s: TraceSpan) => (s.state === 'error' || s.error ? 'var(--danger)' : s.kind === 'Model call' ? 'var(--brand)' : s.kind === 'Tool' ? 'var(--info)' : 'var(--text-subtle)');
const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

export function runSpans(t: Trace, selected: string | null, select: (id: string) => void): TimelineSpan[] {
  const total = Math.max(...t.spans.map((s) => s.startMs + s.durMs), 1);
  return t.spans.map((s) => ({
    n: s.kind === 'Model call' ? `Model call · ${s.name === 'compose answer' ? 'answer' : 'plan'}` : s.kind === 'Queue wait' ? 'Queue wait' : s.name,
    sub: s.kind === 'Model call' ? `${(s.input as { model?: string })?.model ?? 'model'}${s.tokens ? ` · ${s.tokens[0].toLocaleString('en-GB')} in / ${s.tokens[1]} out` : ''}` : s.kind === 'Queue wait' ? 'kap.agent' : `Tool call · ${s.error ? 'Failed' : 'Succeeded'} · ${s.source === 'oxford' ? 'external' : s.source === 'documents' ? 'documents' : 'local data'}`,
    l: `${((s.startMs / total) * 100).toFixed(2)}%`,
    w: `${Math.max((s.durMs / total) * 100, 0.8).toFixed(2)}%`,
    d: fmt(s.durMs),
    c: SPAN_COLOR(s),
    onClick: () => select(s.id),
    selected: s.id === selected,
  }));
}

export function runOverview(t: Trace, c: { openAgent: (a: string) => void; live: boolean }): Section[] {
  const j = t.job;
  const meters = Object.fromEntries(t.meters.map((m) => [m.k, m.v]));
  return [
    {
      form: true,
      title: 'Execution',
      rows: [
        fr('Agent', j.agent, c.live ? 'Current configuration in KAP' : 'Version v6', [act('Open configuration', () => c.openAgent(j.agent))]),
        { ...fr('Status', '', t.reason ?? ''), cells: [cell('Status'), cell('', { p: statusPill(t.statusLabel) })] },
        fr('Request', t.prompt, ''),
        fr('Answer', t.answer ? t.answer.map((p) => (typeof p === 'string' ? p : p.v)).join('') : '—', 'Output record · access-controlled'),
        ...(t.grounding
          ? [{ ...fr('Evidence', '', t.grounding.text), cells: [cell('Evidence'), cell('', { p: t.grounding.tone === 'ok' ? ['approved', 'Backed by data'] : t.grounding.tone === 'warn' ? ['review', 'Model only'] : ['rejected', 'Not backed by data'], sub: t.grounding.text })] }]
          : []),
        fr('Caller', j.user, "Ran with this identity's permissions"),
        fr('Timing', `${t.createdRel} · ${t.duration}`, t.createdAbs),
        fr('Limits', `${meters['Model requests'] ?? '—'} model requests · ${meters['Tool calls'] ?? '—'} tool calls`, meters['Elapsed vs timeout'] ? `Elapsed vs timeout ${meters['Elapsed vs timeout']}` : ''),
        fr('Data-leak guard', t.leak.text, ''),
        fr('Queue and retries', `${t.queue} · ${t.retries} ${t.retries === 1 ? 'retry' : 'retries'}`, ''),
      ],
    },
  ];
}

export function runEvidence(t: Trace): Section[] {
  const local = t.provenance.local.map(
    (r): Row => ({
      key: `ev:${r.ref}`,
      cells: [cell(r.indicator, { sub: r.ref }), cell(r.period), cell(`${r.actual}${r.target ? ` vs ${r.target}` : ''} ${r.unit}`), cell(r.org, { sub: r.fileRow })],
      kv: kv([['Reference', r.ref], ['Indicator', r.indicator], ['Period', r.period], ['Actual', `${r.actual} ${r.unit}`], ['Target', r.target ?? 'No target'], ['Source organisation', r.org], ['File · row', r.fileRow, true]]),
      keepKv: true,
    }),
  );
  const docs = t.provenance.docs.map((d): Row => ({ key: `doc:${d.ref}`, cells: [cell(d.doc, { sub: d.ref }), cell(d.section), cell(d.passage)] }));
  return [
    { title: 'Retrieved evidence and citations', empty: 'No evidence retrieved.', cols: ['Indicator', 'Period', 'Actual vs target', 'Source'], rows: local },
    ...(docs.length ? [{ title: 'Document context', cols: ['Document', 'Section', 'Passage'], rows: docs } as Section] : []),
    ...(t.provenance.external ? [{ form: true, title: 'External source', rows: [fr('Tool', t.provenance.external.tool), fr('Question sent', t.provenance.external.question), fr('Value', t.provenance.external.value)] } as Section] : []),
  ];
}

export function runRepro(t: Trace): Section[] {
  return [
    { title: 'Reproduction attempts', empty: 'Not reproduced yet.', cols: ['Reproduction', 'Configuration', 'Result', 'Detail', 'When'], rows: [] },
    { form: true, title: 'Original execution', rows: [fr('Run', t.job.id, `Recorded ${t.createdRel} · not changed by reproductions`), fr('Result', t.statusLabel, t.reason ?? '')] },
  ];
}
