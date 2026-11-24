import { describe, expect, it } from 'vitest';
import { summarize, toJob, toTrace, type PlatformTrace } from './platformLive';

// Shape and numbers of the real trace returned by the platform API on the test
// stand (job 290e360f…, 24 Nov 2026), with tool outputs as KAP returned them.
const T0 = '2026-11-24T11:25:22.766324+00:00';
const at = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();
const IND = { indicator_id: '5456bc3f', frequency: 'A', period_start: '2019-01-01', dimension: '' };
const VALUE = { value: '32.04', unit: '%', target_value: '50', provenance: { indicator_id: '5456bc3f', external_id: 'cms.8f22', source: 'National Planning Council', source_file: 'observations.csv', source_row: 2 } };

const sample: PlatformTrace = {
  job: {
    id: '290e360f-dc6d-4407-8eb6-139f153b64f2',
    tenant_id: '71b6c98a-7f7a-4a8b-ab31-132c85bdc88b',
    agent_id: 'fec8ad75-02cc-44aa-b1f1-8304155a05ce',
    agent_name: 'sandbox_indicators_agent',
    status: 'succeeded',
    user_prompt: 'Report the 2019 non-hydrocarbon export share. (probe reference: probe-112522)',
    result: 'The actual value … was 32.04%, with the target being 50%.',
    error: null,
    retry_count: 0,
    created_by: '9a1b2c3d-0000-0000-0000-000000000000',
    created_by_name: 'probe_admin',
    created_at: T0,
    running_at: at(192),
    finished_at: at(10196),
    trace_status: 'linked',
    trace_calls: 4,
  },
  agent: { id: 'fec8ad75', name: 'sandbox_indicators_agent', type: 'planner_and_executor', model_ref: 'agent_default', collections: ['sandbox_indicators'], allowed_tools: [], timeout_seconds: 180, max_retries: 1, request_limit: 20, tool_calls_limit: 15 },
  trace: {
    job_id: '290e360f-dc6d-4407-8eb6-139f153b64f2',
    answer: 'The actual value … was 32.04%, with the target being 50%.',
    totals: { model_calls: 4, tool_calls: 3, prompt_tokens: 37398, completion_tokens: 381, queue_ms: 192, run_ms: 10004, model_ms: 9560 },
    steps: [
      { seq: 0, kind: 'queue', name: 'queued', started_at: at(0), finished_at: at(192), duration_ms: 192, source: 'queue', input: null, output: null, tokens: null, status: 'ok', model_call_id: null, tool_call_id: null },
      { seq: 1, kind: 'model', name: 'plan', started_at: at(200), finished_at: at(1468), duration_ms: 1268, source: 'model', input: null, output: null, tokens: { prompt: 8891, completion: 63, total: 8954 }, status: 'ok', model_call_id: 'c1', tool_call_id: null },
      { seq: 2, kind: 'tool', name: 'find_indicator', started_at: at(1468), finished_at: at(1544), duration_ms: 76, source: 'local', input: { text: 'cms.8f22' }, output: [{ indicator_id: '5456bc3f', name_en: 'Non-Hydrocarbon Exports (share of total exports)' }], tokens: null, status: 'ok', model_call_id: null, tool_call_id: 't1' },
      { seq: 3, kind: 'model', name: 'plan', started_at: at(1544), finished_at: at(5139), duration_ms: 3595, source: 'model', input: null, output: null, tokens: { prompt: 9101, completion: 162, total: 9263 }, status: 'ok', model_call_id: 'c2', tool_call_id: null },
      { seq: 4, kind: 'tool', name: 'get_indicator_value', started_at: at(5139), finished_at: at(5233), duration_ms: 94, source: 'local', input: IND, output: VALUE, tokens: null, status: 'ok', model_call_id: null, tool_call_id: 't2' },
      { seq: 5, kind: 'model', name: 'plan', started_at: at(5233), finished_at: at(7564), duration_ms: 2331, source: 'model', input: null, output: null, tokens: { prompt: 9484, completion: 81, total: 9565 }, status: 'ok', model_call_id: 'c3', tool_call_id: null },
      { seq: 6, kind: 'tool', name: 'actual_vs_target', started_at: at(7564), finished_at: at(7671), duration_ms: 107, source: 'local', input: IND, output: { actual: VALUE, gap: '-17.96' }, tokens: null, status: 'ok', model_call_id: null, tool_call_id: 't3' },
      { seq: 7, kind: 'model', name: 'answer', started_at: at(7671), finished_at: at(10037), duration_ms: 2366, source: 'model', input: null, output: 'The actual value … 32.04%', tokens: { prompt: 9922, completion: 91, total: 10013 }, status: 'ok', model_call_id: 'c4', tool_call_id: null },
    ],
  },
};

