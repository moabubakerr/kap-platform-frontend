/**
 * Evaluation screens of the live tenant (platform API) as ScreenModels:
 * test sets, one test set with its questions and runs, one run with a result
 * per question (and the comparison with an earlier run), and the Evaluation
 * tab of a KAP agent. Pure: context in, model out.
 */
import { act, cell, fr } from '@/engine/build';
import type { Action, KV, Row, ScreenModel, Section } from '@/engine/types';
import type { EvalCase, EvalResult, EvalRun, EvalSchedule, EvalSet } from '@/api/platformEval';
import { EVAL_FEATURE_MISSING } from '@/api/platformEval';
import { relTime } from '@/features/v35/agents/fromKap';
import {
  agentChanges, CHANGE_PILL, compareHeadline, compareRuns, fmtMs, fmtTokens, isActiveRun, judgeLine, passTrend, pct, resultPill, runLabelOf, runOutcome, runPill, scheduleText, score5,
  summaryStats, targetLabel, TRIGGER_L, WF_GATE_MIN, wfGate,
} from './evalView';
import type { EvalState } from './evalLive';

export interface EvalNav {
  sets: () => void;
  set: (id: string) => void;
  run: (id: string, vs?: string) => void;
  /** agent page by agent name */
  agent: (name: string) => void;
  trace: (jobId: string) => void;
  /** workflow page (Evaluation tab) */
  workflow: (id: string) => void;
  /** one workflow run */
  wfRun: (workflowId: string, runId: string) => void;
}

/** What a run or schedule targets: an agent (KAP id) or a workflow (and version). */
export interface EvalTarget {
  setId?: string;
  agentId?: string;
  workflowId?: string;
  version?: string;
}

export interface EvalActions {
  newSet: () => void;
  editSet: (s: EvalSet) => void;
  deleteSet: (s: EvalSet) => void;
  addCase: (s: EvalSet) => void;
  editCase: (s: EvalSet, c: EvalCase) => void;
  deleteCase: (s: EvalSet, c: EvalCase) => void;
  importCsv: (s: EvalSet) => void;
  /** start a run; preset the test set and/or the target */
  run: (p: EvalTarget) => void;
  /** automatic runs of a test set */
  addSchedule: (p: EvalTarget) => void;
  editSchedule: (s: EvalSchedule) => void;
  deleteSchedule: (s: EvalSchedule) => void;
  cancel: (r: EvalRun) => void;
  removeRun: (r: EvalRun) => void;
  compareWith: (r: EvalRun) => void;
  /** a failed question's real answer becomes the reference answer after review */
  useAnswer: (r: EvalRun, x: EvalResult) => void;
}

export interface EvalCtx {
  st: EvalState | undefined;
  loading: boolean;
  error: string | null;
  now: number;
  canEdit: boolean;
  canRun: boolean;
  /** KAP agents: id = KAP id */
  agents: { id: string; name: string }[];
  /** platform workflows and their versions */
  workflows: { id: string; name: string; versions: { v: string; st: string }[] }[];
  a: EvalActions;
  go: EvalNav;
}

export const INTRO =
  'A test set is a list of questions with the facts a correct answer must contain. Running it sends every question to a KAP agent as a real job (traced in Monitoring), checks the facts in each answer (numbers are compared as numbers) and asks an AI judge for correctness, grounding in what the tools returned, and completeness. Run it again after changing the prompt, model or data, and compare.';

const row = (key: string, cells: Row['cells'], acts: Action[] = []): Row => ({ key, cells, acts });
const trunc = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function stateSections(c: EvalCtx): Section[] | null {
  if (c.st?.missing) return [{ callout: EVAL_FEATURE_MISSING }];
  if (c.error && !c.st) return [{ callout: `Could not load evaluations from the platform API: ${c.error}` }];
  return null;
}

const runLabel = runLabelOf;

