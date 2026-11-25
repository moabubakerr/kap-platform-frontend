/**
 * Platform API (our layer on top of KAP): real agent jobs and traces.
 * Same-origin `/api/platform/*`; the dev server / nginx adds the API key, so it
 * never reaches the browser.
 *
 * Adapters map the platform's responses onto the console's `Job` and `Trace`
 * shapes, so the existing screens render real runs unchanged.
 */
import type { Job, JobStatus } from '@/types';
import { axisFor, fmtJobDur, type Trace, type TraceLog, type TraceSpan, type LocalRef, type SpanSource } from '@/mocks/traces';

// ------------------------------------------------------------------ wire types
export interface PlatformJob {
  id: string;
  tenant_id: string;
  agent_id: string;
  agent_name: string | null;
  status: 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  user_prompt: string | null;
  payload?: unknown;
  result?: string | null;
  error: string | null;
  retry_count: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  running_at: string | null;
  finished_at: string | null;
  trace_status: 'pending' | 'linked' | 'ambiguous' | 'none';
  trace_calls: number;
}

export interface PlatformStep {
  seq: number;
  kind: 'queue' | 'model' | 'tool';
  name: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  source: 'model' | 'local' | 'documents' | 'oxford' | 'queue';
  input: unknown;
  output: unknown;
  tokens: { prompt: number | null; completion: number | null; total: number | null } | null;
  status: 'ok' | 'error' | 'no_result';
  model_call_id: string | null;
  tool_call_id: string | null;
}

export interface PlatformAgent {
  id: string;
  name: string;
  type: string;
  model_ref: string;
  collections: string[];
  allowed_tools: string[];
  timeout_seconds: number | null;
  max_retries: number | null;
  request_limit: number | null;
  tool_calls_limit: number | null;
}

export interface PlatformTrace {
  job: PlatformJob;
  agent: PlatformAgent | null;
  trace: {
    job_id: string;
    steps: PlatformStep[];
    answer: string | null;
    totals: { model_calls: number; tool_calls: number; prompt_tokens: number; completion_tokens: number; queue_ms: number | null; run_ms: number | null; model_ms: number };
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_next: boolean;
}

export class PlatformError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Platform API ${status}`);
  }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`/api/platform${path}`, { headers: { Accept: 'application/json' } });
  if (r.status === 404) throw new PlatformError(404, await r.json().catch(() => null));
  if (!r.ok) throw new PlatformError(r.status, await r.text().catch(() => ''));
  return r.json() as Promise<T>;
}

export interface PlatformAgentSummary {
  id: string;
  name: string;
  type: 'workflow' | 'planner_and_executor';
  description: string | null;
  model_ref: string;
  collections: string[];
  allowed_tools: string[];
  config: { input_schema_ref?: string | null; output_schema_ref?: string | null; user_prompt?: string | null } | null;
  timeout_seconds: number | null;
  request_limit: number | null;
  tool_calls_limit: number | null;
}

export const fetchAgents = (tenantId: string) => get<Page<PlatformAgentSummary>>(`/t/${tenantId}/agents`);

/** Submit an agent job through the platform layer (KAP calls the platform back when it finishes). */
export async function submitJob(tenantId: string, agentId: string, body: { user_prompt?: string; payload?: unknown }): Promise<{ id: string; status: string }> {
  const r = await fetch(`/api/platform/t/${tenantId}/agents/${agentId}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new PlatformError(r.status, data);
  return data;
}

/** A tool output with nothing in it: null, "", whitespace, [] or {} (also as JSON text). */
export function isEmptyOutput(o: unknown): boolean {
  if (o == null) return true;
  if (typeof o === 'string') {
    const s = o.replace(/\s+/g, '');
    return s === '' || s === 'null' || s === '[]' || s === '{}' || s === '""';
  }
  if (Array.isArray(o)) return o.length === 0;
  if (typeof o === 'object') return Object.keys(o as object).length === 0;
  return false;
}

/**
 * Does the answer rest on data the tools returned? A succeeded run whose
 * searches all came back empty answered from the model alone, which is how a
 * wrong answer reads as confident (seen on the stand, 25 Nov 2026: an invented
 * "control phrase" after hybrid_search returned nothing).
 */
