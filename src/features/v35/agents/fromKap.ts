/**
 * KAP agents ↔ the Agent Factory's agent type (live tenant). Pure: tested in
 * fromKap.test.ts with fixtures shaped from KAP's OpenAPI (AgentOut,
 * AgentJobListItemOut, CollectionOut, ModelProviderOut, AgentSchemaOut).
 *
 * KAP keeps ONE configuration per agent: no versions, approvals, evaluation
 * gate or emergency disable. The mapped agent therefore has a single version
 * `v1` that stands for "the configuration in KAP"; session-only drafts and
 * evaluations made in the console are kept next to it across reloads
 * (`mergeAgents`) and never sent to KAP.
 */
import type { FormValues } from '@/engine/dialogs';
import type { Agent, AgentCfg, AfMetrics, Version } from '@/v35/data/agentFactory';
import type { CollSearchInfo } from './searchBlock';

// ---------------------------------------------------------------- wire types (KAP OpenAPI)
export type KapAgentType = 'workflow' | 'planner_and_executor';

export interface KapAgentConfig {
  input_schema_ref?: string | null;
  output_schema_ref?: string | null;
  user_prompt?: string | null;
  [k: string]: unknown;
}

/** Numeric limits an agent carries (null = KAP default). */
export const KAP_LIMITS = [
  ['timeout_seconds', 'Timeout (seconds)', 1, 3600],
  ['request_limit', 'Model requests per job', 1, 500],
  ['tool_calls_limit', 'Tool calls per job', 1, 1000],
  ['max_retries', 'Job retries', 0, 10],
  ['output_retries', 'Output retries', 0, 10],
  ['input_tokens_limit', 'Input tokens', 1, 2_000_000],
  ['output_tokens_limit', 'Output tokens', 1, 500_000],
  ['total_tokens_limit', 'Total tokens', 1, 2_500_000],
] as const;
export type KapLimitKey = (typeof KAP_LIMITS)[number][0];

/** AgentOut. `system_prompt` is write-only: KAP returns only `system_prompt_is_set`. */
export interface KapAgent extends Record<KapLimitKey, number | null> {
  id: string;
  name: string;
  type: KapAgentType;
  description: string;
  model_ref: string;
  collections: string[];
  system_prompt_is_set: boolean;
  allowed_tools: string[];
  count_tokens_before_request: boolean | null;
  task_priority: number | null;
  max_in_flight_tasks: number | null;
  config: KapAgentConfig;
  created_at: string;
  updated_at: string;
}

export type KapJobStatus = 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled';
/** AgentJobListItemOut */
export interface KapJob {
  id: string;
  agent_id: string;
  created_by: string | null;
  status: KapJobStatus;
  retry_count: number;
  user_prompt: string | null;
  payload?: Record<string, unknown> | null;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at?: string;
  running_at: string | null;
  finished_at: string | null;
}

export interface KapCollection { id: string; name: string }
export interface KapModelProvider { id: string; name: string; model_type: 'chat' | 'embedding' | string; model_name: string }
export interface KapAgentSchema { id: string; name: string; description: string }

/** KAP data kept on a live agent (extra field on the store's Agent). */
export interface KapAgentData {
  agent: KapAgent;
  /** newest jobs (up to 10) */
  jobs: KapJob[];
  /** jobs created in the last 7 days (null = not loaded) */
  jobs7d: number | null;
}
export type LiveAgent = Agent & { kap?: KapAgentData };
export const kapOf = (a: Agent | undefined | null): KapAgentData | undefined => (a as LiveAgent | undefined)?.kap;

/** A test job submitted from the Testing tab (trace in Monitoring). */
export interface LiveTest { id: string; q: string; at: number }

/** Option lists for the live pickers (real KAP names). */
export interface LiveOpts {
  collections: string[];
  /** chat model providers */
  models: string[];
  schemas: string[];
  /** tool names seen in agents' allowed_tools */
  tools: string[];
  /** agent search info per collection name (kind, searchable, group ids) */
  search?: Record<string, CollSearchInfo>;
}

export const TYPE_L: Record<KapAgentType, string> = { workflow: 'Workflow (one structured model call)', planner_and_executor: 'Planner and executor (tools loop)' };
export const TYPE_SHORT: Record<string, string> = { workflow: 'Workflow', planner_and_executor: 'Planner and executor' };

