import { describe, expect, it, vi } from 'vitest';
import type { EvalResult, EvalRun } from '@/api/platformEval';
import { agentEvalSections, runScreen, setScreen, setsScreen, type EvalCtx } from './evalBuild';
import type { EvalState } from './evalLive';
import { agentChanges, caseProblem, compareHeadline, compareRuns, fmtMs, parseCasesCsv, parseCsv, parseTerms, previousRun, resultPill, runOutcome, runPill, summaryStats } from './evalView';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const SUM = { total: 3, done: 3, passed: 2, failed: 1, errors: 0, pass_rate: 0.6667, checks_passed: 4, checks_total: 5, correctness: 4.33, grounding: 4, completeness: 5, judged: 3, latency_ms_avg: 4000, latency_ms_p95: 9000, tokens_total: 30000, tool_errors: 0 };

function res(i: number, passed: boolean | null, over: Partial<EvalResult> = {}): EvalResult {
  return {
    id: `x${i}`, case_id: `c${i}`, position: i, question: `Q${i}?`, expected: '', must_include: [], must_not_include: [], status: passed == null ? 'submitted' : 'scored',
    job_id: `j${i}`, wf_run_id: null, job_status: 'succeeded', answer: `A${i}`, checks: [{ kind: 'includes', term: '2.62', ok: !!passed }], judge: { correctness: passed ? 5 : 2, grounding: 4, completeness: 5, reason: passed ? 'Correct.' : 'Wrong period.' },
    passed, reason: passed ? 'Correct.' : 'Missing: 2.62', metrics: { latency_ms: 4200, tokens: 9000, tools: ['find_indicator'] }, error: null, submitted_at: null, answered_at: null, scored_at: null, ...over,
  };
}

function run(id: string, results: EvalResult[], over: Partial<EvalRun> = {}): EvalRun {
  return {
    id, set_id: 's1', set_name: 'Indicators QA', target_kind: 'agent', workflow_id: null, version: null, trigger: 'manual', regressed: null, regress_reason: null,
    agent_id: 'ag1', agent_name: 'askai_indicators_agent', agent: { model_ref: 'chat_default', collections: ['askai_indicators'], allowed_tools: ['find_indicator'], updated_at: '2026-11-26T08:00:00Z' },
    label: '', options: { judge: true, min_correctness: 4, min_grounding: 0, parallel: 2 }, status: 'succeeded', summary: SUM, error: null,
    created_at: '2026-11-26T11:00:00Z', started_at: '2026-11-26T11:00:01Z', finished_at: '2026-11-26T11:02:00Z', results, ...over,
  };
}

describe('labels', () => {
  it('describes runs and results', () => {
    expect(runPill({ status: 'running', summary: null })).toEqual(['submitted', 'Running']);
    expect(runPill({ status: 'succeeded', summary: { ...SUM, passed: 3 } })).toEqual(['approved', 'All passed']);
    expect(runPill({ status: 'succeeded', summary: SUM })).toEqual(['hold', '1 failed']);
    expect(runPill({ status: 'succeeded', summary: { ...SUM, passed: 0 } })).toEqual(['rejected', 'None passed']);
    expect(runPill({ status: 'failed', summary: null })).toEqual(['rejected', 'Run failed']);
    expect(runOutcome({ status: 'running', summary: { ...SUM, done: 1 } })).toBe('1 of 3 answered');
    expect(runOutcome({ status: 'succeeded', summary: SUM })).toBe('2 of 3 passed');
    expect(resultPill({ status: 'answered', passed: null })).toEqual(['submitted', 'Scoring']);
    expect(resultPill({ status: 'scored', passed: false })).toEqual(['rejected', 'Failed']);
    expect(fmtMs(850)).toBe('850 ms');
    expect(fmtMs(4200)).toBe('4.2 s');
    expect(fmtMs(125_000)).toBe('2 min 5 s');
    expect(summaryStats(SUM, true).map((s) => s.k)).toEqual(['Pass rate', 'Passed', 'Failed', 'Facts found', 'Correctness', 'Grounding', 'Latency p95', 'Tokens']);
    expect(summaryStats(SUM, false).map((s) => s.v).slice(0, 4)).toEqual(['67%', '2 / 3', '1', '4 / 5']);
  });
});