export function grounding(status: string, spans: Pick<TraceSpan, 'kind' | 'output' | 'error' | 'state'>[]): { tone: 'ok' | 'warn' | 'bad'; text: string } | undefined {
  if (status !== 'succeeded') return undefined;
  const tools = spans.filter((s) => s.kind === 'Tool');
  if (!tools.length) return { tone: 'warn', text: 'No data tool was called: the answer comes from the model alone.' };
  const useful = tools.filter((s) => !s.error && s.state !== 'error' && !isEmptyOutput(s.output));
  if (!useful.length) return { tone: 'bad', text: `Not backed by data: ${tools.length === 1 ? 'the only tool call' : `all ${tools.length} tool calls`} returned nothing, so the answer comes from the model alone. Treat it as unverified.` };
  return { tone: 'ok', text: `Backed by ${useful.length} of ${tools.length} tool ${tools.length === 1 ? 'call' : 'calls'} that returned data.` };
}

/** Human-readable message from a platform/KAP error body. */
export function errorMessage(e: unknown): string {
  if (e instanceof PlatformError) {
    const b = e.body as { message?: string; data?: { kap_body?: { message?: string; data?: { errors?: { location?: string[]; message?: string }[] } } } } | null;
    const kapErrs = b?.data?.kap_body?.data?.errors;
    if (kapErrs?.length) return kapErrs.map((x) => `${(x.location ?? []).join('.')}: ${x.message}`).join('; ');
    return b?.data?.kap_body?.message ?? b?.message ?? `Platform API error ${e.status}`;
  }
  return e instanceof Error ? e.message : String(e);
}

export const fetchJobs = (tenantId: string, limit = 200) => get<Page<PlatformJob>>(`/traces?tenant_id=${tenantId}&limit=${limit}`);
export const fetchTrace = async (jobId: string): Promise<PlatformTrace | null> => {
  try {
    return await get<PlatformTrace>(`/traces/${jobId}`);
  } catch (e) {
    if (e instanceof PlatformError && e.status === 404) return null;
    throw e;
  }
};

