/**
 * Evaluation pages of the live tenant: platform data (useEvalLists), the KAP
 * agents (from the Agents hub), navigation and the dialog actions.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBase } from '@/app/shell/AppShell';
import { useDialogs, type FormField, type FormValues } from '@/engine/dialogs';
import {
  addEvalCases, cancelEvalRun, createEvalSchedule, createEvalSet, deleteEvalCase, deleteEvalRun, deleteEvalSchedule, deleteEvalSet, patchEvalCase, patchEvalSchedule, patchEvalSet, startEvalRun,
  type EvalCase, type EvalCaseIn, type EvalRun, type EvalSet,
} from '@/api/platformEval';
import { kapOf } from '@/features/v35/agents/fromKap';
import type { useAgents } from '@/features/v35/agents/useAgents';
import type { EvalCtx } from './evalBuild';
import { forgetRun, forgetSet, loadEvalRun, loadEvalSet, putRun, useEvalLists } from './evalLive';
import { caseProblem, CSV_EXAMPLE, everyL, EVERY_OPTS, parseCasesCsv, parseTerms, runLabelOf, termsText } from './evalView';

type AgentsC = ReturnType<typeof useAgents>;

/** Platform errors (PgApiError) already carry a readable message. */
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const JUDGE_OPTS = ['Facts and AI judge', 'Facts only'];
export const MIN_CORRECT_OPTS = ['5 — fully correct', '4 — correct, minor gaps', '3 — partly correct'];
export const PARALLEL_OPTS = ['1', '2', '3', '4'];
export const MIN_PASS_OPTS: [string, number | null][] = [['No minimum (compare with the previous run only)', null], ['50%', 0.5], ['70%', 0.7], ['80%', 0.8], ['90%', 0.9], ['100%', 1]];

const setL = (s: EvalSet) => `${s.name} (${s.case_count} ${s.case_count === 1 ? 'question' : 'questions'})`;

export interface TargetOpt {
  label: string;
  agentId?: string;
  workflowId?: string;
  version?: string;
}

/** Agents, then workflows: every version (runs) or the workflow itself, evaluated in its published version (schedules). */
export function targetOptions(agents: EvalCtx['agents'], workflows: EvalCtx['workflows'], versions: boolean): TargetOpt[] {
  const out: TargetOpt[] = agents.map((a) => ({ label: `Agent: ${a.name}`, agentId: a.id }));
  for (const w of workflows) {
    if (!versions) out.push({ label: `Workflow: ${w.name}`, workflowId: w.id });
    else for (const v of w.versions) out.push({ label: `Workflow: ${w.name} · ${v.v} (${v.st.toLowerCase()})`, workflowId: w.id, version: v.v });
  }
  return out;
}

export const matches = (t: TargetOpt, p: { agentId?: string; workflowId?: string; version?: string }) =>
  (!!p.agentId && t.agentId === p.agentId) || (!!p.workflowId && t.workflowId === p.workflowId && (!p.version || !t.version || t.version === p.version));

export function scoringFields(o?: Partial<{ judge: boolean; min_correctness: number }>): FormField[] {
  const minc = MIN_CORRECT_OPTS.find((x) => parseInt(x, 10) === (o?.min_correctness ?? 4)) ?? MIN_CORRECT_OPTS[1];
  return [
    { type: 'select', k: 'judge', label: 'Scoring', val: o?.judge === false ? JUDGE_OPTS[1] : JUDGE_OPTS[0], opts: JUDGE_OPTS, hint: 'The AI judge uses the stand’s model server; facts are always checked.' },
    { type: 'select', k: 'minc', label: 'A judged answer passes from', val: minc, opts: MIN_CORRECT_OPTS },
  ];
}
export const scoringOf = (v: FormValues) => ({ judge: v.judge !== JUDGE_OPTS[1], min_correctness: parseInt(String(v.minc), 10) || 4 });

