/**
 * Evaluation pages of the live tenant: platform data (useEvalLists), the KAP
 * agents (from the Agents hub), navigation and the dialog actions.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBase } from '@/app/shell/AppShell';
import { useDialogs, type FormField, type FormValues } from '@/engine/dialogs';
import {
  addEvalCases, cancelEvalRun, createEvalSet, deleteEvalCase, deleteEvalRun, deleteEvalSet, patchEvalCase, patchEvalSet, startEvalRun,
  type EvalCase, type EvalCaseIn, type EvalRun, type EvalSet,
} from '@/api/platformEval';
import { kapOf } from '@/features/v35/agents/fromKap';
import type { useAgents } from '@/features/v35/agents/useAgents';
import type { EvalCtx } from './evalBuild';
import { forgetRun, forgetSet, loadEvalRun, loadEvalSet, putRun, useEvalLists } from './evalLive';
import { CSV_EXAMPLE, parseCasesCsv, parseTerms, runLabelOf, termsText } from './evalView';

type AgentsC = ReturnType<typeof useAgents>;

/** Platform errors (PgApiError) already carry a readable message. */
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const JUDGE_OPTS = ['Facts and AI judge', 'Facts only'];
export const MIN_CORRECT_OPTS = ['5 — fully correct', '4 — correct, minor gaps', '3 — partly correct'];
export const PARALLEL_OPTS = ['1', '2', '3', '4'];

export function caseFields(x?: EvalCase | null): FormField[] {
  return [
    { type: 'textarea', k: 'question', label: 'Question', val: x?.question ?? '', rows: 3, ph: 'What was the inflation rate in March 2026 in Qatar and Kuwait?' },
    { type: 'textarea', k: 'must_include', label: 'Must include', val: termsText(x?.must_include), rows: 3, ph: '4.17\n2.06', hint: 'One fact per line. Numbers match at the precision you write. "Kuwait | الكويت" accepts either.' },
    { type: 'textarea', k: 'expected', label: 'Reference answer (optional)', val: x?.expected ?? '', rows: 3, hint: 'What a correct answer says. The AI judge compares the answer with it.' },
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
    };
    const setFields = (s?: EvalSet): FormField[] => [
      { type: 'text', k: 'name', label: 'Name', val: s?.name ?? '', ph: 'Indicators QA' },
      { type: 'textarea', k: 'description', label: 'Description (optional)', val: s?.description ?? '', rows: 2, ph: 'Questions checked by hand against the Ask AI database' },
    ];
    const sets = st?.sets ?? [];

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
          if (!x.question) return 'Enter the question.';
          if (!x.must_include?.length && !x.expected) return 'Add at least one fact the answer must include, or a reference answer, so the answer can be checked.';
          return save(() => addEvalCases(tid!, s.id, [x]));
        }),
      editCase: (s, x0) =>
        d.form('Edit question', caseFields(x0), 'Save', (v) => {
          const x = caseOf(v);
          if (!x.question) return 'Enter the question.';
          return save(() => patchEvalCase(tid!, s.id, x0.id, x));
        }),
      deleteCase: (s, x0) => d.confirm('Delete question', x0.question, [], 'Delete', async () => (await save(() => deleteEvalCase(tid!, s.id, x0.id))) || undefined),
      importCsv: (s) =>
        d.form(
          `Import questions · ${s.name}`,
          [
            { type: 'note', tone: 'info', text: 'Paste CSV with a header row. Columns: question (required), expected, must_include, must_not_include, tags. Separate several facts with ";". Tab-separated text from a spreadsheet works too.' },
            { type: 'textarea', k: 'csv', label: 'CSV', val: '', rows: 10, ph: CSV_EXAMPLE },
            { type: 'select', k: 'mode', label: 'Existing questions', val: 'Keep them and add these', opts: ['Keep them and add these', 'Replace them with these'] },
          ],
          'Import',
          (v) => {
            const { cases, errors } = parseCasesCsv(String(v.csv ?? ''));
            if (!cases.length) return errors.join(' ') || 'No questions found.';
            return save(
              () => addEvalCases(tid!, s.id, cases, v.mode === 'Replace them with these'),
              () => d.toast(`Imported ${cases.length} ${cases.length === 1 ? 'question' : 'questions'}${errors.length ? ` · ${errors.join(' ')}` : ''}`),
            );
          },
        ),
      run: ({ setId, agentId }) => {
        const usable = sets.filter((s) => s.case_count > 0);
        if (!usable.length) return d.info('Run evaluation', 'Create a test set with at least one question first.');
        if (!agents.length) return d.info('Run evaluation', 'No KAP agents in this tenant.');
        const setL = (s: EvalSet) => `${s.name} (${s.case_count} ${s.case_count === 1 ? 'question' : 'questions'})`;
        const s0 = usable.find((s) => s.id === setId) ?? usable[0];
        const a0 = agents.find((x) => x.id === agentId) ?? agents[0];
        d.form(
          'Run evaluation',
          [
            { type: 'select', k: 'set', label: 'Test set', val: setL(s0), opts: usable.map(setL) },
            { type: 'select', k: 'agent', label: 'Agent', val: a0.name, opts: agents.map((x) => x.name) },
            { type: 'text', k: 'label', label: 'Label (optional)', val: '', ph: 'After the prompt change', hint: 'Helps you tell runs apart when you compare them.' },
            { type: 'select', k: 'judge', label: 'Scoring', val: JUDGE_OPTS[0], opts: JUDGE_OPTS, hint: 'The AI judge uses the stand’s model server; facts are always checked.' },
            { type: 'select', k: 'minc', label: 'A judged answer passes from', val: MIN_CORRECT_OPTS[1], opts: MIN_CORRECT_OPTS },
            { type: 'select', k: 'par', label: 'Questions at a time', val: '2', opts: PARALLEL_OPTS, hint: 'More is faster but loads the model server more.' },
            { type: 'note', tone: 'info', text: 'Every question runs as a real KAP job with the agent’s current configuration, and appears in Monitoring with its trace.' },
          ],
          'Start',
          (v) => {
            const s = usable.find((x) => setL(x) === v.set);
            const ag = agents.find((x) => x.name === v.agent);
            if (!s || !ag) return 'Pick a test set and an agent.';
            return save(
              () =>
                startEvalRun(tid!, {
                  set_id: s.id,
                  agent_id: ag.id,
                  label: String(v.label ?? '').trim(),
                  judge: v.judge === JUDGE_OPTS[0],
                  min_correctness: parseInt(String(v.minc), 10) || 4,
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
          'Use this answer as reference',
          [
            { type: 'note', tone: 'warn', text: 'Only do this after checking that the agent’s answer is right (for example the test question was wrong or out of date).' },
            { type: 'textarea', k: 'expected', label: 'Reference answer', val: x.answer ?? '', rows: 5 },
            { type: 'textarea', k: 'must_include', label: 'Must include', val: termsText(x.must_include), rows: 3, hint: 'One fact per line' },
          ],
          'Save to test set',
          (v) => save(() => patchEvalCase(tid!, s.id, x.case_id!, { expected: String(v.expected ?? '').trim(), must_include: parseTerms(v.must_include) }), () => d.toast('Saved. Run the test set again to check.')),
        );
      },
    };
    return { st, loading: live.loading, error: live.error, now, canEdit, canRun, agents, a, go, tid, reloadAll };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, live.loading, live.error, live.reload, tid, canEdit, canRun, agents, base, nav, d, pageReload]);
}

export { loadEvalRun, loadEvalSet };