// ================================================================ runs table (shared)
function runsSection(c: EvalCtx, runs: EvalRun[], title: string, opts: { showSet?: boolean; showAgent?: boolean; empty?: string; sacts?: Action[] } = {}): Section {
  const { showSet = true, showAgent = true } = opts;
  return {
    title,
    badge: String(runs.length),
    sacts: opts.sacts,
    mode: 'inline',
    empty: opts.empty ?? (c.loading ? 'Loading runs…' : 'No evaluation runs yet.'),
    cols: ['Run', ...(showSet ? ['Test set'] : []), ...(showAgent ? ['Agent or workflow'] : []), 'Result', 'Pass rate', 'Correctness', 'Started'],
    rows: runs.map((r) => ({
      ...row(
        'er:' + r.id,
        [
          cell(runLabel(r, c.now), { sub: r.trigger && r.trigger !== 'manual' ? TRIGGER_L[r.trigger] : r.label ? relTime(r.created_at, c.now) : undefined }),
          ...(showSet ? [cell(r.set_name)] : []),
          ...(showAgent ? [cell(targetLabel(r), { m: r.target_kind !== 'workflow', sub: r.target_kind === 'workflow' ? 'Workflow' : r.agent?.model_ref })] : []),
          cell('', { p: runPill(r), sub: r.regressed && r.regress_reason ? trunc(r.regress_reason, 90) : runOutcome(r) }),
          cell(pct(r.summary?.pass_rate)),
          cell(score5(r.summary?.correctness)),
          cell(relTime(r.started_at ?? r.created_at, c.now)),
        ],
        [act('Open', () => c.go.run(r.id))],
      ),
      onClick: () => c.go.run(r.id),
    })),
  };
}

// ================================================================ test sets
export function setsScreen(c: EvalCtx): ScreenModel {
  const head = {
    title: 'Evaluation',
    acts: c.canRun ? [act('Run evaluation', () => c.a.run({}))] : [],
    add: c.canEdit ? act('New test set', c.a.newSet, 'primary') : undefined,
  };
  const blocked = stateSections(c);
  if (blocked) return { head, sections: blocked };
  const sets = c.st?.sets ?? [];
  const runs = c.st?.runs ?? [];
  return {
    head,
    sections: [
      { callout: INTRO },
      {
        title: 'Test sets',
        badge: String(sets.length),
        mode: 'inline',
        empty: c.loading ? 'Loading test sets…' : 'No test sets yet. Create one, add the questions you checked by hand, and run it against an agent.',
        cols: ['Test set', 'Questions', 'Last run', 'Changed'],
        rows: sets.map((s) => ({
          ...row(
            'es:' + s.id,
            [
              cell(s.name, { sub: s.description ? trunc(s.description, 90) : undefined }),
              cell(String(s.case_count)),
              s.last_run ? cell('', { p: runPill(s.last_run as EvalRun), sub: `${s.last_run.agent_name ?? ''} · ${relTime(s.last_run.created_at, c.now)}` }) : cell('Never run'),
              cell(relTime(s.updated_at, c.now)),
            ],
            [act('Open', () => c.go.set(s.id)), ...(c.canRun && s.case_count ? [act('Run', () => c.a.run({ setId: s.id }))] : [])],
          ),
          onClick: () => c.go.set(s.id),
        })),
      },
      runsSection(c, runs.slice(0, 50), 'Recent runs'),
    ],
  };
}

// ================================================================ one test set
function caseKv(x: EvalCase): KV[] {
  return [
    { k: 'Question', v: x.question },
    { k: 'Expected answer', v: x.expected || '— (the judge checks against the evidence only)' },
    { k: 'Must include', v: x.must_include.join('\n') || '—' },
    { k: 'Must not include', v: x.must_not_include.join('\n') || '—' },
    { k: 'Tags', v: x.tags.join(', ') || '—' },
  ];
}