// ------------------------------------------------------------------ adapters
const STATUS: Record<PlatformJob['status'], JobStatus> = { waiting: 'queued', running: 'running', succeeded: 'succeeded', failed: 'failed', cancelled: 'cancelled' };
const STATUS_LABEL: Record<JobStatus, string> = { running: 'Running', succeeded: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled', queued: 'Queued' };

const fmtAbs = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Qatar' });

export function relTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

function jobSeconds(j: PlatformJob, now = Date.now()): number {
  const start = j.running_at ?? j.created_at;
  const end = j.finished_at ? Date.parse(j.finished_at) : now;
  return Math.max(0, (end - Date.parse(start)) / 1000);
}

/** User shown for a job: username when the platform resolved it, else a short id. */
export const jobUser = (j: PlatformJob) => j.created_by_name ?? (j.created_by ? `user ${j.created_by.slice(0, 8)}` : 'unknown');

export function toJob(j: PlatformJob, now = Date.now()): Job {
  const secs = jobSeconds(j, now);
  return {
    id: j.id, // full UUID: live routes use it directly
    uuid: j.id,
    status: STATUS[j.status],
    agent: j.agent_name ?? j.agent_id,
    user: jobUser(j),
    question: j.user_prompt ?? '(structured payload)',
    reason: j.error ?? undefined,
    duration: fmtJobDur(secs),
    durationS: secs,
    retries: j.retry_count,
    rel: relTime(j.created_at, now),
    abs: fmtAbs(j.created_at),
    createdAt: j.created_at,
    toolCalls: 0,
    modelRequests: j.trace_calls,
    traceStatus: j.trace_status,
    traceCalls: j.trace_calls,
  };
}

const json = (v: unknown) => JSON.stringify(v);

function spanName(s: PlatformStep): { name: string; kind: TraceSpan['kind']; mono: boolean } {
  if (s.kind === 'queue') return { name: 'queued', kind: 'Queue wait', mono: false };
  if (s.kind === 'model') return { name: s.name === 'answer' ? 'compose answer' : 'plan', kind: 'Model call', mono: false };
  return { name: s.source === 'oxford' ? `Oxford · ${s.name}` : s.name, kind: 'Tool', mono: true };
}

/** Pull local data references (value, target, provenance) out of numeric tool results. */
function localRefs(steps: PlatformStep[]): LocalRef[] {
  const names = new Map<string, string>();
  for (const s of steps) {
    if (s.kind === 'tool' && s.name === 'find_indicator' && Array.isArray(s.output)) {
      for (const it of s.output as Record<string, unknown>[]) if (it.indicator_id) names.set(String(it.indicator_id), String(it.name_en ?? it.external_id ?? it.indicator_id));
    }
  }
  const refs: LocalRef[] = [];
  for (const s of steps) {
    if (s.kind !== 'tool' || s.source !== 'local' || !s.output || typeof s.output !== 'object' || Array.isArray(s.output)) continue;
    const out = s.output as Record<string, any>;
    const v = out.actual ?? out; // actual_vs_target nests the observation under "actual"
    if (v.value === undefined) continue;
    const input = (s.input ?? {}) as Record<string, any>;
    const prov = (v.provenance ?? {}) as Record<string, any>;
    const id = String(input.indicator_id ?? prov.indicator_id ?? '');
    if (refs.some((r) => r.indicator === (names.get(id) ?? id) && r.period === String(input.period_start ?? ''))) continue;
    refs.push({
      ref: `L${refs.length + 1}`,
      indicator: names.get(id) ?? prov.external_id ?? id,
      period: String(input.period_start ?? '—'),
      actual: String(v.value),
      target: v.target_value != null ? String(v.target_value) : undefined,
      unit: String(v.unit ?? ''),
      org: String(prov.source ?? prov.source_organisation ?? prov.organisation ?? '—'),
      fileRow: prov.source_file ? `${prov.source_file}${prov.source_row != null ? ` · row ${prov.source_row}` : ''}` : '—',
    });
  }
  return refs;
}

export function toTrace(p: PlatformTrace, now = Date.now()): Trace {
  const j = p.job;
  const job = toJob(j, now);
  const t0 = Date.parse(j.created_at);
  const spans: TraceSpan[] = p.trace.steps.map((s, i) => {
    const n = spanName(s);
    const startMs = s.started_at ? Date.parse(s.started_at) - t0 : 0;
    const durMs = s.duration_ms ?? 0;
    return {
      id: `s${i}`,
      name: n.name,
      rawName: s.name,
      kind: n.kind,
      source: s.source as SpanSource,
      mono: n.mono,
      startS: startMs / 1000,
      durS: durMs / 1000,
      startMs,
      durMs,
      state: s.status === 'error' ? 'error' : 'ok',
      error: s.status === 'no_result' ? 'No result recorded for this tool call' : undefined,
      input: s.kind === 'model' ? { model: p.agent?.model_ref ?? 'model', prompt_tokens: s.tokens?.prompt } : s.input,
      output: s.kind === 'model' ? { completion_tokens: s.tokens?.completion, ...(s.output ? { text: s.output } : {}) } : s.output,
      result: s.kind === 'tool' ? (s.status === 'ok' && isEmptyOutput(s.output) ? 'returned nothing (empty result)' : (typeof s.output === 'string' ? s.output : json(s.output ?? null)).slice(0, 120)) : undefined,
      tokens: s.tokens ? [s.tokens.prompt ?? 0, s.tokens.completion ?? 0] : undefined,
    };
  });

  const T = Math.max(job.durationS + (p.trace.totals.queue_ms ?? 0) / 1000, ...spans.map((s) => s.startS + s.durS), 0.1);
  const a = p.agent;
  const reqLimit = a?.request_limit ?? null;
  const toolLimit = a?.tool_calls_limit ?? null;
  const timeout = a?.timeout_seconds ?? null;
  const m = p.trace.totals.model_calls;
  const tc = p.trace.totals.tool_calls;
  const pct = (v: number, lim: number | null) => (lim ? Math.round((v / lim) * 1000) / 10 : 0);
  const oxford = spans.some((s) => s.source === 'oxford');
  const docs = spans.filter((s) => s.source === 'documents');

  const logs: TraceLog[] = [];
  const hhmmss = (ms: number) => new Date(t0 + ms).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Qatar' });
  logs.push({ t: hhmmss(0), lv: 'INFO', m: `Job ${j.id} registered · agent ${job.agent} · user ${job.user}` });
  for (const s of spans) {
    if (s.kind === 'Queue wait') logs.push({ t: hhmmss(s.startMs + s.durMs), lv: 'INFO', m: `Picked up by a worker after ${Math.round(s.durMs)} ms in kap.agent` });
    else if (s.kind === 'Model call') logs.push({ t: hhmmss(s.startMs), lv: 'INFO', m: `${s.name} · ${s.tokens?.[0] ?? '?'} prompt / ${s.tokens?.[1] ?? '?'} completion tokens · ${Math.round(s.durMs)} ms` });
    else logs.push({ t: hhmmss(s.startMs), lv: s.state === 'error' || s.error ? 'WARN' : 'INFO', m: `${s.rawName} · ${s.error ?? (s.result?.startsWith('returned nothing') ? `returned nothing · ${Math.round(s.durMs)} ms` : `ok · ${Math.round(s.durMs)} ms`)}` });
  }
  if (j.finished_at) logs.push({ t: hhmmss(Date.parse(j.finished_at) - t0), lv: j.status === 'failed' ? 'ERROR' : 'INFO', m: `Job ${j.status}${j.error ? ` · ${j.error}` : ''}` });

  const selected = spans.find((s) => s.kind === 'Tool') ?? spans[0];
  // KAP may fail a job without a message; then name the step it stopped at
  const lastTool = [...spans].reverse().find((s) => s.kind === 'Tool');
  const reason = j.error ?? (j.status === 'failed' && lastTool && (lastTool.error || lastTool.state === 'error') ? `KAP gave no error message. The run stopped after the tool call ${lastTool.rawName}, which returned no result: check its input in Path and Trace.` : undefined);
  return {
    job,
    uuid: j.id,
    status: job.status,
    statusLabel: STATUS_LABEL[job.status],
    reason,
    grounding: grounding(j.status, spans),
    prompt: j.user_prompt ?? json(j.payload ?? null),
    answer: j.status === 'succeeded' && (j.result ?? p.trace.answer) ? [String(j.result ?? p.trace.answer)] : null,
    duration: job.duration,
    durationS: job.durationS,
    createdRel: job.rel,
    createdAbs: job.abs,
    updatedRel: j.finished_at ? relTime(j.finished_at, now) : 'just now',
    retries: j.retry_count,
    queue: 'kap.agent',
    meters: [
      { k: 'Model requests', v: reqLimit ? `${m} / ${reqLimit}` : String(m), p: pct(m, reqLimit) },
      { k: 'Tool calls', v: toolLimit ? `${tc} / ${toolLimit}` : String(tc), p: pct(tc, toolLimit), danger: toolLimit != null && tc >= toolLimit },
      { k: 'Elapsed vs timeout', v: timeout ? `${job.duration} / ${timeout} s` : job.duration, p: pct(job.durationS, timeout), danger: timeout != null && job.durationS >= timeout },
    ],
    leak: oxford ? { tone: 'neutral', text: 'External calls made · data-leak guard is not active on this tenant yet' } : { tone: 'neutral', text: 'Data-leak guard not needed · this run made no external calls' },
    spans,
    defaultSpan: selected?.id ?? 's0',
    axis: axisFor(T),
    provenance: {
      local: j.status === 'succeeded' ? localRefs(p.trace.steps) : [],
      docs: docs.map((s, i) => ({ ref: `D${i + 1}`, doc: 'Collection documents', section: s.rawName, passage: (s.result ?? '').slice(0, 200) })),
      external: null,
      oxfordAgent: oxford,
    },
    rawLines: JSON.stringify({ job: p.job, agent: p.agent, totals: p.trace.totals }, null, 2).split('\n'),
    logs,
  };
}

/** Summary strip for a live job list. */
export function summarize(jobs: Job[]) {
  const done = jobs.filter((j) => j.status === 'succeeded' || j.status === 'failed');
  const avg = done.length ? done.reduce((s, j) => s + j.durationS, 0) / done.length : 0;
  return {
    total: jobs.length,
    succeeded: jobs.filter((j) => j.status === 'succeeded').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    running: jobs.filter((j) => j.status === 'running' || j.status === 'queued').length,
    avgDuration: done.length ? fmtJobDur(avg) : '—',
  };
}
