import { describe, expect, it, vi } from 'vitest';
import type { EvalRun } from '@/api/platformEval';
import { runScreen, schedulesSection, workflowEvalSections, type EvalCtx } from './evalBuild';
import type { EvalState } from './evalLive';
import { numbersOf, passTrend, runPill, scheduleText, stableJson, targetLabel, wfGate } from './evalView';
import { matches, targetOptions, whenOf } from './useEvals';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const CFG = { nodes: [['in', 'entry', 'Request', '']], edges: [], np: { a: { retries: '0' } } };
const SUM = (passed: number, total = 4) => ({ total, done: total, passed, failed: total - passed, errors: 0, pass_rate: passed / total, checks_passed: 0, checks_total: 0, correctness: null, grounding: null, completeness: null, judged: 0, latency_ms_avg: null, latency_ms_p95: null, tokens_total: null, tool_errors: 0 });

function wfRun(id: string, over: Partial<EvalRun> = {}): EvalRun {
  return {
    id, set_id: 's1', set_name: 'QA', target_kind: 'workflow', agent_id: null, agent_name: 'Indicator answer', workflow_id: 'ind_answer', version: 'v2', trigger: 'manual', regressed: null, regress_reason: null,
    agent: { kind: 'workflow', version: 'v2', status: 'Draft', cfg: { np: { a: { retries: '0' } }, edges: [], nodes: [['in', 'entry', 'Request', '']] } },
    label: '', options: { judge: true, min_correctness: 4, min_grounding: 0, parallel: 2 }, status: 'succeeded', summary: SUM(4), error: null,
    created_at: '2026-11-26T11:00:00Z', started_at: null, finished_at: '2026-11-26T11:01:00Z', ...over,
  };
}