describe('CSV import', () => {
  it('parses quotes, commas and newlines inside fields', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']]);
    expect(parseCsv('question\texpected\r\nQ1\tE1')).toEqual([['question', 'expected'], ['Q1', 'E1']]);
  });
  it('reads questions with facts separated by ;', () => {
    const { cases, errors } = parseCasesCsv('﻿Question,Expected,Must include,tags,notes\n"Latest inflation?","2.62% in April 2026","2.62; April 2026",inflation,x\n,,\n"Q2",,,,');
    expect(cases).toEqual([
      { question: 'Latest inflation?', expected: '2.62% in April 2026', must_include: ['2.62', 'April 2026'], must_not_include: [], tags: ['inflation'] },
      { question: 'Q2', expected: '', must_include: [], must_not_include: [], tags: [] },
    ]);
    expect(errors).toEqual(['Ignored columns: notes.']);
    expect(parseCasesCsv('expected\nx').errors[0]).toMatch(/"question" is required/);
    expect(parseCasesCsv('').errors).toEqual(['The file is empty.']);
    expect(parseTerms(' a \n\nb; c ')).toEqual(['a', 'b', 'c']);
    // pasted with indentation
    expect(parseCasesCsv('   question,expected,must_include\n   "Q1?","Qatar 4.17%, Kuwait 2.06%","4.17;2.06"').cases[0]).toMatchObject({ question: 'Q1?', expected: 'Qatar 4.17%, Kuwait 2.06%', must_include: ['4.17', '2.06'] });
  });

  it('refuses a sentence where a short fact belongs', () => {
    expect(caseProblem({ question: 'Latest inflation?', must_include: ['2.62% in April 2026'] })).toMatch(/is a sentence/);
    expect(caseProblem({ question: 'Latest inflation?', expected: '2.62% in April 2026', must_include: ['2.62', 'April 2026'] })).toBe('');
    expect(caseProblem({ question: 'Latest inflation?', expected: '2.62% in April 2026' })).toBe('');
    expect(caseProblem({ question: 'Who publishes it?', must_include: ['Ministry of Public Health', 'Q1 2026', 'Kuwait | الكويت'] })).toBe('');
    expect(caseProblem({ question: 'Latest inflation?' })).toMatch(/expected answer/);
    expect(caseProblem({ question: ' ', expected: 'x' })).toBe('Enter the question.');
  });
});

describe('comparing runs', () => {
  const a = run('a', [res(0, true), res(1, false), res(2, true), res(3, false)], { created_at: '2026-11-25T10:00:00Z' });
  const b = run('b', [res(0, true), res(1, true), res(2, false), res(4, true, { question: 'New?' })], { agent: { ...a.agent!, updated_at: '2026-11-26T09:00:00Z' } });
  it('matches by test case and names the change', () => {
    const rows = compareRuns(a, b);
    expect(rows.map((r) => [r.key, r.change])).toEqual([
      ['c0', 'still passing'], ['c1', 'fixed'], ['c2', 'broken'], ['c4', 'only in B'], ['c3', 'only in A'],
    ]);
    expect(compareHeadline(rows)).toBe('1 fixed · 1 broken · 0 still failing · 1 still passing');
    expect(compareRuns(a, run('c', [res(0, null)]))[0].change).toBe('not finished');
  });
  it('says what changed in the agent', () => {
    expect(agentChanges(a, b)).toEqual(['Configuration changed in KAP (for example the system prompt, which KAP does not return)']);
    expect(agentChanges(a, run('c', [], { agent: { ...a.agent!, model_ref: 'qwen32' } }))).toEqual(['Model: chat_default → qwen32']);
    expect(agentChanges(a, a)).toEqual([]);
  });
  it('finds the previous finished run of the same set and agent', () => {
    expect(previousRun([a, b], b)?.id).toBe('a');
    expect(previousRun([a, b], a)).toBeUndefined();
  });
});