export function whenFields(every: number | null, onData: boolean, minPass: number | null): FormField[] {
  return [
    { type: 'select', k: 'every', label: 'On a schedule', val: everyL(every), opts: EVERY_OPTS.map(([l]) => l) },
    { type: 'select', k: 'data', label: 'After new data', val: onData ? 'Yes' : 'No', opts: ['Yes', 'No'], hint: 'When a PostgreSQL export into one of the agent’s collections (or the workflow’s agents’) finishes.' },
    { type: 'select', k: 'min', label: 'Mark as regressed below', val: (MIN_PASS_OPTS.find(([, x]) => x === minPass) ?? MIN_PASS_OPTS[0])[0], opts: MIN_PASS_OPTS.map(([l]) => l), hint: 'A run is also marked regressed when its pass rate falls, or a question that passed now fails.' },
  ];
}
export const whenOf = (v: FormValues) => ({
  every_minutes: EVERY_OPTS.find(([l]) => l === v.every)?.[1] ?? null,
  on_data: v.data === 'Yes',
  min_pass_rate: MIN_PASS_OPTS.find(([l]) => l === v.min)?.[1] ?? null,
});

export function caseFields(x?: EvalCase | null): FormField[] {
  return [
    { type: 'textarea', k: 'question', label: 'Question', val: x?.question ?? '', rows: 3, ph: 'What is the latest inflation rate?' },
    { type: 'textarea', k: 'expected', label: 'Expected answer', val: x?.expected ?? '', rows: 3, ph: '2.62% in April 2026', hint: 'What a correct answer says, in your own words. The AI judge compares the agent’s answer with it.' },
    { type: 'textarea', k: 'must_include', label: 'Must include', val: termsText(x?.must_include), rows: 3, ph: '2.62\nApril 2026', hint: 'Short facts the answer must contain, one per line: a number or a name, not a sentence. Numbers match at the precision you write. "Kuwait | الكويت" accepts either.' },
    { type: 'textarea', k: 'must_not_include', label: 'Must not include (optional)', val: termsText(x?.must_not_include), rows: 2, hint: 'One per line, e.g. a wrong figure or "I don’t know".' },
    { type: 'text', k: 'tags', label: 'Tags (optional)', val: (x?.tags ?? []).join('; '), hint: 'Separated by ;' },
  ];
}

export function caseOf(v: FormValues): EvalCaseIn {
  return { question: String(v.question ?? '').trim(), expected: String(v.expected ?? '').trim(), must_include: parseTerms(v.must_include), must_not_include: parseTerms(v.must_not_include), tags: parseTerms(v.tags) };
}

