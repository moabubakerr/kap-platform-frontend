import { describe, expect, it, vi } from 'vitest';
import { agentFactoryInit } from '@/v35/data/agentFactory';
import { initialBusinessData } from '@/v35/data/businessData';
import { agentScreen, agentsScreen, type AgentsCtx } from './build';
import { grantsOf, jobMetrics, kapOf, liveOpts, mergeAgents, toAgent, toJobBody, toKapCreate, toKapPatch, TYPE_L, type KapAgent, type KapJob } from './fromKap';
import { liveEditFields, liveWizardFields, validateLiveStep } from './liveForms';
import type { AgentsLiveCtx } from './liveBuild';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

/** AgentOut */
const agent = (o: Partial<KapAgent> = {}): KapAgent => ({
  id: '3f0c2a9e-1b7d-4c55-9a51-0d2f7c1e8b11',
  name: 'sandbox_indicators_agent',
  type: 'planner_and_executor',
  description: 'Answers indicator questions',
  model_ref: 'qwen32b',
  collections: ['sandbox_indicators'],
  system_prompt_is_set: true,
  allowed_tools: ['find_indicator', 'get_indicator_value', 'hybrid_search'],
  timeout_seconds: 180,
  max_retries: 1,
  request_limit: 20,
  tool_calls_limit: 15,
  input_tokens_limit: null,
  output_tokens_limit: null,
  total_tokens_limit: null,
  output_retries: null,
  count_tokens_before_request: null,
  task_priority: null,
  max_in_flight_tasks: null,
  config: {},
  created_at: iso(60 * 24 * 10),
  updated_at: iso(120),
  ...o,
});
const wfAgent = (o: Partial<KapAgent> = {}) =>
  agent({ id: '7d1e0b44-0c3a-4f2e-8a6b-5c9d2e1f0a77', name: 'intent_agent', type: 'workflow', collections: [], allowed_tools: [], tool_calls_limit: null, config: { input_schema_ref: 'intent_in', output_schema_ref: 'intent_out', user_prompt: 'Classify: {question}' }, ...o });

/** AgentJobListItemOut */
const job = (o: Partial<KapJob> & { min: number; secs?: number }): KapJob => {
  const created = iso(o.min);
  const run = new Date(Date.parse(created) + 500).toISOString();
  return {
    id: 'job-' + o.min,
    agent_id: agent().id,
    created_by: null,
    status: o.status ?? 'succeeded',
    retry_count: 0,
    user_prompt: 'q' + o.min,
    payload: null,
    result: o.status === 'succeeded' || !o.status ? 'ok' : null,
    error: o.error ?? null,
    created_at: created,
    running_at: o.status === 'waiting' ? null : run,
    finished_at: o.status === 'waiting' || o.status === 'running' ? null : new Date(Date.parse(run) + (o.secs ?? 2) * 1000).toISOString(),
  };
};