export function setScreen(c: EvalCtx, setId: string): ScreenModel {
  const s = c.st?.set[setId] ?? c.st?.sets.find((x) => x.id === setId);
  const blocked = stateSections(c);
  if (blocked) return { head: { title: 'Test set' }, sections: blocked };
  if (!s) return { head: { title: 'Test set' }, sections: [{ callout: c.loading || !c.st ? 'Loading the test set…' : 'No such test set. It may have been deleted.' }] };
  const cases = s.cases;
  const runs = (c.st?.runs ?? []).filter((r) => r.set_id === s.id);
  return {
    head: {
      title: s.name,
      sub: s.description || undefined,
      acts: c.canEdit ? [act('Edit', () => c.a.editSet(s)), act('Delete', () => c.a.deleteSet(s))] : [],
      add: c.canRun && s.case_count ? act('Run evaluation', () => c.a.run({ setId: s.id }), 'primary') : undefined,
    },
    sections: [
      {
        title: 'Questions',
        badge: String(cases?.length ?? s.case_count),
        note: 'The AI judge compares each answer with the expected answer. Facts in "Must include" are checked in every answer; "a | b" accepts either. Numbers match at the precision you write: 2.6 accepts 2.62, 2.62 does not accept 2.6.',
        sacts: c.canEdit ? [act('Add question', () => c.a.addCase(s), 'primary'), act('Import CSV', () => c.a.importCsv(s))] : [],
        mode: 'panel',
        empty: !cases ? 'Loading questions…' : 'No questions yet. Add them one by one or import a CSV.',
        cols: ['#', 'Question', 'Expected answer', 'Must include'],
        rows: (cases ?? []).map((x, i) => ({
          key: 'ec:' + x.id,
          cells: [cell(String(i + 1)), cell(trunc(x.question), { sub: x.tags.join(', ') || undefined }), cell(x.expected ? trunc(x.expected, 70) : '—'), cell(x.must_include.join(' · ') || '—')],
          kv: caseKv(x),
          keepKv: true,
          acts: c.canEdit ? [act('Edit', () => c.a.editCase(s, x)), act('Delete', () => c.a.deleteCase(s, x), 'danger')] : [],
        })),
      },
      { ...runsSection(c, runs, 'Runs of this test set', { showSet: false, empty: 'Not run yet.' }), note: trendNote(runs) },
      schedulesSection(c, (c.st?.schedules ?? []).filter((x) => x.set_id === s.id), { setId: s.id }),
    ],
  };
}

