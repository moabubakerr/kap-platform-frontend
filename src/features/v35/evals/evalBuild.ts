/**
 * Evaluation screens of the live tenant (platform API) as ScreenModels:
 * test sets, one test set with its questions and runs, one run with a result
 * per question (and the comparison with an earlier run), and the Evaluation
 * tab of a KAP agent. Pure: context in, model out.
 */
import { act, cell, fr } from '@/engine/build';
import type { Action, KV, Row, ScreenModel, Section } from '@/engine/types';
import type { EvalCase, EvalResult, EvalRun, EvalSet } from '@/api/platformEval';
import { EVAL_FEATURE_MISSING } from '@/api/platformEval';
import { relTime } from '@/features/v35/agents/fromKap';
import {
  agentChanges, CHANGE_PILL, compareHeadline, compareRuns, fmtMs, fmtTokens, isActiveRun, judgeLine, pct, resultPill, runLabelOf, runOutcome, runPill, score5, summaryStats,
} from './evalView';
import type { EvalState } from './evalLive';

export interface EvalNav {
  sets: () => void;
  set: (id: string) => void;
  run: (id: string, vs?: string) => void;
  /** agent page by agent name */
  agent: (name: string) => void;
  trace: (jobId: string) => void;
}

export interface EvalActions {
  newSet: () => void;
  editSet: (s: EvalSet) => void;
  deleteSet: (s: EvalSet) => void;
  addCase: (s: EvalSet) => void;
  editCase: (s: EvalSet, c: EvalCase) => void;
  deleteCase: (s: EvalSet, c: EvalCase) => void;
  importCsv: (s: EvalSet) => void;
  /** start a run; preset the test set and/or agent (KAP id) */
  run: (p: { setId?: string; agentId?: string }) => void;
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
    cols: ['Run', ...(showSet ? ['Test set'] : []), ...(showAgent ? ['Agent'] : []), 'Result', 'Pass rate', 'Correctness', 'Started'],
    rows: runs.map((r) => ({
      ...row(
        'er:' + r.id,
        [
          cell(runLabel(r, c.now), { sub: r.label ? relTime(r.created_at, c.now) : undefined }),
          ...(showSet ? [cell(r.set_name)] : []),
          ...(showAgent ? [cell(r.agent_name ?? r.agent_id.slice(0, 8), { m: true, sub: r.agent?.model_ref })] : []),
          cell('', { p: runPill(r), sub: runOutcome(r) }),
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
    { k: 'Reference answer', v: x.expected || '— (the judge checks against the evidence only)' },
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
        note: 'Facts in "Must include" are checked in every answer; "a | b" accepts either. Numbers match at the precision you write: 2.6 accepts 2.62, 2.62 does not accept 2.6.',
        sacts: c.canEdit ? [act('Add question', () => c.a.addCase(s), 'primary'), act('Import CSV', () => c.a.importCsv(s))] : [],
        mode: 'panel',
        empty: !cases ? 'Loading questions…' : 'No questions yet. Add them one by one or import a CSV.',
        cols: ['#', 'Question', 'Must include', 'Reference answer'],
        rows: (cases ?? []).map((x, i) => ({
          key: 'ec:' + x.id,
          cells: [cell(String(i + 1)), cell(trunc(x.question), { sub: x.tags.join(', ') || undefined }), cell(x.must_include.join(' · ') || '—'), cell(x.expected ? trunc(x.expected, 70) : '—')],
          kv: caseKv(x),
          keepKv: true,
          acts: c.canEdit ? [act('Edit', () => c.a.editCase(s, x)), act('Delete', () => c.a.deleteCase(s, x), 'danger')] : [],
        })),
      },
      runsSection(c, runs, 'Runs of this test set', { showSet: false, empty: 'Not run yet.' }),
    ],
  };
}

// ================================================================ one run
function resultKv(x: EvalResult): KV[] {
  const m = x.metrics ?? {};
  const kv: KV[] = [
    { k: 'Question', v: x.question },
    { k: 'Answer', v: x.answer || (x.status === 'pending' || x.status === 'submitted' ? 'Not answered yet' : '— (no answer)') },
    { k: 'Reference answer', v: x.expected || '—' },
  ];
  if (x.reason) kv.push({ k: x.passed ? 'Judge note' : 'Why it failed', v: x.reason });
  if (x.checks?.length) kv.push({ k: 'Facts', v: x.checks.map((ch) => `${ch.ok ? '✓' : '✗'} ${ch.kind === 'excludes' ? 'not ' : ''}${ch.term}`).join('\n') });
  if (x.judge) kv.push({ k: 'Judge', v: judgeLine(x.judge) + (x.judge.model ? ` (${x.judge.model})` : '') });
  kv.push({ k: 'Time', v: `${fmtMs(m.latency_ms)}${m.queue_ms ? ` · queued ${fmtMs(m.queue_ms)}` : ''}` });
  if (m.tools?.length) kv.push({ k: 'Tools', v: m.tools.join(', ') + (m.tool_errors ? ` · ${m.tool_errors} failed` : '') });
  if (m.tokens != null) kv.push({ k: 'Tokens', v: fmtTokens(m.tokens) });
  if (x.error) kv.push({ k: 'Error', v: x.error });
  if (x.job_id) kv.push({ k: 'KAP job', v: x.job_id, mono: true });
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
  if (r.status === 'failed') sections.push({ callout: `The run stopped: ${r.error ?? 'unknown error'}. Results so far are kept below.` });
  if (active) sections.push({ callout: `Running: ${runOutcome(r)}. Questions go to the agent ${o.parallel} at a time; this page updates every few seconds.` });
  sections.push({ stats: summaryStats(r.summary, o.judge) });
  sections.push({
    form: true,
    title: 'Run',
    rows: [
      fr('Test set', r.set_name, '', [act('Open', () => c.go.set(r.set_id))]),
      fr('Agent', r.agent_name ?? r.agent_id, [r.agent?.model_ref && `Model ${r.agent.model_ref}`, r.agent?.collections?.length ? `Collections ${r.agent.collections.join(', ')}` : ''].filter(Boolean).join(' · '), r.agent_name ? [act('Open', () => c.go.agent(r.agent_name!))] : []),
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
        ...(c.canEdit && x.case_id && x.answer && x.status === 'scored' && !x.passed ? [act('Use this answer as reference', () => c.a.useAnswer(r, x))] : []),
      ],
    })),
  });
  if (vs) sections.push(...compareSections(c, vs, r));
  return {
    head: {
      title: `${r.set_name} · ${r.agent_name ?? 'agent'}`,
      status: runPill(r),
      sub: r.label || undefined,
      acts: [
        ...(active && c.canRun ? [act('Cancel run', () => c.a.cancel(r))] : []),
        ...(!active ? [act('Compare with…', () => c.a.compareWith(r))] : []),
        ...(!active && c.canEdit ? [act('Delete', () => c.a.removeRun(r))] : []),
      ],
      add: c.canRun && !active ? act('Run again', () => c.a.run({ setId: r.set_id, agentId: r.agent_id }), 'primary') : undefined,
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
  return sections;
}