describe('KAP agents → Agent Factory agents', () => {
  it('maps an agent onto one version that stands for the KAP configuration', () => {
    const a = toAgent(agent(), [], 0, NOW);
    expect(a.id).toBe('sandbox_indicators_agent');
    expect(a.purpose).toBe('Answers indicator questions');
    expect(a.vers).toHaveLength(1);
    expect(a.vers[0]).toMatchObject({ v: 'v1', st: 'Published', at: '2 h ago', note: 'Current configuration in KAP' });
    const c = a.vers[0].cfg!;
    expect(c).toMatchObject({ model: 'qwen32b', tools: 15, dur: '180 s', retries: '1', fb: 'None', guards: [], tset: ['kap:find_indicator', 'kap:get_indicator_value', 'kap:hybrid_search'] });
    expect(c.instr).toMatch(/does not return/);
    expect(a.owner).toBe('—');
    expect(a.dis).toBeNull();
    expect(kapOf(a)!.agent.id).toBe(agent().id);
  });

  it('uses honest defaults for what KAP does not have', () => {
    const a = toAgent(agent({ description: '', timeout_seconds: null, max_retries: null, system_prompt_is_set: false }), [], null, NOW);
    expect(a.purpose).toBe('—');
    expect(a.vers[0].cfg).toMatchObject({ dur: '—', retries: '—', tokens: '—', instr: 'Not set' });
    expect(a.m).toEqual([0, 0, '—', '—', 0]);
  });

  it('derives 7-day metrics from the job list', () => {
    const jobs = [job({ min: 5, secs: 2 }), job({ min: 30, secs: 4 }), job({ min: 60, status: 'failed', error: 'Tool-call limit reached', secs: 10 }), job({ min: 2, status: 'running' }), job({ min: 60 * 24 * 9, secs: 99 })];
    const m = jobMetrics(jobs, 4, NOW);
    expect(m[0]).toBe(4);
    expect(m[1]).toBe(66.7);
    expect(m[2]).toBe('10.0 s');
    expect(m[3]).toBe('—');
    // without the server count: jobs in the window
    expect(jobMetrics(jobs, null, NOW)[0]).toBe(4);
    const a = toAgent(agent(), jobs, 4, NOW);
    expect(kapOf(a)!.jobs).toHaveLength(5);
  });

  it('keeps session-only versions and evaluation settings across reloads (renames too)', () => {
    const prev = toAgent(agent(), [], 0, NOW);
    prev.vers.unshift({ v: 'v2', st: 'Published', at: 'just now', by: 'r.haddad', note: 'session', cfg: prev.vers[0].cfg });
    prev.evSets = ['ES-SBX'];
    prev.thr = { acc: 0.8 };
    const fresh = [toAgent(agent({ name: 'renamed_agent' }), [], 0, NOW), toAgent(wfAgent(), [], 0, NOW)];
    const out = mergeAgents([prev], fresh);
    expect(out.map((a) => a.id)).toEqual(['renamed_agent', 'intent_agent']);
    expect(out[0].vers.map((v) => v.v + ' ' + v.st)).toEqual(['v2 Published', 'v1 Superseded']);
    expect(out[0].evSets).toEqual(['ES-SBX']);
    expect(out[0].thr).toEqual({ acc: 0.8 });
    expect(out[1].vers).toHaveLength(1);
  });

  it('builds grants and picker options from real names', () => {
    expect(grantsOf([agent(), wfAgent()])).toEqual({ sandbox_indicators_agent: ['kap:find_indicator', 'kap:get_indicator_value', 'kap:hybrid_search'], intent_agent: [] });
    const o = liveOpts(
      [agent(), wfAgent()],
      [{ id: 'c1', name: 'sandbox_docs' }],
      [{ id: 'm1', name: 'qwen72b', model_type: 'chat', model_name: 'Qwen' }, { id: 'm2', name: 'embed', model_type: 'embedding', model_name: 'bge' }],
      [{ id: 's1', name: 'intent_in', description: '' }],
    );
    expect(o.collections).toEqual(['sandbox_docs', 'sandbox_indicators']);
    expect(o.models).toEqual(['qwen32b', 'qwen72b']);
    expect(o.schemas).toEqual(['intent_in', 'intent_out']);
    expect(o.tools).toEqual(['find_indicator', 'get_indicator_value', 'hybrid_search']);
    expect(liveOpts([], null, null, null)).toEqual({ collections: [], models: [], schemas: [], tools: [] });
  });
});

