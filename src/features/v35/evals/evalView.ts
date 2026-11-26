/**
 * Evaluations (live tenant, platform API): labels, formatting, CSV import of
 * test questions and the comparison of two runs. Pure: no React, no fetches.
 */
import type { DsStatus } from '@/engine/types';
import type { EvalCaseIn, EvalResult, EvalRun, EvalRunStatus, EvalSummary } from '@/api/platformEval';
import { relTime } from '@/features/v35/agents/fromKap';

// ------------------------------------------------------------------ labels
export const RUN_STATUS_L: Record<EvalRunStatus, string> = { queued: 'Queued', running: 'Running', succeeded: 'Finished', failed: 'Failed', cancelled: 'Cancelled' };

/** The run's label, or when it started. */
export function runLabelOf(r: Pick<EvalRun, 'label' | 'created_at'>, now = Date.now()): string {
  return r.label || `Run ${relTime(r.created_at, now)}`;
}

export const isActiveRun =(r: Pick<EvalRun, 'status'> | null | undefined) => !!r && (r.status === 'queued' || r.status === 'running');

export function pct(x: number | null | undefined): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`;
}

export function score5(x: number | null | undefined): string {
  return x == null ? '—' : `${Math.round(x * 10) / 10} / 5`;
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${(Math.round(s * 10) / 10).toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s - m * 60)} s`;
}

export function fmtTokens(n: number | null | undefined): string {
  if (n == null) return '—';
  return n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString('en-US');
}

/** "7 of 10 passed", or progress while the run is going. */
export function runOutcome(r: Pick<EvalRun, 'status' | 'summary'>): string {
  const s = r.summary;
  if (!s) return isActiveRun(r) ? 'Starting' : RUN_STATUS_L[r.status];
  if (isActiveRun(r)) return `${s.done} of ${s.total} answered`;
  return `${s.passed} of ${s.total} passed`;
}

/** Status pill of a run: running, all passed, some failed, failed, cancelled. */
export function runPill(r: Pick<EvalRun, 'status' | 'summary'>): [DsStatus, string] {
  if (isActiveRun(r)) return ['submitted', r.status === 'queued' ? 'Queued' : 'Running'];
  if (r.status === 'failed') return ['rejected', 'Run failed'];
  if (r.status === 'cancelled') return ['draft', 'Cancelled'];
  const s = r.summary;
  if (!s || !s.total) return ['draft', 'No questions'];
  if (s.passed === s.total) return ['approved', 'All passed'];
  if (s.passed === 0) return ['rejected', 'None passed'];
  return ['hold', `${s.total - s.passed} failed`];
}

export function resultPill(r: Pick<EvalResult, 'status' | 'passed'>): [DsStatus, string] {
  switch (r.status) {
    case 'pending':
      return ['draft', 'Waiting'];
    case 'submitted':
      return ['submitted', 'Agent working'];
    case 'answered':
      return ['submitted', 'Scoring'];
    case 'error':
      return ['rejected', 'Error'];
    default:
      return r.passed ? ['approved', 'Passed'] : ['rejected', 'Failed'];
  }
}

/** The judge's three scores in one line, e.g. "Correct 5 · Grounded 4 · Complete 5". */
export function judgeLine(j: EvalResult['judge']): string {
  if (!j) return '';
  if (j.error) return `Judge unavailable: ${j.error}`;
  const parts: string[] = [];
  if (j.correctness != null) parts.push(`Correct ${j.correctness}`);
  if (j.grounding != null) parts.push(`Grounded ${j.grounding}`);
  if (j.completeness != null) parts.push(`Complete ${j.completeness}`);
  return parts.join(' · ');
}

