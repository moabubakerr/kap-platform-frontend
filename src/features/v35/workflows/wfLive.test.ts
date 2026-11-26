import { describe, expect, it, vi } from 'vitest';
import type { WfRunRec, WfRunStep } from '@/api/platformWf';
import { PgApiError } from '@/api/platformPg';
import { docOf, fromDoc, metricsOf, pathOf, runToSim, startError, toWfRun } from './wfLive';
import { wfRunScreen, type WfRunCtx } from './wfRunBuild';

const NOW = Date.parse('2026-11-26T12:00:00Z');

function step(node_id: string, kind: string, status: WfRunStep['status'], seq: number | null, over: Partial<WfRunStep> = {}): WfRunStep {
  return { node_id, kind, label: node_id, status, seq, input: null, output: null, note: null, chosen: null, job_id: null, attempts: 0, started_at: null, finished_at: null, ...over };
}

function run(over: Partial<WfRunRec> = {}): WfRunRec {
  return {
    id: 'r1', workflow_id: 'wf', workflow_name: 'WF', version: 'v1', trigger: 'test', input: 'Q?', status: 'succeeded', answer: 'A', error: null, fallback_used: false, agent_jobs: 1,
    created_by: 'me', created_at: '2026-11-26T11:59:00Z', started_at: '2026-11-26T11:59:00Z', finished_at: '2026-11-26T11:59:04Z', ...over,
  };
}

describe('mapping platform runs', () => {
  it('orders the path by run order and marks failures', () => {
    const p = pathOf([
      { node_id: 'out', status: 'done', seq: 3 },
      { node_id: 'in', status: 'done', seq: 0 },
      { node_id: 'doc', status: 'skipped', seq: null },
      { node_id: 'a', status: 'failed', seq: 1 },
      { node_id: 'fb', status: 'done', seq: 2 },
    ]);
    expect(Object.entries(p)).toEqual([['in', 'ok'], ['a', 'bad'], ['fb', 'ok'], ['out', 'ok'], ['doc', 'skip']]);
  });

  it('turns a run into the designer’s test overlay', () => {
    const r = run({
      status: 'running',
      answer: null,
      finished_at: null,
      steps: [step('in', 'entry', 'done', 0), step('a', 'agent', 'done', 1, { output: 'Inflation 4.17%', note: 'KAP job 1234 answered' }), step('b', 'agent', 'running', 2), step('out', 'output', 'pending', null)],
    });
    const s = runToSim(r);
    expect(s.running).toBe(true);
    expect(s.stepI).toBe(2);
    expect(s.steps.map((x) => [x[0], x[2], x[4]])).toEqual([['in', 'Succeeded', 'in'], ['a', 'Succeeded', 'a'], ['b', 'Running', 'b']]);
    expect(s.steps[1][3]).toBe('KAP job 1234 answered · Inflation 4.17%');
    expect(Object.keys(s.path)).toEqual(['in', 'a', 'b', 'out']);
    expect(runToSim(run({ fallback_used: true, steps: [] })).st).toBe('Succeeded with fallback');
  });

  it('lists runs and computes metrics', () => {
    const w = toWfRun(run({ path: [['in', 'done', 0], ['a', 'failed', 1]], status: 'failed', error: 'boom', created_by: null }), NOW);
    expect(w).toMatchObject({ id: 'r1', wf: 'wf', st: 'Failed', caller: 'Test', reason: 'boom', dur: '4.0 s', at: '1 min ago', path: { in: 'ok', a: 'bad' } });
    expect(toWfRun(run({ status: 'waiting' }), NOW).st).toBe('Waiting for review');
    const m = metricsOf([run(), run({ id: 'r2', status: 'failed' }), run({ id: 'r3', fallback_used: true }), run({ id: 'old', created_at: '2026-10-01T00:00:00Z' })], NOW);
    expect(m).toEqual([3, 67, '4.0 s', '50%', 0]);
  });

  it('round-trips the workflow document', () => {
    const rec = { id: 'wf', doc: { n: 'WF', purpose: 'p', entry: 'Chat', evSets: [], dis: null, thr: {}, vers: [{ v: 'v1', st: 'Draft', at: 'now', by: 'me', note: '', cfg: null }] }, last_run: null, created_at: '', updated_at: '' };
    const w = fromDoc(rec, [], NOW);
    expect(w.id).toBe('wf');
    expect(w.m).toEqual([0, 0, '—', '—', 0]);
    expect(docOf(w)).toEqual(rec.doc);
  });

  it('explains a refused run', () => {
    expect(startError(new PgApiError(422, 'workflow_invalid', 'The workflow cannot run: x', { problems: ['ghost: no such agent in KAP.', 'Set the condition for the path r → a.'] }))).toBe(
      'The workflow cannot run: ghost: no such agent in KAP. Set the condition for the path r → a.',
    );
    expect(startError(new PgApiError(409, 'disabled', 'The workflow is disabled: x.'))).toBe('The workflow is disabled: x.');
  });
});

describe('run page', () => {
  const ctx = (r: WfRunRec | undefined, over: Partial<WfRunCtx> = {}): WfRunCtx => ({
    run: r, loading: false, error: null, missing: false, now: NOW, canExec: true,
    go: { workflow: vi.fn(), trace: vi.fn(), replay: vi.fn() }, a: { approve: vi.fn(), reject: vi.fn(), cancel: vi.fn() }, ...over,
  });

  it('shows steps in run order, the steps not run, and a waiting review', () => {
    const r = run({
      status: 'waiting',
      answer: null,
      finished_at: null,
      steps: [
        step('h', 'review', 'waiting', 2, { input: 'Draft 4.17%', note: 'Waiting for a reviewer' }),
        step('in', 'entry', 'done', 0),
        step('a', 'agent', 'done', 1, { job_id: 'job-1', input: 'Q?', output: 'Draft 4.17%' }),
        step('doc', 'agent', 'skipped', null),
      ],
    });
    const c = ctx(r);
    const m = wfRunScreen(c, 'WF · run');
    expect(m.head.status).toEqual(['hold', 'Waiting for review']);
    expect(m.head.acts!.map((x) => x.l)).toEqual(['Back to workflow', 'Replay on canvas', 'Cancel run']);
    expect(m.sections[0].title).toBe('Waiting for a person · h');
    expect(m.sections[0].sacts!.map((x) => x.l)).toEqual(['Approve', 'Reject']);
    const steps = m.sections.find((s) => s.title === 'Steps')!;
    expect(steps.rows!.map((x) => x.key)).toEqual(['st:in', 'st:a', 'st:h']);
    const a = steps.rows![1];
    expect(a.kv!.map((k) => k.k)).toEqual(['Status', 'Prompt sent to the agent', 'Output', 'KAP job']);
    a.acts![0].f();
    expect(c.go.trace).toHaveBeenCalledWith('job-1');
    expect(m.sections.find((s) => s.title === 'Not run')!.rows!.map((x) => x.key)).toEqual(['st:doc']);
  });

  it('says why a run failed, and handles missing data', () => {
    const m = wfRunScreen(ctx(run({ status: 'failed', error: 'a: boom', steps: [] })), 'WF · run');
    expect(m.sections[0].callout).toBe('The run failed: a: boom');
    expect(wfRunScreen(ctx(undefined, { loading: true }), 'x').sections[0].callout).toBe('Loading the run…');
    expect(wfRunScreen(ctx(undefined, { missing: true }), 'x').sections[0].callout).toMatch(/does not have workflows yet/);
  });
});