export function useEvals(c: AgentsC, pageReload?: () => Promise<void>): EvalCtx & { tid: string | null; reloadAll: () => Promise<void> } {
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const { live, st } = useEvalLists(c.tenant);
  const tid = live.tenantId;
  const canEdit = c.can('agent:update', 'agent', '*') || c.can('agent:create', 'agent', '*');
  const canRun = canEdit || c.can('agent:execute', 'agent', '*');
  const agents = React.useMemo(
    () => c.D.agents.map((a) => kapOf(a)).filter((k): k is NonNullable<typeof k> => !!k).map((k) => ({ id: k.agent.id, name: k.agent.name })),
    [c.D.agents],
  );
  const now = Date.now();

  return React.useMemo(() => {
    const enc = encodeURIComponent;
    const reloadAll = async () => {
      await live.reload();
      await pageReload?.();
    };
    /** run a platform write for a dialog: '' or the error message */
    const save = async (write: () => Promise<unknown>, after?: (x: any) => void): Promise<string> => {
      if (!tid) return 'This tenant is not live.';
      let out: unknown;
      try {
        out = await write();
      } catch (e) {
        return errorMessage(e);
      }
      after?.(out);
      await reloadAll();
      return '';
    };
    const go: EvalCtx['go'] = {
      sets: () => nav(`${base}/agents/evaluation`),
      set: (id) => nav(`${base}/agents/evaluation/${enc(id)}`),
      run: (id, vs) => nav(`${base}/agents/evaluation/runs/${enc(id)}${vs ? `?vs=${enc(vs)}` : ''}`),
      agent: (name) => nav(`${base}/agents/${enc(name)}/eval`),
      trace: (jobId) => nav(`${base}/monitoring/runs/${enc(jobId)}/trace`),
      workflow: (id) => nav(`${base}/workflows/${enc(id)}/eval`),
      wfRun: (wf, id) => nav(`${base}/workflows/${enc(wf)}/runs/${enc(id)}`),
    };
    const setFields = (s?: EvalSet): FormField[] => [
      { type: 'text', k: 'name', label: 'Name', val: s?.name ?? '', ph: 'Indicators QA' },
      { type: 'textarea', k: 'description', label: 'Description (optional)', val: s?.description ?? '', rows: 2, ph: 'Questions checked by hand against the Ask AI database' },
    ];
    const sets = st?.sets ?? [];
    const workflows = st?.workflows ?? [];

    const a: EvalCtx['a'] = {
      newSet: () =>
        d.form('New test set', setFields(), 'Create', (v) => {
          if (!String(v.name ?? '').trim()) return 'Enter a name.';
          return save(() => createEvalSet(tid!, { name: v.name.trim(), description: (v.description ?? '').trim() }), (s: EvalSet) => go.set(s.id));
        }),
      editSet: (s) =>
        d.form('Edit test set', setFields(s), 'Save', (v) => {
          if (!String(v.name ?? '').trim()) return 'Enter a name.';
          return save(() => patchEvalSet(tid!, s.id, { name: v.name.trim(), description: (v.description ?? '').trim() }));
        }),
      deleteSet: (s) =>
        d.confirm('Delete test set', `Delete ${s.name}, its ${s.case_count} questions and all its runs? KAP jobs and traces stay in Monitoring.`, [], 'Delete', async () => {
          const err = await save(() => deleteEvalSet(tid!, s.id), () => forgetSet(tid!, s.id));
          if (err) return err;
          go.sets();
        }),
      addCase: (s) =>
        d.form(`Add question · ${s.name}`, caseFields(), 'Add', (v) => {
          const x = caseOf(v);
          return caseProblem(x) || save(() => addEvalCases(tid!, s.id, [x]));
        }),
      editCase: (s, x0) =>
        d.form('Edit question', caseFields(x0), 'Save', (v) => {
          const x = caseOf(v);
          return caseProblem(x) || save(() => patchEvalCase(tid!, s.id, x0.id, x));
        }),
      deleteCase: (s, x0) => d.confirm('Delete question', x0.question, [], 'Delete', async () => (await save(() => deleteEvalCase(tid!, s.id, x0.id))) || undefined),
      importCsv: (s) =>
        d.form(
          `Import questions · ${s.name}`,
          [
            { type: 'note', tone: 'info', text: 'Choose a CSV file (or paste its text below). The first row names the columns: question (required), expected, must_include, must_not_include, tags. Separate several facts with ";". Tab-separated text copied from a spreadsheet works too.' },
            { type: 'file', k: 'file', label: 'CSV file', into: 'csv', accept: '.csv,.tsv,.txt,text/csv,text/plain' },
            { type: 'textarea', k: 'csv', label: 'Content', val: '', rows: 10, ph: CSV_EXAMPLE, hint: 'Filled from the file; you can check or edit it before importing.' },
            { type: 'select', k: 'mode', label: 'Existing questions', val: 'Keep them and add these', opts: ['Keep them and add these', 'Replace them with these'] },
          ],
          'Import',
          (v) => {
            const { cases, errors } = parseCasesCsv(String(v.csv ?? ''));
            if (!cases.length) return errors.join(' ') || 'No questions found.';
            const bad = cases.map((x, i) => [i, caseProblem(x)] as const).find(([, p]) => p);
            if (bad) return `Row ${bad[0] + 2}: ${bad[1]}`;
            return save(
              () => addEvalCases(tid!, s.id, cases, v.mode === 'Replace them with these'),
              () => d.toast(`Imported ${cases.length} ${cases.length === 1 ? 'question' : 'questions'}${errors.length ? ` · ${errors.join(' ')}` : ''}`),
            );
          },
        ),
      run: (p) => {
        const usable = sets.filter((s) => s.case_count > 0);
        if (!usable.length) return d.info('Run evaluation', 'Create a test set with at least one question first.');
        const targets = targetOptions(agents, workflows, true);
        if (!targets.length) return d.info('Run evaluation', 'No KAP agents or workflows in this tenant.');
        const s0 = usable.find((s) => s.id === p.setId) ?? usable[0];
        const t0 = targets.find((x) => matches(x, p)) ?? targets[0];
        d.form(
          'Run evaluation',
          [
            { type: 'select', k: 'set', label: 'Test set', val: setL(s0), opts: usable.map(setL) },
            { type: 'select', k: 'target', label: 'Agent or workflow', val: t0.label, opts: targets.map((x) => x.label), hint: 'A workflow runs every question through all its steps; pick the draft version to check it before publishing.' },
            { type: 'text', k: 'label', label: 'Label (optional)', val: '', ph: 'After the prompt change', hint: 'Helps you tell runs apart when you compare them.' },
            ...scoringFields(),
            { type: 'select', k: 'par', label: 'Questions at a time', val: '2', opts: PARALLEL_OPTS, hint: 'More is faster but loads the model server more.' },
            { type: 'note', tone: 'info', text: 'Every question runs for real (KAP jobs with the current configuration) and appears in Monitoring with its trace.' },
          ],
          'Start',
          (v) => {
            const s = usable.find((x) => setL(x) === v.set);
            const tg = targets.find((x) => x.label === v.target);
            if (!s || !tg) return 'Pick a test set and an agent or workflow.';
            return save(
              () =>
                startEvalRun(tid!, {
                  set_id: s.id,
                  ...(tg.agentId ? { agent_id: tg.agentId } : { workflow_id: tg.workflowId, version: tg.version }),
                  label: String(v.label ?? '').trim(),
                  ...scoringOf(v),
                  parallel: parseInt(String(v.par), 10) || 2,
                }),
              (r: EvalRun) => {
                putRun(tid!, r);
                go.run(r.id);
              },
            );
          },
        );
      },
      addSchedule: (p) => {
        const usable = sets.filter((s) => s.case_count > 0);
        if (!usable.length) return d.info('Add automatic run', 'Create a test set with at least one question first.');
        const targets = targetOptions(agents, workflows, false);
        if (!targets.length) return d.info('Add automatic run', 'No KAP agents or workflows in this tenant.');
        const s0 = usable.find((s) => s.id === p.setId) ?? usable[0];
        const t0 = targets.find((x) => matches(x, p)) ?? targets[0];
        d.form(
          'Add automatic run',
          [
            { type: 'select', k: 'set', label: 'Test set', val: setL(s0), opts: usable.map(setL) },
            { type: 'select', k: 'target', label: 'Agent or workflow', val: t0.label, opts: targets.map((x) => x.label), hint: 'A workflow is evaluated in its published version.' },
            ...whenFields(null, true, null),
            ...scoringFields(),
          ],
          'Add',
          (v) => {
            const s = usable.find((x) => setL(x) === v.set);
            const tg = targets.find((x) => x.label === v.target);
            if (!s || !tg) return 'Pick a test set and an agent or workflow.';
            const when = whenOf(v);
            if (!when.every_minutes && !when.on_data) return 'Choose when to run: on a schedule, after new data, or both.';
            return save(() =>
              createEvalSchedule(tid!, { set_id: s.id, ...(tg.agentId ? { agent_id: tg.agentId } : { workflow_id: tg.workflowId }), ...when, options: { ...scoringOf(v), parallel: 2 } }),
            );
          },
        );
      },
      editSchedule: (sc) =>
        d.form(
          'Edit automatic run',
          [
            ...whenFields(sc.every_minutes, sc.on_data, sc.min_pass_rate),
            ...scoringFields(sc.options),
            { type: 'select', k: 'enabled', label: 'Status', val: sc.enabled ? 'Active' : 'Paused', opts: ['Active', 'Paused'] },
          ],
          'Save',
          (v) => {
            const when = whenOf(v);
            if (!when.every_minutes && !when.on_data) return 'Choose when to run: on a schedule, after new data, or both.';
            return save(() => patchEvalSchedule(tid!, sc.id, { ...when, options: { ...sc.options, ...scoringOf(v) }, enabled: v.enabled !== 'Paused' }));
          },
        ),
      deleteSchedule: (sc) => d.confirm('Delete automatic run', 'Stop running this test set automatically? Earlier runs are kept.', [], 'Delete', async () => (await save(() => deleteEvalSchedule(tid!, sc.id))) || undefined),
      cancel: (r) =>
        d.confirm('Cancel run', 'Stop sending questions? Questions not answered yet are marked as errors. Jobs already in KAP finish on their own.', [], 'Cancel run', async () => {
          const err = await save(() => cancelEvalRun(tid!, r.id), (x: EvalRun) => putRun(tid!, x));
          return err || undefined;
        }),
      removeRun: (r) =>
        d.confirm('Delete run', `Delete this run of ${r.set_name}? Its KAP jobs and traces stay in Monitoring.`, [], 'Delete', async () => {
          const err = await save(() => deleteEvalRun(tid!, r.id), () => forgetRun(tid!, r.id));
          if (err) return err;
          go.set(r.set_id);
        }),
      compareWith: (r) => {
        const others = (st?.runs ?? []).filter((x) => x.id !== r.id && x.set_id === r.set_id && x.status !== 'queued' && x.status !== 'running');
        if (!others.length) return d.info('Compare runs', 'No other finished run of this test set yet. Run it again (for example after changing the prompt) and compare.');
        const label = (x: EvalRun) => `${runLabelOf(x, now)} · ${x.agent_name ?? 'agent'} · ${x.summary ? `${x.summary.passed}/${x.summary.total} passed` : x.status}`;
        d.form('Compare with', [{ type: 'select', k: 'vs', label: 'Earlier run (the baseline)', val: label(others[0]), opts: others.map(label) }], 'Compare', (v) => {
          const x = others.find((y) => label(y) === v.vs);
          if (!x) return 'Pick a run.';
          go.run(r.id, x.id);
          return '';
        });
      },
      useAnswer: (r, x) => {
        const s = sets.find((y) => y.id === r.set_id);
        if (!s || !x.case_id) return;
        d.form(
          'Use this answer as the expected answer',
          [
            { type: 'note', tone: 'warn', text: 'Only do this after checking that the agent’s answer is right (for example the test question was wrong or out of date).' },
            { type: 'textarea', k: 'expected', label: 'Expected answer', val: x.answer ?? '', rows: 5 },
            { type: 'textarea', k: 'must_include', label: 'Must include', val: termsText(x.must_include), rows: 3, hint: 'One fact per line' },
          ],
          'Save to test set',
          (v) => save(() => patchEvalCase(tid!, s.id, x.case_id!, { expected: String(v.expected ?? '').trim(), must_include: parseTerms(v.must_include) }), () => d.toast('Saved. Run the test set again to check.')),
        );
      },
    };
    return { st, loading: live.loading, error: live.error, now, canEdit, canRun, agents, workflows, a, go, tid, reloadAll };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, live.loading, live.error, live.reload, tid, canEdit, canRun, agents, base, nav, d, pageReload]);
}

export { loadEvalRun, loadEvalSet };