const NOW = Date.parse(T0) + 60_000;

describe('toJob', () => {
  it('maps a platform job to the console job shape', () => {
    const j = toJob(sample.job, NOW);
    expect(j.id).toBe(sample.job.id);
    expect(j.status).toBe('succeeded');
    expect(j.agent).toBe('sandbox_indicators_agent');
    expect(j.user).toBe('probe_admin');
    expect(j.duration).toBe('10.0 s');
    expect(j.rel).toBe('1 min ago');
  });

  it('falls back to a short user id and maps waiting to queued', () => {
    const j = toJob({ ...sample.job, created_by_name: null, status: 'waiting', finished_at: null }, NOW);
    expect(j.user).toBe('user 9a1b2c3d');
    expect(j.status).toBe('queued');
  });
});

describe('toTrace', () => {
  const t = toTrace(sample, NOW);

  it('builds spans in order with the console labels', () => {
    expect(t.spans.map((s) => s.name)).toEqual(['queued', 'plan', 'find_indicator', 'plan', 'get_indicator_value', 'plan', 'actual_vs_target', 'compose answer']);
    expect(t.spans.map((s) => s.kind)).toEqual(['Queue wait', 'Model call', 'Tool', 'Model call', 'Tool', 'Model call', 'Tool', 'Model call']);
    expect(t.spans[2].startMs).toBe(1468);
    expect(t.spans[2].durMs).toBe(76);
    expect(t.spans[1].tokens).toEqual([8891, 63]);
    expect(t.defaultSpan).toBe('s2'); // first tool call selected
  });

  it('fills meters from the agent limits', () => {
    expect(t.meters.map((m) => m.v)).toEqual(['4 / 20', '3 / 15', '10.0 s / 180 s']);
    expect(t.meters[0].p).toBe(20);
  });

  it('extracts local provenance with the indicator name, period, target and source', () => {
    expect(t.provenance.local).toEqual([
      { ref: 'L1', indicator: 'Non-Hydrocarbon Exports (share of total exports)', period: '2019-01-01', actual: '32.04', target: '50', unit: '%', org: 'National Planning Council', fileRow: 'observations.csv · row 2' },
    ]);
  });

  it('uses the job result as the answer and builds logs', () => {
    expect(t.answer).toEqual([sample.job.result]);
    expect(t.logs[0].m).toContain('probe_admin');
    expect(t.logs[t.logs.length - 1].m).toBe('Job succeeded');
    expect(t.axis[0]).toBe('0');
  });

  it('degrades without agent limits', () => {
    const bare = toTrace({ ...sample, agent: null }, NOW);
    expect(bare.meters.map((m) => m.v)).toEqual(['4', '3', '10.0 s']);
  });
});

describe('summarize', () => {
  it('counts statuses and averages finished durations', () => {
    const jobs = [toJob(sample.job, NOW), toJob({ ...sample.job, id: 'x', status: 'failed', error: 'boom' }, NOW), toJob({ ...sample.job, id: 'y', status: 'running', finished_at: null }, NOW)];
    expect(summarize(jobs)).toEqual({ total: 3, succeeded: 1, failed: 1, running: 1, avgDuration: '10.0 s' });
  });
});
