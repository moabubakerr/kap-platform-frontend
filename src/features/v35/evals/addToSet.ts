/**
 * "Add to test set": turn a real question (from Monitoring, the Playground or a
 * workflow run) into a test question in one step. The agent's answer is offered
 * as the expected answer to check and correct before saving.
 */
import * as React from 'react';
import { useDialogs } from '@/engine/dialogs';
import { addEvalCases, createEvalSet, listEvalSets } from '@/api/platformEval';
import { caseProblem, parseTerms, numbersOf } from './evalView';

export interface CaseSeed {
  question: string;
  /** the answer given (offered as the expected answer) */
  answer?: string | null;
  /** where it came from, kept as a tag ("monitoring", "playground", "workflow") */
  source: string;
}

const NEW_SET = 'New test set…';

export function useAddToTestSet(tenantId: string | null | undefined) {
  const d = useDialogs();
  return React.useCallback(
    async (seed: CaseSeed) => {
      if (!tenantId) return;
      let names: { id: string; name: string }[] = [];
      try {
        names = (await listEvalSets(tenantId)).items.map((s) => ({ id: s.id, name: s.name }));
      } catch (e) {
        d.info('Add to test set', `Could not load the test sets from the platform API: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      const facts = numbersOf(seed.answer ?? '').slice(0, 4);
      d.form(
        'Add to test set',
        [
          { type: 'select', k: 'set', label: 'Test set', val: names[0]?.name ?? NEW_SET, opts: [...names.map((s) => s.name), NEW_SET] },
          { type: 'text', k: 'newName', label: 'Name of the new test set (when creating one)', val: '', ph: 'Indicators QA' },
          { type: 'textarea', k: 'question', label: 'Question', val: seed.question, rows: 3 },
          {
            type: 'textarea', k: 'expected', label: 'Expected answer', val: seed.answer ?? '', rows: 4,
            hint: 'This is the answer the agent gave. Correct it if it was wrong: the test checks future answers against it.',
          },
          { type: 'textarea', k: 'must_include', label: 'Must include', val: facts.join('\n'), rows: 3, hint: 'Short facts, one per line: the numbers or names a correct answer must contain.' },
          { type: 'textarea', k: 'must_not_include', label: 'Must not include (optional)', val: '', rows: 2 },
        ],
        'Add',
        async (v) => {
          const c = {
            question: String(v.question ?? '').trim(),
            expected: String(v.expected ?? '').trim(),
            must_include: parseTerms(v.must_include),
            must_not_include: parseTerms(v.must_not_include),
            tags: [seed.source],
          };
          const problem = caseProblem(c);
          if (problem) return problem;
          try {
            if (v.set === NEW_SET) {
              const name = String(v.newName ?? '').trim();
              if (!name) return 'Enter a name for the new test set.';
              await createEvalSet(tenantId, { name, cases: [c] });
              d.toast(`Created test set ${name} with this question.`);
            } else {
              const s = names.find((x) => x.name === v.set);
              if (!s) return 'Pick a test set.';
              await addEvalCases(tenantId, s.id, [c]);
              d.toast(`Added to ${s.name}.`);
            }
          } catch (e) {
            return e instanceof Error ? e.message : String(e);
          }
          return '';
        },
      );
    },
    [tenantId, d],
  );
}