// ---------------------------------------------------------------- helpers
export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (isNaN(s)) return '—';
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86_400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86_400) + ' d ago';
}

export function fmtSecs(s: number): string {
  if (s < 60) return (Math.round(s * 10) / 10).toFixed(1) + ' s';
  const m = Math.floor(s / 60);
  return m + ' min ' + Math.round(s - m * 60) + ' s';
}

const jobSecs = (j: KapJob): number | null => (j.running_at && j.finished_at ? Math.max(0, (Date.parse(j.finished_at) - Date.parse(j.running_at)) / 1000) : null);

/** Status label used by the Agent Factory's pills (stP). */
export const JOB_ST: Record<KapJobStatus, string> = { waiting: 'Waiting', running: 'Running', succeeded: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled' };

/**
 * [requests, success %, p95 latency, tool error rate, model tokens (M)] from
 * the agent's recent jobs. Only what KAP's job list shows: tool error rate and
 * tokens are not in it ('—' / 0, shown as '—').
 */
export function jobMetrics(jobs: KapJob[], jobs7d: number | null, now = Date.now()): AfMetrics {
  const from = now - 7 * 86_400_000;
  const recent = jobs.filter((j) => Date.parse(j.created_at) >= from);
  const done = recent.filter((j) => j.status === 'succeeded' || j.status === 'failed');
  const ok = done.filter((j) => j.status === 'succeeded').length;
  const durs = done.map(jobSecs).filter((x): x is number => x != null).sort((a, b) => a - b);
  const p95 = durs.length ? fmtSecs(durs[Math.max(0, Math.ceil(durs.length * 0.95) - 1)]) : '—';
  const rate = done.length ? Math.round((ok / done.length) * 1000) / 10 : 0;
  return [jobs7d ?? recent.length, rate, p95, '—', 0];
}

/** Tool key as the Agent Factory stores it ('kap:' = native/KAP tool name). */
export const kapToolKey = (n: string) => (n.includes(':') ? n : 'kap:' + n);

/** The agent's configuration in the Agent Factory's shape. Fields KAP doesn't have get honest defaults. */
export function toCfg(k: KapAgent): AgentCfg {
  return {
    instr: k.system_prompt_is_set ? 'Set in KAP (KAP does not return the system prompt)' : 'Not set',
    model: k.model_ref,
    fb: 'None',
    multi: 'None',
    tools: k.tool_calls_limit ?? 0,
    dur: k.timeout_seconds != null ? k.timeout_seconds + ' s' : '—',
    tokens: k.total_tokens_limit != null ? String(k.total_tokens_limit) : '—',
    retries: k.max_retries != null ? String(k.max_retries) : '—',
    fail: '—',
    guards: [],
    tset: (k.allowed_tools || []).map(kapToolKey),
    gov: { tier: 'Informational', esc: 'None' },
    ent: { mode: 'Off', hops: '—', types: [] },
  };
}

/** KAP agent (+ recent jobs) → the store's agent. */
export function toAgent(k: KapAgent, jobs: KapJob[] = [], jobs7d: number | null = null, now = Date.now()): LiveAgent {
  const v1: Version<AgentCfg> = { v: 'v1', st: 'Published', at: relTime(k.updated_at, now), by: '—', note: 'Current configuration in KAP', cfg: toCfg(k) };
  return {
    id: k.name,
    purpose: k.description || '—',
    vers: [v1],
    dis: null,
    st: 'Published',
    evSets: [],
    thr: {},
    m: jobMetrics(jobs, jobs7d, now),
    owner: '—',
    kap: { agent: k, jobs: jobs.slice(0, 10), jobs7d },
  };
}

/**
 * Replace the tenant's agents with the KAP ones, keeping what the console adds
 * in the session (evaluation datasets, thresholds, session-only versions) for
 * agents that still exist (matched by KAP id, so renames keep it).
 */
export function mergeAgents(prev: Agent[], fresh: LiveAgent[]): LiveAgent[] {
  return fresh.map((a) => {
    const p = prev.find((x) => kapOf(x)?.agent.id === a.kap?.agent.id);
    if (!p) return a;
    const session = p.vers.filter((v) => v.v !== 'v1');
    const v1 = a.vers[0];
    if (session.some((v) => v.st === 'Published')) v1.st = 'Superseded';
    return { ...a, vers: session.concat([v1]), evSets: p.evSets, thr: p.thr };
  });
}

/** Tool grants per agent name, from allowed_tools. */
export const grantsOf = (agents: KapAgent[]): Record<string, string[]> => Object.fromEntries(agents.map((k) => [k.name, (k.allowed_tools || []).map(kapToolKey)]));

/** Option lists for the pickers from KAP lists (null = not available). */
export function liveOpts(agents: KapAgent[], colls: KapCollection[] | null, models: KapModelProvider[] | null, schemas: KapAgentSchema[] | null): LiveOpts {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    collections: uniq((colls || []).map((c) => c.name).concat(agents.flatMap((a) => a.collections || []))),
    models: uniq((models || []).filter((m) => m.model_type === 'chat').map((m) => m.name).concat(agents.map((a) => a.model_ref))),
    schemas: uniq((schemas || []).map((s) => s.name).concat(agents.flatMap((a) => [a.config?.input_schema_ref || '', a.config?.output_schema_ref || '']))),
    tools: uniq(agents.flatMap((a) => a.allowed_tools || [])),
  };
}