/** "Pass rate over the last runs: 50% → 75% → 100%" per target. */
export function trendNote(runs: EvalRun[]): string | undefined {
  const by = new Map<string, EvalRun[]>();
  for (const r of runs) {
    const k = targetLabel({ ...r, version: null });
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const lines = [...by.entries()]
    .map(([k, rs]) => [k, passTrend(rs).slice(-6)] as const)
    .filter(([, t]) => t.length > 1)
    .map(([k, t]) => `${k}: ${t.map((x) => pct(x)).join(' → ')}`);
  return lines.length ? 'Pass rate over the last runs · ' + lines.join(' · ') : undefined;
}

function schedTarget(c: EvalCtx, s: EvalSchedule): string {
  if (s.target_kind === 'workflow') return (c.workflows.find((w) => w.id === s.workflow_id)?.name ?? s.workflow_id ?? '—') + ' (published version)';
  return c.agents.find((a) => a.id === s.agent_id)?.name ?? (s.agent_id ?? '').slice(0, 8);
}

/** Automatic runs: on a schedule and/or after new data; a drop is marked as a regression. */
export function schedulesSection(c: EvalCtx, scheds: EvalSchedule[], preset: EvalTarget): Section {
  const sets = c.st?.sets ?? [];
  return {
    title: 'Automatic runs',
    badge: String(scheds.length),
    note: 'Runs the test set on a schedule, or after a PostgreSQL export reloads the data of the agent (or of the workflow’s agents). A run whose pass rate falls, or where a question that passed now fails, is marked Regressed.',
    sacts: c.canEdit && sets.length ? [act('Add automatic run', () => c.a.addSchedule(preset))] : [],
    mode: 'inline',
    empty: 'None. Add one to catch regressions without running the test set by hand.',
    cols: ['Test set', 'Agent or workflow', 'When', 'Next run', 'Last run'],
    rows: scheds.map((s) => {
      const last = s.last_run_id ? (c.st?.runs ?? []).find((r) => r.id === s.last_run_id) : undefined;
      return row(
        'sc:' + s.id,
        [
          cell(sets.find((x) => x.id === s.set_id)?.name ?? '—'),
          cell(schedTarget(c, s)),
          cell(scheduleText(s)),
          cell(s.enabled && s.next_run_at ? relTime(s.next_run_at, c.now).replace(' ago', '').replace('just now', 'now') : s.on_data ? 'When new data arrives' : '—'),
          last ? cell('', { p: runPill(last), sub: relTime(last.created_at, c.now) }) : cell('Not yet'),
        ],
        [...(last ? [act('Open run', () => c.go.run(last.id))] : []), ...(c.canEdit ? [act('Edit', () => c.a.editSchedule(s)), act('Delete', () => c.a.deleteSchedule(s), 'danger')] : [])],
      );
    }),
  };
}

// ================================================================ one run
function resultKv(x: EvalResult): KV[] {
  const m = x.metrics ?? {};
  const kv: KV[] = [
    { k: 'Question', v: x.question },
    { k: 'Answer', v: x.answer || (x.status === 'pending' || x.status === 'submitted' ? 'Not answered yet' : '— (no answer)') },
    { k: 'Expected answer', v: x.expected || '—' },
  ];
  if (x.reason) kv.push({ k: x.passed ? 'Judge note' : 'Why it failed', v: x.reason });
  if (x.checks?.length) kv.push({ k: 'Facts', v: x.checks.map((ch) => `${ch.ok ? '✓' : '✗'} ${ch.kind === 'excludes' ? 'not ' : ''}${ch.term}`).join('\n') });
  if (x.judge) kv.push({ k: 'Judge', v: judgeLine(x.judge) + (x.judge.model ? ` (${x.judge.model})` : '') });
  kv.push({ k: 'Time', v: `${fmtMs(m.latency_ms)}${m.queue_ms ? ` · queued ${fmtMs(m.queue_ms)}` : ''}` });
  if (m.tools?.length) kv.push({ k: 'Tools', v: m.tools.join(', ') + (m.tool_errors ? ` · ${m.tool_errors} failed` : '') });
  if (m.tokens != null) kv.push({ k: 'Tokens', v: fmtTokens(m.tokens) });
  if (m.steps?.length) kv.push({ k: 'Workflow steps', v: m.steps.join('\n') });
  if (x.error) kv.push({ k: 'Error', v: x.error });
  if (x.job_id) kv.push({ k: 'KAP job', v: x.job_id, mono: true });
  if (x.wf_run_id) kv.push({ k: 'Workflow run', v: x.wf_run_id, mono: true });
  return kv;
}

function factsCell(x: EvalResult) {
  const ch = x.checks ?? [];
  if (!ch.length) return cell(x.status === 'scored' ? 'No facts set' : '—');
  const ok = ch.filter((y) => y.ok).length;
  const miss = ch.filter((y) => !y.ok).map((y) => y.term);
  return cell(`${ok} / ${ch.length}`, { sub: miss.length ? 'Missing ' + trunc(miss.join(', '), 60) : undefined });
}

export function runScreen(c: EvalCtx, runId: string, vsId?: string | null): ScreenModel {
  const blocked = stateSections(c);
  if (blocked) return { head: { title: 'Evaluation run' }, sections: blocked };
  const r = c.st?.run[runId] ?? c.st?.runs.find((x) => x.id === runId);
  if (!r) return { head: { title: 'Evaluation run' }, sections: [{ callout: c.loading || !c.st ? 'Loading the run…' : 'No such run. It may have been deleted.' }] };
  const active = isActiveRun(r);
  const o = r.options;
  const results = c.st?.run[runId]?.results;
  const vs = vsId ? c.st?.run[vsId] : undefined;
  const sections: Section[] = [];
  const wf = r.target_kind === 'workflow';
  if (r.status === 'failed') sections.push({ callout: `The run stopped: ${r.error ?? 'unknown error'}. Results so far are kept below.` });
  if (r.regressed) sections.push({ callout: `Regressed against the previous run: ${r.regress_reason ?? 'the pass rate fell'}. Use Compare with… to see every question.` });
  if (active) sections.push({ callout: `Running: ${runOutcome(r)}. Questions go to the ${wf ? 'workflow' : 'agent'} ${o.parallel} at a time; this page updates every few seconds.` });
  sections.push({ stats: summaryStats(r.summary, o.judge) });
  sections.push({
    form: true,
    title: 'Run',
    rows: [
      fr('Test set', r.set_name, '', [act('Open', () => c.go.set(r.set_id))]),
      wf
        ? fr('Workflow', targetLabel(r), r.agent?.status ? `${r.agent.status} version when the run started` : '', r.workflow_id ? [act('Open', () => c.go.workflow(r.workflow_id!))] : [])
        : fr('Agent', targetLabel(r), [r.agent?.model_ref && `Model ${r.agent.model_ref}`, r.agent?.collections?.length ? `Collections ${r.agent.collections.join(', ')}` : ''].filter(Boolean).join(' · '), r.agent_name ? [act('Open', () => c.go.agent(r.agent_name!))] : []),
      fr('Started by', TRIGGER_L[r.trigger ?? 'manual']),
      fr('Scoring', o.judge ? `Facts and AI judge` : 'Facts only', o.judge ? `Passes with every fact found and correctness ≥ ${o.min_correctness}/5${o.min_grounding ? ` and grounding ≥ ${o.min_grounding}/5` : ''}` : 'Passes when every fact is found'),
      fr('Started', relTime(r.started_at ?? r.created_at, c.now), r.finished_at ? `Finished ${relTime(r.finished_at, c.now)} · took ${fmtMs(Date.parse(r.finished_at) - Date.parse(r.started_at ?? r.created_at))}` : RUN_STATUS_SUB[r.status] ?? ''),
      ...(r.label ? [fr('Label', r.label)] : []),
    ],
  });
  sections.push({
    title: 'Questions',
    badge: results ? String(results.length) : undefined,
    note: 'Click a question for the answer, the facts, the judge’s note and the trace.',
    mode: 'panel',
    empty: results ? 'This run has no questions.' : 'Loading results…',
    cols: ['#', 'Question', 'Result', 'Facts', ...(o.judge ? ['Judge'] : []), 'Time'],
    rows: (results ?? []).map((x) => ({
      key: 'rr:' + x.id,
      cells: [
        cell(String(x.position + 1)),
        cell(trunc(x.question), { sub: x.passed === false && x.reason ? trunc(x.reason, 100) : undefined }),
        cell('', { p: resultPill(x) }),
        factsCell(x),
        ...(o.judge ? [cell(x.judge?.correctness != null ? `${x.judge.correctness} / 5` : x.judge?.error ? 'Unavailable' : '—', { sub: x.judge?.grounding != null ? `grounded ${x.judge.grounding}` : undefined })] : []),
        cell(fmtMs(x.metrics?.latency_ms)),
      ],
      kv: resultKv(x),
      keepKv: true,
      acts: [
        ...(x.job_id ? [act('Open trace', () => c.go.trace(x.job_id!))] : []),
        ...(x.wf_run_id && r.workflow_id ? [act('Open workflow run', () => c.go.wfRun(r.workflow_id!, x.wf_run_id!))] : []),
        ...(c.canEdit && x.case_id && x.answer && x.status === 'scored' && !x.passed ? [act('Use as expected answer', () => c.a.useAnswer(r, x))] : []),
      ],
    })),
  });
  if (vs) sections.push(...compareSections(c, vs, r));
  return {
    head: {
      title: `${r.set_name} · ${targetLabel(r)}`,
      status: runPill(r),
      sub: r.label || undefined,
      acts: [
        ...(active && c.canRun ? [act('Cancel run', () => c.a.cancel(r))] : []),
        ...(!active ? [act('Compare with…', () => c.a.compareWith(r))] : []),
        ...(!active && c.canEdit ? [act('Delete', () => c.a.removeRun(r))] : []),
      ],
      add:
        c.canRun && !active
          ? act('Run again', () => c.a.run(wf ? { setId: r.set_id, workflowId: r.workflow_id ?? undefined, version: r.version ?? undefined } : { setId: r.set_id, agentId: r.agent_id ?? undefined }), 'primary')
          : undefined,
    },
    sections,
  };
}

const RUN_STATUS_SUB: Partial<Record<EvalRun['status'], string>> = { queued: 'Waiting for the worker', running: 'Still running', cancelled: 'Cancelled' };

/** Baseline `a` (earlier) against `b` (this run). */
export function compareSections(c: EvalCtx, a: EvalRun, b: EvalRun): Section[] {
  if (!a.results || !b.results) return [{ title: 'Comparison', callout: 'Loading the other run…' }];
  const rows = compareRuns(a, b);
  const changes = agentChanges(a, b);
  const sa = a.summary;
  const sb = b.summary;
  return [
    {
      group: `Compared with ${runLabel(a, c.now)}`,
      title: compareHeadline(rows),
      note: `Pass rate ${pct(sa?.pass_rate)} → ${pct(sb?.pass_rate)} · correctness ${score5(sa?.correctness)} → ${score5(sb?.correctness)}`,
      sacts: [act('Open that run', () => c.go.run(a.id)), act('Stop comparing', () => c.go.run(b.id), 'ghost')],
      mode: 'inline',
      cols: ['Question', 'Before', 'Now', 'Change'],
      rows: rows.map((x) =>
        row('cmp:' + x.key, [
          cell(trunc(x.question)),
          x.a ? cell('', { p: resultPill(x.a) }) : cell('—'),
          x.b ? cell('', { p: resultPill(x.b) }) : cell('—'),
          cell('', { p: CHANGE_PILL[x.change] }),
        ]),
      ),
    },
    { callout: changes.length ? 'What changed in the agent between the runs: ' + changes.join('; ') + '.' : 'The agent’s settings were the same in both runs; differences come from the data or the model’s variation.' },
  ];
}

// ================================================================ agent tab
export function agentEvalSections(c: EvalCtx, kapId: string): Section[] {
  const blocked = stateSections(c);
  if (blocked) return blocked;
  const runs = (c.st?.runs ?? []).filter((r) => r.agent_id === kapId);
  const sets = c.st?.sets ?? [];
  const last = runs.find((r) => r.status === 'succeeded');
  const sections: Section[] = [{ callout: INTRO }];
  if (last?.regressed) sections.push({ callout: `The latest evaluation regressed: ${last.regress_reason ?? 'the pass rate fell'}.` });
  if (last?.summary)
    sections.push({
      form: true,
      title: 'Latest result',
      rows: [
        fr('Test set', last.set_name, relTime(last.finished_at ?? last.created_at, c.now), [act('Open run', () => c.go.run(last.id))]),
        fr('Passed', `${last.summary.passed} of ${last.summary.total}`, `Pass rate ${pct(last.summary.pass_rate)}`),
        ...(last.options.judge ? [fr('Judge', `Correctness ${score5(last.summary.correctness)}`, `Grounding ${score5(last.summary.grounding)} · completeness ${score5(last.summary.completeness)}`)] : []),
        fr('Latency', `p95 ${fmtMs(last.summary.latency_ms_p95)}`, `Average ${fmtMs(last.summary.latency_ms_avg)}`),
      ],
    });
  sections.push(
    runsSection(c, runs, 'Evaluation runs', {
      showAgent: false,
      empty: sets.length ? 'This agent has not been evaluated yet. Run a test set against it.' : 'No test sets yet. Create one under Evaluation datasets.',
      sacts: [...(c.canRun && sets.length ? [act('Run evaluation', () => c.a.run({ agentId: kapId }), 'primary')] : []), act('Test sets', c.go.sets)],
    }),
  );
  sections[sections.length - 1].note = trendNote(runs);
  sections.push(schedulesSection(c, (c.st?.schedules ?? []).filter((s) => s.agent_id === kapId), { agentId: kapId }));
  return sections;
}

// ================================================================ workflow tab
/** The Evaluation tab of a workflow: the publish gate of its draft, its runs and automatic runs. */
export function workflowEvalSections(c: EvalCtx, wfId: string, draft: { v: string; cfg: unknown } | null): Section[] {
  const blocked = stateSections(c);
  if (blocked) return blocked;
  const runs = (c.st?.runs ?? []).filter((r) => r.workflow_id === wfId);
  const sets = c.st?.sets ?? [];
  const sections: Section[] = [{ callout: 'Run a test set against a version of this workflow: every question runs through the whole workflow, and each answer is checked and judged like an agent’s. A draft can be published once an evaluation of exactly that draft reaches the pass rate below.' }];
  if (draft) {
    const g = wfGate(runs, wfId, draft.v, draft.cfg);
    sections.push({
      form: true,
      title: `Publish gate · draft ${draft.v}`,
      sacts: c.canRun && sets.length ? [act(`Evaluate ${draft.v}`, () => c.a.run({ workflowId: wfId, version: draft.v }), 'primary')] : [],
      rows: [
        row(
          'gate',
          [cell('Status'), cell('', { p: g.ok ? ['approved', g.text] : ['hold', g.text], sub: `Needs a finished evaluation of this exact draft with a pass rate of at least ${pct(WF_GATE_MIN)}` })],
          g.run ? [act('Open run', () => c.go.run(g.run!.id))] : [],
        ),
      ],
    });
  }
  const last = runs.find((r) => r.status === 'succeeded');
  if (last?.regressed) sections.push({ callout: `The latest evaluation regressed: ${last.regress_reason ?? 'the pass rate fell'}.` });
  sections.push({
    ...runsSection(c, runs, 'Evaluation runs', {
      empty: sets.length ? 'Not evaluated yet.' : 'No test sets yet. Create one under Evaluation datasets.',
      sacts: [...(c.canRun && sets.length ? [act('Run evaluation', () => c.a.run({ workflowId: wfId }))] : []), act('Test sets', c.go.sets)],
    }),
    note: trendNote(runs),
  });
  sections.push(schedulesSection(c, (c.st?.schedules ?? []).filter((s) => s.workflow_id === wfId), { workflowId: wfId }));
  return sections;
}
