/**
 * One workflow run (live tenant, platform API) as a ScreenModel: the request
 * and the answer, a step per graph node in the order they ran (input, output,
 * note, KAP trace), and the decision for a step that waits for a person.
 */
import { act, cell, fr } from '@/engine/build';
import type { Row, ScreenModel, Section } from '@/engine/types';
import type { WfRunRec, WfRunStep } from '@/api/platformWf';
import { relTime } from '@/features/v35/agents/fromKap';
import { KL } from './model';
import { stP } from './logic';
import { fmtDur, isActiveWfRun, runSt, stepSt } from './wfLive';

export interface WfRunCtx {
  run: WfRunRec | undefined;
  loading: boolean;
  error: string | null;
  missing: boolean;
  now: number;
  /** may decide human steps and cancel runs */
  canExec: boolean;
  go: { workflow: () => void; trace: (jobId: string) => void; replay: () => void };
  a: { approve: (s: WfRunStep) => void; reject: (s: WfRunStep) => void; cancel: () => void; addCase?: () => void };
}

const STEP_P: Record<WfRunStep['status'], ReturnType<typeof stP>> = {
  pending: ['draft', 'Pending'],
  running: ['submitted', 'Running'],
  waiting: ['hold', 'Waiting for review'],
  done: ['approved', 'Succeeded'],
  failed: ['rejected', 'Failed'],
  skipped: ['draft', 'Skipped'],
};

const ms = (a: string | null, b: string | null) => (a && b ? Math.max(0, Date.parse(b) - Date.parse(a)) : null);
const trunc = (s: string, n = 120) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function wfRunScreen(c: WfRunCtx, title: string): ScreenModel {
  const r = c.run;
  if (c.missing) return { head: { title }, sections: [{ callout: 'The platform API on the test stand does not have workflows yet — update platform-api (migration 0007).' }] };
  if (!r) return { head: { title, acts: [act('Back to workflow', c.go.workflow)] }, sections: [{ callout: c.error ? `Could not load the run: ${c.error}` : c.loading ? 'Loading the run…' : 'No such run.' }] };
  const steps = r.steps ?? [];
  const ran = steps.filter((s) => s.seq != null).sort((a, b) => a.seq! - b.seq!);
  const notRun = steps.filter((s) => s.seq == null);
  const waiting = steps.filter((s) => s.status === 'waiting');
  const active = isActiveWfRun(r);
  const sections: Section[] = [];
  for (const s of waiting)
    sections.push({
      title: `Waiting for a person · ${s.label}`,
      note: s.kind === 'fallback' ? 'The workflow could not answer on its own. Write the answer to return, or reject.' : 'Check the answer below. Approve it as it is or edited, or reject it.',
      sacts: c.canExec ? [act('Approve', () => c.a.approve(s), 'primary'), act('Reject', () => c.a.reject(s))] : [],
      form: true,
      rows: [fr('Answer to review', s.input || '—', s.note || '')],
    });
  if (r.status === 'failed') sections.push({ callout: `The run failed: ${r.error ?? 'no reason given'}` });
  sections.push({
    form: true,
    title: 'Run',
    rows: [
      fr('Request', r.input),
      fr('Answer', r.answer || (active ? 'Not answered yet' : '—'), r.fallback_used ? 'Produced by the fallback' : ''),
      fr('Version', r.version, r.trigger === 'test' ? 'Test run' : `Started by ${r.trigger}`),
      fr('Started', relTime(r.started_at ?? r.created_at, c.now), r.created_by ? `by ${r.created_by}` : ''),
      fr('Duration', r.finished_at ? fmtDur(ms(r.started_at ?? r.created_at, r.finished_at)) : active ? 'Running' : '—', `${r.agent_jobs} agent ${r.agent_jobs === 1 ? 'job' : 'jobs'} in KAP`),
    ],
  });
  const row = (s: WfRunStep, i: number | null): Row => ({
    key: 'st:' + s.node_id,
    cells: [
      cell(i == null ? '—' : String(i + 1)),
      cell(s.label, { sub: KL[s.kind] ?? s.kind }),
      cell('', { p: STEP_P[s.status] }),
      cell(trunc(s.note || (s.output ?? '') || '—', 110)),
      cell(fmtDur(ms(s.started_at, s.finished_at))),
    ],
    kv: [
      { k: 'Status', v: stepSt(s) + (s.attempts > 1 ? ` (attempt ${s.attempts})` : '') },
      ...(s.note ? [{ k: 'Detail', v: s.note }] : []),
      ...(s.input && s.kind !== 'entry' ? [{ k: s.kind === 'agent' || s.kind === 'aggregate' ? 'Prompt sent to the agent' : 'Input', v: s.input }] : []),
      ...(s.output ? [{ k: 'Output', v: s.output }] : []),
      ...(s.chosen?.length ? [{ k: 'Paths taken', v: s.chosen.join(', '), mono: true }] : []),
      ...(s.job_id ? [{ k: 'KAP job', v: s.job_id, mono: true }] : []),
    ],
    keepKv: true,
    acts: [
      ...(s.job_id ? [act('Open trace', () => c.go.trace(s.job_id!))] : []),
      ...(s.status === 'waiting' && c.canExec ? [act('Approve', () => c.a.approve(s), 'primary'), act('Reject', () => c.a.reject(s))] : []),
    ],
  });
  sections.push({
    title: 'Steps',
    badge: String(ran.length),
    note: 'In the order they ran. Click a step for its prompt, output and trace.',
    mode: 'panel',
    cols: ['#', 'Step', 'Status', 'Detail', 'Time'],
    rows: ran.map((s, i) => row(s, i)),
    empty: active ? 'Starting…' : 'No step ran.',
  });
  if (notRun.length)
    sections.push({ title: 'Not run', note: 'Steps on paths this request did not take.', mode: 'panel', cols: ['#', 'Step', 'Status', 'Detail', 'Time'], rows: notRun.map((s) => row(s, null)) });
  return {
    head: {
      title,
      status: stP(runSt(r)),
      sub: `${r.workflow_name ?? r.workflow_id} · ${r.version}`,
      acts: [
        act('Back to workflow', c.go.workflow),
        act('Replay on canvas', c.go.replay),
        ...(!active && c.a.addCase ? [act('Add to test set', c.a.addCase)] : []),
        ...(active && c.canExec ? [act('Cancel run', c.a.cancel)] : []),
      ],
    },
    sections,
  };
}
