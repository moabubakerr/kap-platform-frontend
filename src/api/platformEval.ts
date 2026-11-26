/**
 * Evaluations through the platform API (our layer on top of KAP):
 * `/api/platform/t/{tenantId}/eval-sets|eval-runs` → platform `/api/t/{tid}/…`.
 *
 * A test set is a list of questions with what a correct answer must contain.
 * An evaluation run sends every question of a set to one KAP agent as a real
 * job (traced in Monitoring), then scores each answer: fact checks (numbers
 * compared as numbers) and an AI judge (correctness, grounding, completeness).
 * KAP itself has no evaluation; all of this runs in the platform.
 */
import { pgCall, type PgPage } from './platformPg';

export const EVAL_FEATURE_MISSING = 'The platform API on the test stand does not have evaluations yet — update platform-api (migration 0006).';

// ------------------------------------------------------------------ wire types
export interface EvalCase {
  id: string;
  position: number;
  question: string;
  /** reference answer, for the judge ('' = none) */
  expected: string;
  /** facts the answer must contain; "a | b" = either */
  must_include: string[];
  must_not_include: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}
export type EvalCaseIn = Pick<EvalCase, 'question'> & Partial<Pick<EvalCase, 'expected' | 'must_include' | 'must_not_include' | 'tags'>>;

export type EvalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type EvalResultStatus = 'pending' | 'submitted' | 'answered' | 'scored' | 'error';

export interface EvalSummary {
  total: number;
  done: number;
  passed: number;
  failed: number;
  errors: number;
  /** 0–1, null before any question is done */
  pass_rate: number | null;
  checks_passed: number;
  checks_total: number;
  /** judge averages, 1–5 */
  correctness: number | null;
  grounding: number | null;
  completeness: number | null;
  judged: number;
  latency_ms_avg: number | null;
  latency_ms_p95: number | null;
  tokens_total: number | null;
  tool_errors: number;
}

export interface EvalRunBrief {
  id: string;
  status: EvalRunStatus;
  agent_name: string | null;
  summary: EvalSummary | null;
  created_at: string;
  finished_at: string | null;
}

export interface EvalSet {
  id: string;
  name: string;
  description: string;
  case_count: number;
  last_run: EvalRunBrief | null;
  created_at: string;
  updated_at: string;
  /** on a single set (GET eval-sets/{id}) */
  cases?: EvalCase[];
}

export interface EvalOptions {
  judge: boolean;
  /** a judged answer passes from this correctness score (1–5; 0 = not required) */
  min_correctness: number;
  min_grounding: number;
  /** KAP jobs in flight at once */
  parallel: number;
}

export interface EvalCheck {
  kind: 'includes' | 'excludes';
  term: string;
  ok: boolean;
}
export interface EvalJudge {
  correctness?: number | null;
  grounding?: number | null;
  completeness?: number | null;
  reason?: string;
  model?: string;
  error?: string;
}
export interface EvalMetrics {
  latency_ms?: number | null;
  queue_ms?: number | null;
  tokens?: number;
  model_calls?: number;
  tool_calls?: number;
  tool_errors?: number;
  tools?: string[];
}

export interface EvalResult {
  id: string;
  case_id: string | null;
  position: number;
  question: string;
  expected: string;
  must_include: string[];
  must_not_include: string[];
  status: EvalResultStatus;
  job_id: string | null;
  job_status: string | null;
  answer: string | null;
  checks: EvalCheck[] | null;
  judge: EvalJudge | null;
  passed: boolean | null;
  reason: string | null;
  metrics: EvalMetrics | null;
  error: string | null;
  submitted_at: string | null;
  answered_at: string | null;
  scored_at: string | null;
}

export interface EvalRun {
  id: string;
  set_id: string;
  set_name: string;
  agent_id: string;
  agent_name: string | null;
  /** agent settings when the run started */
  agent: { name?: string; type?: string; model_ref?: string; collections?: string[]; allowed_tools?: string[]; updated_at?: string } | null;
  label: string;
  options: EvalOptions;
  status: EvalRunStatus;
  summary: EvalSummary | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /** on a single run (GET eval-runs/{id}) */
  results?: EvalResult[];
}

export interface EvalRunStart {
  set_id: string;
  agent_id: string;
  label?: string;
  judge?: boolean;
  min_correctness?: number;
  min_grounding?: number;
  parallel?: number;
}

// ------------------------------------------------------------------ calls
export const listEvalSets = (tid: string) => pgCall<PgPage<EvalSet>>(tid, 'GET', 'eval-sets');
export const getEvalSet = (tid: string, id: string) => pgCall<EvalSet>(tid, 'GET', `eval-sets/${id}`);
export const createEvalSet = (tid: string, body: { name: string; description?: string; cases?: EvalCaseIn[] }) => pgCall<EvalSet>(tid, 'POST', 'eval-sets', body);
export const patchEvalSet = (tid: string, id: string, body: { name?: string; description?: string }) => pgCall<EvalSet>(tid, 'PATCH', `eval-sets/${id}`, body);
/** 409 while a run of the set is going. */
export const deleteEvalSet = (tid: string, id: string) => pgCall<void>(tid, 'DELETE', `eval-sets/${id}`);
export const addEvalCases = (tid: string, setId: string, cases: EvalCaseIn[], replace = false) => pgCall<EvalSet>(tid, 'POST', `eval-sets/${setId}/cases`, { cases, replace });
export const patchEvalCase = (tid: string, setId: string, caseId: string, body: Partial<EvalCaseIn>) => pgCall<EvalCase>(tid, 'PATCH', `eval-sets/${setId}/cases/${caseId}`, body);
export const deleteEvalCase = (tid: string, setId: string, caseId: string) => pgCall<void>(tid, 'DELETE', `eval-sets/${setId}/cases/${caseId}`);

export const listEvalRuns = (tid: string, q: { set_id?: string; agent_id?: string; limit?: number; offset?: number } = {}) => pgCall<PgPage<EvalRun>>(tid, 'GET', 'eval-runs', undefined, { limit: 100, ...q });
export const getEvalRun = (tid: string, id: string) => pgCall<EvalRun>(tid, 'GET', `eval-runs/${id}`);
/** 409 when the set is already running against the agent; 422 when the set has no questions. */
export const startEvalRun = (tid: string, body: EvalRunStart) => pgCall<EvalRun>(tid, 'POST', 'eval-runs', body);
export const cancelEvalRun = (tid: string, id: string) => pgCall<EvalRun>(tid, 'POST', `eval-runs/${id}/cancel`);
export const deleteEvalRun = (tid: string, id: string) => pgCall<void>(tid, 'DELETE', `eval-runs/${id}`);