describe('screens', () => {
  const a0 = run('a', [res(0, true), res(1, false)], { label: 'baseline', created_at: '2026-11-25T10:00:00Z' });
  const b0 = run('b', [res(0, true), res(1, true)], { label: 'after prompt change' });
  const st: EvalState = {
    missing: false,
    sets: [{ id: 's1', name: 'Indicators QA', description: 'Checked by hand', case_count: 2, last_run: b0, created_at: '', updated_at: '2026-11-26T10:00:00Z' }],
    runs: [b0, a0],
    schedules: [{ id: 'sc1', set_id: 's1', target_kind: 'agent', agent_id: 'ag1', workflow_id: null, every_minutes: 1440, on_data: true, min_pass_rate: 0.8, options: {}, enabled: true, next_run_at: '2026-11-27T12:00:00Z', data_seen_at: null, last_run_id: 'b', created_at: '', updated_at: '' }],
    workflows: [{ id: 'ind_answer', name: 'Indicator answer', versions: [{ v: 'v2', st: 'Draft' }, { v: 'v1', st: 'Published' }] }],
    set: { s1: { id: 's1', name: 'Indicators QA', description: '', case_count: 1, last_run: null, created_at: '', updated_at: '', cases: [{ id: 'c0', position: 0, question: 'Q0?', expected: '2.62%', must_include: ['2.62'], must_not_include: [], tags: [], created_at: '', updated_at: '' }] } },
    run: { a: a0, b: b0 },
  };
  const ctx = (over: Partial<EvalCtx> = {}): EvalCtx => ({
    st, loading: false, error: null, now: NOW, canEdit: true, canRun: true, agents: [{ id: 'ag1', name: 'askai_indicators_agent' }], workflows: st.workflows,
    a: Object.fromEntries(['newSet', 'editSet', 'deleteSet', 'addCase', 'editCase', 'deleteCase', 'importCsv', 'run', 'cancel', 'removeRun', 'compareWith', 'useAnswer', 'addSchedule', 'editSchedule', 'deleteSchedule'].map((k) => [k, vi.fn()])) as unknown as EvalCtx['a'],
    go: Object.fromEntries(['sets', 'set', 'run', 'agent', 'trace', 'workflow', 'wfRun'].map((k) => [k, vi.fn()])) as unknown as EvalCtx['go'],
    ...over,
  });

  it('lists test sets and runs', () => {
    const m = setsScreen(ctx());
    expect(m.head.add?.l).toBe('New test set');
    expect(m.sections.map((s) => s.title)).toEqual([undefined, 'Test sets', 'Recent runs']);
    expect(m.sections[1].rows![0].cells[0].v).toBe('Indicators QA');
    expect(m.sections[2].rows!.map((r) => r.cells[0].v)).toEqual(['after prompt change', 'baseline']);
    expect(setsScreen(ctx({ canEdit: false, canRun: false })).head.add).toBeUndefined();
    expect(setsScreen(ctx({ st: { ...st, missing: true } })).sections[0].callout).toMatch(/does not have evaluations yet/);
  });

  it('shows a test set with its questions', () => {
    const m = setScreen(ctx(), 's1');
    expect(m.head.title).toBe('Indicators QA');
    expect(m.sections[0].rows![0].kv!.find((k) => k.k === 'Must include')!.v).toBe('2.62');
    expect(m.sections[1].rows!.length).toBe(2);
    expect(setScreen(ctx(), 'nope').sections[0].callout).toMatch(/No such test set/);
  });

  it('shows a run with a result per question and the comparison', () => {
    const c = ctx();
    const m = runScreen(c, 'b', 'a');
    expect(m.head.status).toEqual(['hold', '1 failed']);
    expect(m.head.acts!.map((x) => x.l)).toEqual(['Compare with…', 'Delete']);
    const q = m.sections.find((s) => s.title === 'Questions')!;
    expect(q.cols).toEqual(['#', 'Question', 'Result', 'Facts', 'Judge', 'Time']);
    expect(q.rows![0].kv!.map((k) => k.k)).toEqual(['Question', 'Answer', 'Expected answer', 'Judge note', 'Facts', 'Judge', 'Time', 'Tools', 'Tokens', 'KAP job']);
    q.rows![0].acts![0].f();
    expect(c.go.trace).toHaveBeenCalledWith('j0');
    const cmp = m.sections.find((s) => s.group?.startsWith('Compared with'))!;
    expect(cmp.group).toBe('Compared with baseline');
    expect(cmp.title).toBe('1 fixed · 0 broken · 0 still failing · 1 still passing');
    // a failed question can become the reference
    const failed = runScreen(c, 'a').sections.find((s) => s.title === 'Questions')!.rows![1];
    expect(failed.acts!.map((x) => x.l)).toEqual(['Open trace', 'Use as expected answer']);
    expect(runScreen(ctx({ st: { ...st, run: { b: { ...b0, status: 'running' } } } }), 'b').head.acts!.map((x) => x.l)).toEqual(['Cancel run']);
  });

  it('shows the agent’s evaluation runs', () => {
    const s = agentEvalSections(ctx(), 'ag1');
    expect(s.map((x) => x.title)).toEqual([undefined, 'Latest result', 'Evaluation runs', 'Automatic runs']);
    expect(s[3].rows!.length).toBe(1);
    expect(s[2].rows!.length).toBe(2);
    expect(agentEvalSections(ctx(), 'other')[1].rows).toEqual([]);
  });
});