// ---------------------------------------------------------------- write bodies
export const NAME_RE = /^[a-zA-Z0-9_]{4,32}$/;
export const NAME_HINT = '4–32 characters: letters, digits and underscores.';
export const NONE = 'None';

/** Split a comma/whitespace separated list of extra names. */
export const splitList = (s: string | undefined) => (s || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

/** '' → null; else an integer in [min, max] or an error. */
export function parseLimit(raw: unknown, label: string, min: number, max: number): { v: number | null; err?: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { v: null };
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) return { v: null, err: label + ': a whole number from ' + min + ' to ' + max + ', or empty for the KAP default.' };
  return { v: n };
}

export type KapCreate = Partial<Record<KapLimitKey, number>> & {
  name: string;
  type: KapAgentType;
  description: string;
  model_ref: string;
  collections: string[];
  system_prompt: string;
  allowed_tools: string[];
  config?: { input_schema_ref?: string; output_schema_ref?: string; user_prompt?: string };
};
export type KapPatch = Partial<Record<KapLimitKey, number | null>> & {
  name?: string;
  description?: string;
  model_ref?: string;
  collections?: string[];
  system_prompt?: string;
  allowed_tools?: string[];
  config?: { input_schema_ref?: string | null; output_schema_ref?: string | null; user_prompt?: string | null };
};

const typeOf = (label: string): KapAgentType => (label === TYPE_L.planner_and_executor || label === 'planner_and_executor' ? 'planner_and_executor' : 'workflow');
const toolsOfV = (v: FormValues) => [...new Set(((v.tools as string[]) || []).concat(splitList(v.toolsX)))];
const schemaRef = (x: unknown) => (x && x !== NONE ? String(x) : undefined);

/** Create-agent wizard values → POST /api/agents body, or an error. */
export function toKapCreate(v: FormValues): { body?: KapCreate; err?: string } {
  const name = String(v.name || '').trim();
  if (!NAME_RE.test(name)) return { err: 'Agent name: ' + NAME_HINT };
  const model = String(v.model || '').trim();
  if (!model) return { err: 'Choose a model.' };
  const colls: string[] = v.colls || [];
  if (colls.length > 2) return { err: 'KAP allows at most two collections per agent.' };
  const type = typeOf(v.type);
  const body: KapCreate = {
    name,
    type,
    description: String(v.description || '').trim(),
    model_ref: model,
    collections: colls.slice(),
    system_prompt: String(v.prompt || '').trim(),
    allowed_tools: toolsOfV(v),
  };
  for (const [k, l, min, max] of KAP_LIMITS) {
    const r = parseLimit(v[k], l, min, max);
    if (r.err) return { err: r.err };
    if (r.v != null) body[k] = r.v;
  }
  if (type === 'workflow') {
    const cfg: NonNullable<KapCreate['config']> = {};
    const i = schemaRef(v.inSchema);
    const o = schemaRef(v.outSchema);
    const up = String(v.userPrompt || '').trim();
    if (i) cfg.input_schema_ref = i;
    if (o) cfg.output_schema_ref = o;
    if (up) cfg.user_prompt = up;
    if (Object.keys(cfg).length) body.config = cfg;
  }
  return { body };
}