/** Top-of-run figures. */
export function summaryStats(s: EvalSummary | null, judged: boolean): { k: string; v: string; c: string }[] {
  if (!s) return [];
  return [
    { k: 'Pass rate', v: pct(s.pass_rate), c: s.pass_rate == null ? '#8C8487' : s.pass_rate >= 0.8 ? 'var(--success)' : s.pass_rate >= 0.5 ? 'var(--warning)' : 'var(--danger)' },
    { k: 'Passed', v: `${s.passed} / ${s.total}`, c: 'var(--success)' },
    { k: 'Failed', v: String(s.failed + s.errors), c: 'var(--danger)' },
    { k: 'Facts found', v: s.checks_total ? `${s.checks_passed} / ${s.checks_total}` : '—', c: 'var(--brand)' },
    ...(judged ? [{ k: 'Correctness', v: score5(s.correctness), c: 'var(--info)' }, { k: 'Grounding', v: score5(s.grounding), c: 'var(--info)' }] : []),
    { k: 'Latency p95', v: fmtMs(s.latency_ms_p95), c: '#8C8487' },
    { k: 'Tokens', v: fmtTokens(s.tokens_total), c: '#8C8487' },
  ];
}

// ------------------------------------------------------------------ terms
/** Terms typed one per line (or separated by ";"). */
export function parseTerms(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n|;/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** '' or why a question cannot be saved: no question, nothing to check, or a sentence where a short fact belongs. */
export function caseProblem(x: EvalCaseIn): string {
  if (!x.question.trim()) return 'Enter the question.';
  if (!x.must_include?.length && !x.expected?.trim()) return 'Add the expected answer, or at least one fact the answer must include, so the answer can be checked.';
  // a sentence: more than 5 words, or a number with 2+ other words ("2.62% in April 2026"); names like "Ministry of Public Health" are fine
  const sentence = (alt: string) => {
    const w = alt.trim().split(/\s+/);
    return w.length > 5 || (w.length >= 3 && /\d/.test(alt));
  };
  const long = [...(x.must_include ?? []), ...(x.must_not_include ?? [])].find((t) => t.split('|').some(sentence));
  if (long) return `"${long}" is a sentence. Facts are found word for word, so keep each one short (a number or a name, e.g. 2.62 and April 2026) and put the full answer in Expected answer.`;
  return '';
}

export const termsText =(terms: string[] | null | undefined) => (terms ?? []).join('\n');

// ------------------------------------------------------------------ CSV import
export const CSV_COLUMNS = ['question', 'expected', 'must_include', 'must_not_include', 'tags'] as const;
export const CSV_EXAMPLE = 'question,expected,must_include,must_not_include,tags\n"What is the latest inflation rate?","2.62% in April 2026","2.62;April 2026",,inflation';

/** RFC 4180-ish: quotes, doubled quotes, commas/newlines inside quotes. Tab-separated when the header has tabs. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.trim() === '') {
      field = ''; // spaces before an opening quote (indented copy) are not part of the field
      quoted = true;
    }
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Questions from a CSV with a header row (question required; must_include etc. separated by ";"). */
export function parseCasesCsv(text: string): { cases: EvalCaseIn[]; errors: string[] } {
  const rows = parseCsv(text);
  if (!rows.length) return { cases: [], errors: ['The file is empty.'] };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const col = (name: string) => head.indexOf(name);
  if (col('question') < 0) return { cases: [], errors: [`The first row must name the columns; "question" is required. Columns: ${CSV_COLUMNS.join(', ')}.`] };
  const unknown = head.filter((h) => h && !(CSV_COLUMNS as readonly string[]).includes(h));
  const errors: string[] = unknown.length ? [`Ignored columns: ${unknown.join(', ')}.`] : [];
  const cases: EvalCaseIn[] = [];
  rows.slice(1).forEach((r, i) => {
    const get = (name: string) => (col(name) >= 0 ? (r[col(name)] ?? '').trim() : '');
    const question = get('question');
    if (!question) {
      errors.push(`Row ${i + 2}: no question; skipped.`);
      return;
    }
    cases.push({ question, expected: get('expected'), must_include: parseTerms(get('must_include')), must_not_include: parseTerms(get('must_not_include')), tags: parseTerms(get('tags')) });
  });
  if (!cases.length && !errors.length) errors.push('The file has a header but no questions.');
  return { cases, errors };
}

// ------------------------------------------------------------------ comparing runs
export type Change = 'fixed' | 'broken' | 'still passing' | 'still failing' | 'only in A' | 'only in B' | 'not finished';

export interface CompareRow {
  key: string;
  question: string;
  a?: EvalResult;
  b?: EvalResult;
  change: Change;
}

const done = (r?: EvalResult) => !!r && (r.status === 'scored' || r.status === 'error');

/** Question by question: A = the earlier run (baseline), B = the later one. Matched by test case, else by question text. */
export function compareRuns(a: EvalRun, b: EvalRun): CompareRow[] {
  const keyOf = (r: EvalResult) => r.case_id ?? `q:${r.question.trim().toLowerCase()}`;
  const A = new Map((a.results ?? []).map((r) => [keyOf(r), r]));
  const rows: CompareRow[] = [];
  const seen = new Set<string>();
  for (const rb of b.results ?? []) {
    const k = keyOf(rb);
    seen.add(k);
    const ra = A.get(k);
    rows.push({ key: k, question: rb.question, a: ra, b: rb, change: changeOf(ra, rb) });
  }
  for (const [k, ra] of A) if (!seen.has(k)) rows.push({ key: k, question: ra.question, a: ra, change: 'only in A' });
  return rows;
}

function changeOf(a: EvalResult | undefined, b: EvalResult): Change {
  if (!a) return 'only in B';
  if (!done(a) || !done(b)) return 'not finished';
  if (a.passed && b.passed) return 'still passing';
  if (!a.passed && !b.passed) return 'still failing';
  return b.passed ? 'fixed' : 'broken';
}

export const CHANGE_PILL: Record<Change, [DsStatus, string]> = {
  fixed: ['approved', 'Fixed'],
  broken: ['rejected', 'Broken'],
  'still passing': ['approved', 'Still passing'],
  'still failing': ['hold', 'Still failing'],
  'only in A': ['draft', 'Only in the baseline'],
  'only in B': ['draft', 'New question'],
  'not finished': ['submitted', 'Not finished'],
};

/** "2 fixed · 1 broken" — the headline of a comparison. */
export function compareHeadline(rows: CompareRow[]): string {
  const n = (c: Change) => rows.filter((r) => r.change === c).length;
  const parts = [`${n('fixed')} fixed`, `${n('broken')} broken`, `${n('still failing')} still failing`, `${n('still passing')} still passing`];
  return parts.join(' · ');
}

/** What changed in the agent between two runs (from the settings saved with each run). */
export function agentChanges(a: EvalRun, b: EvalRun): string[] {
  const x = a.agent ?? {};
  const y = b.agent ?? {};
  const out: string[] = [];
  if (a.agent_id !== b.agent_id) out.push(`Different agents: ${a.agent_name ?? a.agent_id} → ${b.agent_name ?? b.agent_id}`);
  if (x.model_ref !== y.model_ref) out.push(`Model: ${x.model_ref ?? '—'} → ${y.model_ref ?? '—'}`);
  const list = (v?: string[]) => [...(v ?? [])].sort().join(', ') || 'none';
  if (list(x.collections) !== list(y.collections)) out.push(`Collections: ${list(x.collections)} → ${list(y.collections)}`);
  if (list(x.allowed_tools) !== list(y.allowed_tools)) out.push(`Tools: ${list(x.allowed_tools)} → ${list(y.allowed_tools)}`);
  if (!out.length && x.updated_at && y.updated_at && x.updated_at !== y.updated_at) out.push('Configuration changed in KAP (for example the system prompt, which KAP does not return)');
  return out;
}

/** The run before this one: same set and agent, finished, created earlier. */
export function previousRun(runs: EvalRun[], r: EvalRun): EvalRun | undefined {
  return runs
    .filter((x) => x.id !== r.id && x.set_id === r.set_id && x.agent_id === r.agent_id && x.status === 'succeeded' && Date.parse(x.created_at) < Date.parse(r.created_at))
    .sort((p, q) => Date.parse(q.created_at) - Date.parse(p.created_at))[0];
}