describe('KAP write bodies', () => {
  const base = { name: 'supplier_agent', description: ' Supplier questions ', type: TYPE_L.planner_and_executor, prompt: 'Answer from contracts.', model: 'qwen32b', colls: ['sandbox_docs'], tools: ['hybrid_search'], toolsX: 'EconomicData, hybrid_search', inSchema: 'None', outSchema: 'None' };

  it('creates a planner agent', () => {
    const r = toKapCreate({ ...base, timeout_seconds: '120', request_limit: '' });
    expect(r.err).toBeUndefined();
    expect(r.body).toEqual({ name: 'supplier_agent', type: 'planner_and_executor', description: 'Supplier questions', model_ref: 'qwen32b', collections: ['sandbox_docs'], system_prompt: 'Answer from contracts.', allowed_tools: ['hybrid_search', 'EconomicData'], timeout_seconds: 120 });
  });

  it('creates a workflow agent with schemas and template', () => {
    const r = toKapCreate({ ...base, type: TYPE_L.workflow, tools: [], toolsX: '', inSchema: 'intent_in', outSchema: 'None', userPrompt: 'Classify {question}' });
    expect(r.body).toMatchObject({ type: 'workflow', allowed_tools: [], config: { input_schema_ref: 'intent_in', user_prompt: 'Classify {question}' } });
    expect(r.body!.config).not.toHaveProperty('output_schema_ref');
  });

  it('rejects what KAP would reject', () => {
    expect(toKapCreate({ ...base, name: 'ab' }).err).toMatch(/Agent name/);
    expect(toKapCreate({ ...base, name: 'bad-name' }).err).toMatch(/Agent name/);
    expect(toKapCreate({ ...base, colls: ['a', 'b', 'c'] }).err).toMatch(/two collections/);
    expect(toKapCreate({ ...base, timeout_seconds: '5000' }).err).toMatch(/Timeout/);
    expect(toKapCreate({ ...base, max_retries: '1.5' }).err).toMatch(/Job retries/);
    expect(toKapCreate({ ...base, model: '' }).err).toMatch(/model/);
  });

  it('patches only what changed', () => {
    const k = agent();
    expect(toKapPatch(k, 'name', { name: 'sandbox_indicators_agent' }).err).toBe('No change.');
    expect(toKapPatch(k, 'name', { name: 'sbx_ind' }).body).toEqual({ name: 'sbx_ind' });
    expect(toKapPatch(k, 'description', { description: 'New purpose' }).body).toEqual({ description: 'New purpose' });
    expect(toKapPatch(k, 'system_prompt', { prompt: '' }).err).toMatch(/never|does not return/);
    expect(toKapPatch(k, 'system_prompt', { prompt: 'Be brief.' }).body).toEqual({ system_prompt: 'Be brief.' });
    expect(toKapPatch(k, 'model_ref', { model: 'qwen72b' }).body).toEqual({ model_ref: 'qwen72b' });
    expect(toKapPatch(k, 'collections', { colls: ['sandbox_indicators'] }).err).toBe('No change.');
    expect(toKapPatch(k, 'collections', { colls: [] }).body).toEqual({ collections: [] });
    expect(toKapPatch(k, 'allowed_tools', { tools: ['hybrid_search', 'find_indicator', 'get_indicator_value'], toolsX: '' }).err).toBe('No change.');
    expect(toKapPatch(k, 'allowed_tools', { tools: ['hybrid_search'], toolsX: 'EconomicData' }).body).toEqual({ allowed_tools: ['hybrid_search', 'EconomicData'] });
    expect(toKapPatch(k, 'limits', { timeout_seconds: '180', max_retries: '1', request_limit: '20', tool_calls_limit: '25' }).body).toEqual({ tool_calls_limit: 25 });
    expect(toKapPatch(k, 'limits', { timeout_seconds: '', max_retries: '1', request_limit: '20', tool_calls_limit: '15' }).body).toEqual({ timeout_seconds: null });
    expect(toKapPatch(k, 'io', {}).err).toMatch(/workflow/);
  });

  it('patches workflow input and output key by key', () => {
    const k = wfAgent();
    expect(toKapPatch(k, 'io', { inSchema: 'intent_in', outSchema: 'intent_out', userPrompt: 'Classify: {question}' }).err).toBe('No change.');
    expect(toKapPatch(k, 'io', { inSchema: 'None', outSchema: 'intent_out', userPrompt: '' }).body).toEqual({ config: { input_schema_ref: null, user_prompt: null } });
  });

  it('builds test job bodies', () => {
    expect(toJobBody(agent(), { q: 'What was CPI in 2019?' }).body).toEqual({ user_prompt: 'What was CPI in 2019?' });
    expect(toJobBody(agent(), { q: '' }).err).toMatch(/request/);
    expect(toJobBody(wfAgent(), { q: 'x' }).err).toMatch(/input schema/);
    expect(toJobBody(wfAgent(), { payload: '{bad' }).err).toMatch(/JSON/);
    expect(toJobBody(wfAgent(), { payload: '[1]' }).err).toMatch(/object/);
    expect(toJobBody(wfAgent(), { payload: '{"question":"hi"}' }).body).toEqual({ payload: { question: 'hi' } });
  });
});

describe('live forms', () => {
  const o = { collections: ['sandbox_docs'], models: ['qwen32b'], schemas: ['intent_in'], tools: ['hybrid_search'] };
  it('wizard steps follow the agent type', () => {
    expect(liveWizardFields(o, 4, { type: TYPE_L.workflow }).map((f) => ('k' in f ? f.k : f.type))).toEqual(['inSchema', 'outSchema', 'userPrompt']);
    expect(liveWizardFields(o, 4, { type: TYPE_L.planner_and_executor })[0].type).toBe('note');
    expect(validateLiveStep({ names: ['Intent_Agent'] }, 0, { name: 'intent_agent' })).toMatch(/exists/);
    expect(validateLiveStep({ names: [] }, 5, { name: 'x', timeout_seconds: '0' })).toMatch(/Timeout/);
    expect(validateLiveStep({ names: [] }, 3, { colls: ['a', 'b', 'c'] })).toMatch(/two/);
  });
  it('edit forms are prefilled from KAP and fall back to free text', () => {
    const f = liveEditFields(agent(), 'model_ref', { ...o, models: [] })[0];
    expect(f).toMatchObject({ type: 'text', val: 'qwen32b' });
    const m = liveEditFields(agent(), 'model_ref', o)[0];
    expect(m).toMatchObject({ type: 'select', val: 'qwen32b' });
    expect(liveEditFields(agent(), 'limits', o).find((x) => 'k' in x && x.k === 'timeout_seconds')).toMatchObject({ val: '180' });
  });
});