/** Parts of the configuration the console edits (one form each). */
export type KapEdit = 'name' | 'description' | 'system_prompt' | 'model_ref' | 'collections' | 'allowed_tools' | 'limits' | 'io';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Edit form values → PATCH /api/agents/{id} body with only what changed, or an error ('No change.' when nothing did). */
export function toKapPatch(k: KapAgent, what: KapEdit, v: FormValues): { body?: KapPatch; err?: string } {
  const body: KapPatch = {};
  if (what === 'name') {
    const n = String(v.name || '').trim();
    if (!NAME_RE.test(n)) return { err: 'Agent name: ' + NAME_HINT };
    if (n !== k.name) body.name = n;
  }
  if (what === 'description') {
    const d = String(v.description || '').trim();
    if (d.length > 1024) return { err: 'Description: at most 1024 characters.' };
    if (d !== (k.description || '')) body.description = d;
  }
  if (what === 'system_prompt') {
    const p = String(v.prompt || '').trim();
    if (!p) return { err: 'Enter the system prompt. KAP does not return the current one, so saving replaces it.' };
    if (p.length > 8192) return { err: 'System prompt: at most 8192 characters.' };
    body.system_prompt = p;
  }
  if (what === 'model_ref') {
    const m = String(v.model || '').trim();
    if (!m) return { err: 'Choose a model.' };
    if (m !== k.model_ref) body.model_ref = m;
  }
  if (what === 'collections') {
    const c: string[] = v.colls || [];
    if (c.length > 2) return { err: 'KAP allows at most two collections per agent.' };
    if (!same([...c].sort(), [...(k.collections || [])].sort())) body.collections = c.slice();
  }
  if (what === 'allowed_tools') {
    const t = toolsOfV(v);
    if (t.length > 64) return { err: 'KAP allows at most 64 tools per agent.' };
    if (!same([...t].sort(), [...(k.allowed_tools || [])].sort())) body.allowed_tools = t;
  }
  if (what === 'limits') {
    for (const [key, l, min, max] of KAP_LIMITS) {
      const r = parseLimit(v[key], l, min, max);
      if (r.err) return { err: r.err };
      if (r.v !== (k[key] ?? null)) body[key] = r.v;
    }
  }
  if (what === 'io') {
    if (k.type !== 'workflow') return { err: 'Only workflow agents have input and output schemas.' };
    const cur = k.config || {};
    const cfg: NonNullable<KapPatch['config']> = {};
    const i = schemaRef(v.inSchema) ?? null;
    const o = schemaRef(v.outSchema) ?? null;
    const up = String(v.userPrompt || '').trim() || null;
    if (up && up.length > 4096) return { err: 'Prompt template: at most 4096 characters.' };
    if (i !== (cur.input_schema_ref ?? null)) cfg.input_schema_ref = i;
    if (o !== (cur.output_schema_ref ?? null)) cfg.output_schema_ref = o;
    if (up !== (cur.user_prompt ?? null)) cfg.user_prompt = up;
    if (Object.keys(cfg).length) body.config = cfg;
  }
  if (!Object.keys(body).length) return { err: 'No change.' };
  return { body };
}

/** Test-run input → submitJob body, or an error. */
export function toJobBody(k: KapAgent, v: FormValues): { body?: { user_prompt?: string; payload?: unknown }; err?: string } {
  const body: { user_prompt?: string; payload?: unknown } = {};
  const q = String(v.q || '').trim();
  if (q) {
    if (q.length > 4096) return { err: 'Request: at most 4096 characters.' };
    body.user_prompt = q;
  }
  const p = String(v.payload || '').trim();
  if (p) {
    try {
      body.payload = JSON.parse(p);
    } catch {
      return { err: 'The payload is not valid JSON.' };
    }
    if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) return { err: 'The payload must be a JSON object.' };
  }
  if (k.type === 'workflow' && k.config?.input_schema_ref && body.payload === undefined) return { err: 'This agent has an input schema (' + k.config.input_schema_ref + '): enter a payload.' };
  if (!body.user_prompt && body.payload === undefined) return { err: k.type === 'workflow' ? 'Enter a payload or a request.' : 'Enter a request.' };
  return { body };
}