describe('targets and gate', () => {
  it('labels targets and regressions', () => {
    expect(targetLabel(wfRun('a'))).toBe('Indicator answer · v2');
    expect(runPill(wfRun('a', { regressed: true, summary: SUM(3) }))).toEqual(['rejected', 'Regressed']);
    expect(runPill(wfRun('a', { regressed: false, summary: SUM(3) }))).toEqual(['hold', '1 failed']);
  });

  it('compares configurations whatever the key order', () => {
    expect(stableJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stableJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  });

  it('gates a draft on an evaluation of exactly that draft', () => {
    expect(wfGate([], 'ind_answer', 'v2', CFG).text).toBe('Not evaluated: run a test set against v2');
    expect(wfGate([wfRun('a')], 'ind_answer', 'v2', CFG)).toMatchObject({ ok: true, text: 'Passed: 100% of QA' });
    expect(wfGate([wfRun('a', { summary: SUM(3) })], 'ind_answer', 'v2', CFG)).toMatchObject({ ok: false, text: 'Pass rate 75% is below 80%' });
    expect(wfGate([wfRun('a')], 'ind_answer', 'v2', { ...CFG, edges: [['in', 'a', 'seq', '', '']] })).toMatchObject({ ok: false, text: 'Changed after the last evaluation of v2: evaluate it again' });
    expect(wfGate([wfRun('a', { status: 'running' })], 'ind_answer', 'v2', CFG).text).toBe('Evaluation running');
    expect(wfGate([wfRun('a', { version: 'v1' })], 'ind_answer', 'v2', CFG).ok).toBe(false);
  });

  it('builds the trend and the schedule wording', () => {
    expect(passTrend([wfRun('b', { created_at: '2026-11-26T11:00:00Z', summary: SUM(2) }), wfRun('a', { created_at: '2026-11-25T11:00:00Z', summary: SUM(4) }), wfRun('c', { status: 'running' })])).toEqual([1, 0.5]);
    expect(scheduleText({ every_minutes: 1440, on_data: true, min_pass_rate: 0.8, enabled: true })).toBe('Every day and after new data · below 80% is a regression');
    expect(scheduleText({ every_minutes: null, on_data: true, min_pass_rate: null, enabled: false })).toBe('After new data · paused');
  });

  it('suggests the numbers of an answer as facts, without years', () => {
    expect(numbersOf('Inflation was 2.62% in April 2026; Qatar 4.17% vs Kuwait 2.06%, 7,984 rows, again 2.62%.')).toEqual(['2.62', '4.17', '2.06', '7,984']);
  });

  it('offers agents and workflow versions as targets', () => {
    const opts = targetOptions([{ id: 'ag1', name: 'ind_agent' }], [{ id: 'w', name: 'W', versions: [{ v: 'v2', st: 'Draft' }, { v: 'v1', st: 'Published' }] }], true);
    expect(opts.map((o) => o.label)).toEqual(['Agent: ind_agent', 'Workflow: W · v2 (draft)', 'Workflow: W · v1 (published)']);
    expect(opts.find((o) => matches(o, { workflowId: 'w', version: 'v1' }))?.version).toBe('v1');
    expect(targetOptions([], [{ id: 'w', name: 'W', versions: [] }], false).map((o) => o.label)).toEqual(['Workflow: W']);
    expect(whenOf({ every: 'Every week', data: 'No', min: '90%' })).toEqual({ every_minutes: 10080, on_data: false, min_pass_rate: 0.9 });
  });
});

describe('screens', () => {
  const st: EvalState = {
    missing: false,
    sets: [{ id: 's1', name: 'QA', description: '', case_count: 4, last_run: null, created_at: '', updated_at: '' }],
    runs: [wfRun('b', { regressed: true, regress_reason: 'Pass rate 100% → 75% · Now failing: Q1?', summary: SUM(3) }), wfRun('a', { created_at: '2026-11-25T11:00:00Z' })],
    schedules: [{ id: 'sc', set_id: 's1', target_kind: 'workflow', agent_id: null, workflow_id: 'ind_answer', every_minutes: null, on_data: true, min_pass_rate: null, options: {}, enabled: true, next_run_at: null, data_seen_at: null, last_run_id: 'b', created_at: '', updated_at: '' }],
    workflows: [{ id: 'ind_answer', name: 'Indicator answer', versions: [{ v: 'v2', st: 'Draft' }] }],
    set: {},
    run: { b: { ...wfRun('b', { regressed: true, regress_reason: 'Pass rate 100% → 75%' }), results: [{ id: 'x', case_id: 'c', position: 0, question: 'Q1?', expected: '', must_include: [], must_not_include: [], status: 'scored', job_id: null, wf_run_id: 'wr1', job_status: 'succeeded', answer: 'A', checks: [], judge: null, passed: true, reason: null, metrics: { steps: ['Request (entry): done'] }, error: null, submitted_at: null, answered_at: null, scored_at: null }] } },
  };
  const ctx = (): EvalCtx => ({
    st, loading: false, error: null, now: NOW, canEdit: true, canRun: true, agents: [], workflows: st.workflows,
    a: Object.fromEntries(['run', 'addSchedule', 'editSchedule', 'deleteSchedule', 'cancel', 'removeRun', 'compareWith', 'useAnswer'].map((k) => [k, vi.fn()])) as unknown as EvalCtx['a'],
    go: Object.fromEntries(['sets', 'set', 'run', 'agent', 'trace', 'workflow', 'wfRun'].map((k) => [k, vi.fn()])) as unknown as EvalCtx['go'],
  });

  it('shows a workflow run with its regression and the workflow run of each question', () => {
    const c = ctx();
    const m = runScreen(c, 'b');
    expect(m.head.title).toBe('QA · Indicator answer · v2');
    expect(m.sections[0].callout).toMatch(/^Regressed against the previous run: Pass rate 100% → 75%/);
    const q = m.sections.find((s) => s.title === 'Questions')!.rows![0];
    expect(q.acts!.map((x) => x.l)).toEqual(['Open workflow run']);
    q.acts![0].f();
    expect(c.go.wfRun).toHaveBeenCalledWith('ind_answer', 'wr1');
    expect(q.kv!.find((k) => k.k === 'Workflow steps')!.v).toBe('Request (entry): done');
    m.head.add!.f();
    expect(c.a.run).toHaveBeenCalledWith({ setId: 's1', workflowId: 'ind_answer', version: 'v2' });
  });

  it('shows the workflow tab: gate, regression, runs with trend, automatic runs', () => {
    const s = workflowEvalSections(ctx(), 'ind_answer', { v: 'v2', cfg: CFG });
    expect(s.map((x) => x.title)).toEqual([undefined, 'Publish gate · draft v2', undefined, 'Evaluation runs', 'Automatic runs']);
    expect(s[1].rows![0].cells[1].p).toEqual(['hold', 'Pass rate 75% is below 80%']);
    expect(s[2].callout).toMatch(/latest evaluation regressed/);
    expect(s[3].note).toBe('Pass rate over the last runs · Indicator answer: 100% → 75%');
    expect(s[4].rows![0].cells.map((x) => x.v)).toEqual(['QA', 'Indicator answer (published version)', 'After new data', 'When new data arrives', '']);
  });

  it('lists automatic runs with their actions', () => {
    const sec = schedulesSection(ctx(), st.schedules, { workflowId: 'ind_answer' });
    expect(sec.sacts!.map((x) => x.l)).toEqual(['Add automatic run']);
    expect(sec.rows![0].acts!.map((x) => x.l)).toEqual(['Open run', 'Edit', 'Delete']);
  });
});
