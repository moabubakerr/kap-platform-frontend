/**
 * Workflows through the platform API (our layer on top of KAP; KAP has no
 * workflow orchestration): `/api/platform/t/{tenantId}/workflows|workflow-runs`.
 *
 * The platform stores each workflow as the console's document (name, purpose,
 * versions with their graph) and runs a version step by step: agent steps are
 * ordinary KAP jobs (traced in Monitoring); routers, validators, human review,
 * fallbacks and the output run in the platform.
 */
import { pgCall, type PgPage } from './platformPg';

export const WF_FEATURE_MISSING = 'The platform API on the test stand does not have workflows yet — update platform-api (migration 0007).';

export interface WfDocRecord {
  id: string;
  /** the console's Workflow without `id` and the session metrics */
  doc: Record<string, unknown>;
  last_run: { id: string; status: WfRunStatus; version: string; created_at: string; finished_at: string | null } | null;
  created_at: string;
  updated_at: string;
}

export type WfRunStatus = 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled';
export type WfStepStatus = 'pending' | 'running' | 'waiting' | 'done' | 'failed' | 'skipped';

export interface WfRunStep {
  node_id: string;
  kind: string;
  label: string;
  status: WfStepStatus;
  /** order in which the step started (null: never started) */
  seq: number | null;
  input: string | null;
  output: string | null;
  note: string | null;
  /** router: the node ids of the paths taken */
  chosen: string[] | null;
  job_id: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
}

export interface WfRunRec {
  id: string;
  workflow_id: string;
  workflow_name: string | null;
  version: string;
  trigger: 'test' | 'api' | 'eval' | 'schedule';
  input: string;
  status: WfRunStatus;
  answer: string | null;
  error: string | null;
  fallback_used: boolean;
  agent_jobs: number;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /** list: [node id, status, seq] per step in run order */
  path?: [string, WfStepStatus, number | null][];
  /** single run: the graph as run and every step */
  cfg?: Record<string, unknown>;
  steps?: WfRunStep[];
}

export interface WfRunStart {
  workflow_id: string;
  input: string;
  version?: string;
  /** a test of the designer's unsaved changes */
  cfg?: unknown;
  trigger?: 'test' | 'api' | 'eval' | 'schedule';
  created_by?: string;
}

export const listWorkflows = (tid: string) => pgCall<PgPage<WfDocRecord>>(tid, 'GET', 'workflows');
export const putWorkflow = (tid: string, id: string, doc: unknown) => pgCall<WfDocRecord>(tid, 'PUT', `workflows/${encodeURIComponent(id)}`, { doc });
export const deleteWorkflow = (tid: string, id: string) => pgCall<void>(tid, 'DELETE', `workflows/${encodeURIComponent(id)}`);
export const listWfRuns = (tid: string, q: { workflow_id?: string; limit?: number; offset?: number } = {}) => pgCall<PgPage<WfRunRec>>(tid, 'GET', 'workflow-runs', undefined, { limit: 200, ...q });
export const getWfRun = (tid: string, id: string) => pgCall<WfRunRec>(tid, 'GET', `workflow-runs/${id}`);
/** 422 `workflow_invalid` (data.problems) when the graph cannot run; 409 when the workflow is disabled. */
export const startWfRun = (tid: string, body: WfRunStart) => pgCall<WfRunRec>(tid, 'POST', 'workflow-runs', body);
export const cancelWfRun = (tid: string, id: string) => pgCall<WfRunRec>(tid, 'POST', `workflow-runs/${id}/cancel`);
export const reviewWfStep = (tid: string, runId: string, nodeId: string, body: { approve: boolean; answer?: string; comment?: string }) =>
  pgCall<WfRunRec>(tid, 'POST', `workflow-runs/${runId}/steps/${encodeURIComponent(nodeId)}/review`, body);