describe('live screens', () => {
  function liveCtx(perms: string[] | 'all' = 'all') {
    const af = agentFactoryInit();
    const D = af.tenants.sandbox;
    D.agents = mergeAgents(D.agents, [toAgent(agent(), [job({ min: 5 }), job({ min: 20, status: 'failed', error: 'boom' })], 2, NOW), toAgent(wfAgent(), [], 0, NOW)]);
    const B = initialBusinessData();
    const go = Object.fromEntries(['agents', 'agent', 'evalsets', 'evalset', 'workflow', 'collections', 'collection', 'dataset', 'document', 'entities', 'tools', 'policies', 'audit', 'run', 'monitoring', 'playground'].map((k) => [k, vi.fn()])) as unknown as AgentsCtx['go'];
    const a = new Proxy({}, { get: (tg: Record<string, unknown>, k: string) => (tg[k] ??= vi.fn()) }) as unknown as AgentsCtx['a'];
    const live: AgentsLiveCtx = { opts: { collections: [], models: [], schemas: [], tools: [] }, tests: {}, loading: false, now: NOW, choice: () => ({ mode: 'group', value: '' }), a: { edit: vi.fn(), searchSetting: vi.fn(), remove: vi.fn(), test: vi.fn() } };
    const c: AgentsCtx = {
      t: 'sandbox',
      TN: 'sandbox',
      af,
      D,
      agColl: {},
      biz: { collections: B.tenants.sandbox.collections, ontoTypes: [], inst: [], documents: [], policies: [], pipelines: [] },
      can: (p) => perms === 'all' || perms.includes(p),
      tests: {},
      focus: null,
      lastCase: null,
      go,
      a,
      live,
    };
    return { c, live, go };
  }

  it('lists KAP agents with type, model and job counts', () => {
    const { c } = liveCtx();
    const m = agentsScreen(c, {}, () => {});
    expect(m.sections[0].cols).toEqual(['Agent', 'Type', 'Model', 'Collections', 'Tools', 'Jobs (7 days)', 'Last job']);
    const r = m.sections[0].rows!;
    expect(r.map((x) => x.key)).toEqual(['a:sandbox_indicators_agent', 'a:intent_agent']);
    expect(r[0].cells[5]).toMatchObject({ v: '2', sub: '50% succeeded' });
    expect(agentsScreen(c, { ty: 'Workflow' }, () => {}).sections[0].rows!.map((x) => x.key)).toEqual(['a:intent_agent']);
  });

  it('edits the configuration in KAP and deletes with KAP', () => {
    const { c, live } = liveCtx();
    const m = agentScreen(c, 'sandbox_indicators_agent', 'config', () => {});
    expect(m.head.status).toEqual(['approved', 'Active in KAP']);
    expect(m.sections[0].callout).toMatch(/saved to KAP at once/);
    const model = m.sections.flatMap((s) => s.rows || []).find((r) => r.cells?.[0] && (r.cells[0] as { v?: string }).v === 'Model');
    expect(model).toBeTruthy();
    // workflow-only section only for workflow agents
    expect(m.sections.some((s) => s.title === 'Input and output')).toBe(false);
    expect(agentScreen(c, 'intent_agent', 'config', () => {}).sections.some((s) => s.title === 'Input and output')).toBe(true);
    const ov = agentScreen(c, 'sandbox_indicators_agent', 'overview', () => {});
    ov.sections[0].sacts!.find((x) => x.l === 'Delete')!.f();
    expect(live.a.remove).toHaveBeenCalled();
  });

  it('says plainly that versions and evaluation are session-only', () => {
    const { c } = liveCtx();
    expect(agentScreen(c, 'sandbox_indicators_agent', 'versions', () => {}).sections[0].callout).toMatch(/Session only/);
    expect(agentScreen(c, 'sandbox_indicators_agent', 'eval', () => {}).sections[0].callout).toMatch(/Session only/);
  });

  it('tests with real jobs and links to their traces', () => {
    const { c, live, go } = liveCtx();
    live.tests['sandbox_indicators_agent'] = { id: 'job-xyz', q: 'hi', at: NOW };
    const m = agentScreen(c, 'sandbox_indicators_agent', 'testing', () => {});
    m.sections[0].sacts!.find((x) => x.l === 'Run test')!.f();
    expect(live.a.test).toHaveBeenCalled();
    m.sections[0].rows![0].acts![0].f();
    expect(go.run).toHaveBeenCalledWith('job-xyz');
    expect(m.sections[1].rows).toHaveLength(2);
    const read = liveCtx(['agent:read']).c;
    expect(agentScreen(read, 'sandbox_indicators_agent', 'testing', () => {}).sections[0].sacts!.map((x) => x.l)).toEqual(['Open Playground']);
  });

  it('shows loading instead of "not available" during the first load', () => {
    const { c, live } = liveCtx();
    live.loading = true;
    expect(agentScreen(c, 'not_loaded_yet', 'overview', () => {}).sections[0].callout).toMatch(/Loading/);
  });
});
