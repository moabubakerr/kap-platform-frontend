import { describe, expect, it, vi } from 'vitest';
import { agentFactoryInit, cfgOf, wfUsing, type AfTenant, type AgentFactoryData } from '@/v35/data/agentFactory';
import { initialBusinessData } from '@/v35/data/businessData';
import { agentScreen, agentsScreen, evalSetScreen, evalSetsScreen, type AgentsCtx } from './build';
import { activateVersion, addDraft, diffOf, gateL, gateOf, hashC, lifeP, modelL, simAgent, simEval, toolInv } from './logic';
import { agentRecord, validateAgentStep } from './wizards';

const noop = () => {};
const labels = (acts?: { l: string }[]) => (acts ?? []).map((x) => x.l);

function ctx(o: { af?: AgentFactoryData; t?: 'sceai' | 'econ' | 'sandbox'; perms?: string[] | 'all'; tests?: AgentsCtx['tests'] } = {}): AgentsCtx {
  const af = o.af ?? agentFactoryInit();
  const t = o.t ?? 'sceai';
  const B = initialBusinessData();
  const perms = o.perms ?? 'all';
  const go = Object.fromEntries(['agents', 'agent', 'evalsets', 'evalset', 'workflow', 'collections', 'collection', 'dataset', 'document', 'entities', 'tools', 'policies', 'audit', 'run', 'monitoring', 'playground'].map((k) => [k, vi.fn()])) as unknown as AgentsCtx['go'];
  const a = new Proxy({}, { get: (tg: Record<string, unknown>, k: string) => (tg[k] ??= vi.fn()) }) as unknown as AgentsCtx['a'];
  return {
    t,
    TN: 'SCEAI',
    af,
    D: af.tenants[t],
    agColl: B.agColl,
    biz: { collections: B.tenants[t].collections, ontoTypes: B.tenants[t].onto.types.map((x) => x.n), inst: B.tenants[t].inst, documents: B.tenants[t].documents, policies: [], pipelines: [] },
    can: (p) => perms === 'all' || perms.includes(p),
    tests: o.tests ?? {},
    focus: null,
    lastCase: null,
    go,
    a,
  };
}
const sceai = (): AfTenant => agentFactoryInit().tenants.sceai;

describe('agent factory data', () => {
  it('ports all three tenants', () => {
    const { tenants: T } = agentFactoryInit();
    expect([T.sceai.agents.length, T.sceai.workflows.length, T.sceai.evalsets.length, T.sceai.evalruns.length, T.sceai.runs.length, T.sceai.wfruns.length, T.sceai.scheds.length]).toEqual([8, 2, 4, 5, 12, 3, 3]);
    expect([T.econ.agents.length, T.econ.workflows.length, T.econ.runs.length]).toEqual([2, 1, 1]);
    expect([T.sandbox.agents.length, T.sandbox.workflows.length, T.sandbox.runs.length]).toEqual([4, 1, 1]);
    expect(T.sandbox.agents.find((a) => a.id === 'vision_experiment')!.st).toBe('Archived');
    expect(T.sandbox.agents.find((a) => a.id === 'c001_account_assistant')!.st).toBe('Draft');
  });

  it('adds tool sets, governance and entity context to agent versions', () => {
    const D = sceai();
    const ia = D.agents.find((a) => a.id === 'sceai_indicators_agent')!;
    expect(ia.vers[0].cfg!.tset).toContain('sceai_indicator_tools:find_indicator');
    expect(ia.vers[0].cfg!.gov).toEqual({ tier: 'Decision support', esc: 'None' });
    expect(ia.vers[0].cfg!.ent!.types).toEqual(['Indicator', 'Sector', 'Strategic Objective']);
    expect(D.agents.find((a) => a.id === 'Reader Agent')!.vers[0].cfg!.ent!.mode).toBe('Off');
  });

  it('converts workflow stages to the canvas graph', () => {
    const D = sceai();
    const c = cfgOf(D.workflows[0]);
    expect(c.nodes.map((n) => n[0])).toEqual(['in', 'intent', 'route', 'num', 'pick', 'oxf', 'art', 'comp', 'follow', 'verify', 'fb', 'out']);
    expect(c.mode).toBe('Conditional routing · Parallel · Delegation');
    expect(c.fail).toBe('Validation fails or a step times out: return a template answer');
    expect(c.edges.find((e) => e[0] === 'verify' && e[1] === 'fb')).toEqual(['verify', 'fb', 'fallback', 'failed', '']);
    expect(c.edges.find((e) => e[0] === 'comp' && e[1] === 'verify')![4]).toBe('Draft answer and the facts it uses');
    expect(c.np.num).toEqual({ timeout: '180 s', retries: '1', onErr: 'Use the failure path' });
    expect(Object.keys(c.pos)).toHaveLength(c.nodes.length);
    expect(wfUsing(D, 'Composer Agent').map((w) => w.n)).toEqual(['Ask AI', 'Weekly briefing']);
  });
});

describe('logic', () => {
  it('resolves models and lifecycle', () => {
    const af = agentFactoryInit();
    const D = af.tenants.sceai;
    const ox = D.agents.find((a) => a.id === 'sceai_indicators_oxford')!;
    expect(modelL(af, 'sceai', ox.id, cfgOf(ox))).toBe('qwen32b-prod (tenant default)');
    expect(lifeP(D.agents.find((a) => a.id === 'sceai_indicators_agent')!)).toEqual(['approved', 'Published · draft open']);
  });

  it('applies the evaluation gate', () => {
    const D = sceai();
    const k = 'agent:sceai_indicators_agent';
    expect(gateOf(D, k, D.evalruns[0]).ok).toBe(true);
    const g = gateOf(D, k, D.evalruns[1]);
    expect(g.ok).toBe(false);
    expect(g.res.filter((x) => !x[4]).map((x) => x[1])).toEqual(['Numeric integrity', 'Regression vs active version']);
    expect(gateL(D, k, 'v6')).toEqual(['draft', 'Not evaluated']);
    expect(gateL(D, k, 'v5')).toEqual(['approved', 'Gate passed']);
  });

  it('simulates an evaluation of the correction draft', () => {
    const D = sceai();
    const r = simEval(D, 'agent:sceai_indicators_agent', 'v6', 'ES-NUM');
    expect(r.failed).toEqual([]);
    expect(r.m.acc).toBeCloseTo(0.96);
  });

  it('marks stale evaluations after a draft change', () => {
    const D = sceai();
    const k = 'agent:sceai_indicators_agent';
    const o = D.agents.find((a) => a.id === 'sceai_indicators_agent')!;
    D.evalruns.unshift({ id: 'EV-0600', t: k, v: 'v6', set: 'ES-NUM', at: 'just now', by: 'x', m: D.evalruns[0].m, failed: [], h: hashC(cfgOf(o, 'v6')) });
    expect(gateL(D, k, 'v6')).toEqual(['approved', 'Gate passed']);
    o.vers[0].cfg!.tools = 25;
    expect(gateL(D, k, 'v6')).toEqual(['hold', 'Changed · re-evaluate']);
  });

  it('simulates agent test runs', () => {
    const af = agentFactoryInit();
    const D = af.tenants.sceai;
    const q = 'Which indicators are currently off track and what do the plans say about them?';
    const pub = simAgent(af, D, 'sceai', 'sceai_indicators_agent', 'v5', q, ['sceai_indicators'], 12345);
    expect([pub.st, pub.err]).toEqual(['Failed', 'Tool-call limit reached (15 / 15)']);
    const draft = simAgent(af, D, 'sceai', 'sceai_indicators_agent', 'v6', q, ['sceai_indicators'], 12345);
    expect(draft.st).toBe('Succeeded');
    expect(draft.trace.map((x) => x[0])).toEqual(['Guardrails · input', 'Model call · plan', 'Tool calls', 'Model call · answer', 'Guardrails · output']);
    const wak = simAgent(af, D, 'sceai', 'sceai_indicators_agent', 'v6', 'What was hotel occupancy in Al Wakrah last month?', [], 1);
    expect(wak.tools.map((x) => x[0])).toEqual(['find_indicator', 'Indicator Picker (delegated)']);
    D.agents[2].dis = { by: 'sceai_admin', at: 'now', reason: 'test', ref: 'AUD-1' };
    expect(simAgent(af, D, 'sceai', 'sceai_indicators_agent', 'v5', q, [], 1).err).toBe('Agent is disabled (emergency)');
  });

  it('diffs versions and publishes', () => {
    const D = sceai();
    const o = D.agents.find((a) => a.id === 'sceai_indicators_agent')!;
    expect(diffOf(cfgOf(o, 'v5'), cfgOf(o, 'v6')).map((x) => x.a)).toEqual(['System instructions', 'Max tool calls', 'Failure handling']);
    activateVersion(o, 'v6');
    expect(o.vers.map((v) => v.st)).toEqual(['Published', 'Superseded', 'Superseded']);
    expect(addDraft(o, 'n.saleh', 'next')).toBe('v7');
    expect(o.vers[0].cfg!.tools).toBe(20);
  });

  it('lists the tenant tool inventory', () => {
    const af = agentFactoryInit();
    const inv = toolInv(af, af.tenants.sceai, 'sceai', 'SCEAI');
    expect(inv.find((x) => x.key === 'oxford_economics:EconomicData')!.stF).toBe('Degraded');
    expect(inv.find((x) => x.key === 'oxford_economics:CountryRisk')!.stF).toBe('Not enabled');
    expect(inv.some((x) => x.key.startsWith('web_fetch:'))).toBe(false);
    expect(inv.find((x) => x.key === 'kap:transcribe')!.stF).toBe('Available');
    expect(toolInv(af, af.tenants.econ, 'econ', 'EA').find((x) => x.key === 'kap:transcribe')!.stF).toBe('Unavailable');
  });
});

describe('agents list', () => {
  it('shows the design columns, filters and gates create', () => {
    const m = agentsScreen(ctx(), {}, noop);
    expect(m.head.title).toBe('Agents');
    expect(m.head.add?.l).toBe('Create agent');
    expect(labels(m.head.acts)).toEqual(['Evaluation datasets']);
    expect(m.sections[0].cols).toEqual(['Agent', 'Status', 'Active version', 'Model', 'Knowledge', 'Tools', 'Workflows']);
    const ia = m.sections[0].rows!.find((r) => r.key === 'a:sceai_indicators_agent')!;
    expect(ia.cells.map((x) => x.v)).toEqual(['sceai_indicators_agent', '', 'v5', 'qwen72b-prod', 'sceai_indicators, nds_planning_docs', '9', 'Ask AI, Weekly briefing']);
    expect(ia.cells[2].sub).toBe('Draft v6');
    expect(m.filters!.count).toBe('8 of 8 agents');
    const f = agentsScreen(ctx(), { q: 'oxford' }, noop);
    expect(f.sections[0].rows!.map((r) => r.key)).toEqual(['a:sceai_indicators_oxford']);
    expect(agentsScreen(ctx({ perms: ['agent:read'] }), {}, noop).head.add).toBeUndefined();
    expect(agentsScreen(ctx({ perms: [] }), {}, noop).sections[0].rows).toHaveLength(0);
  });
});

describe('agent detail', () => {
  const tabOf = (c: AgentsCtx, id: string, tab: string) => agentScreen(c, id, tab, noop);

  it('denies unknown or unreadable agents', () => {
    expect(tabOf(ctx(), 'nope', 'overview').denied).toContain("don't have access");
    expect(tabOf(ctx({ perms: [] }), 'Article Agent', 'overview').denied).toBeTruthy();
  });

  it('overview gates draft, archive and emergency disable', () => {
    const m = tabOf(ctx(), 'sceai_indicators_agent', undefined as unknown as string);
    expect(m.head.tab).toBe('overview');
    expect(m.head.tabs!.map((x) => x.label)).toEqual(['Overview', 'Configuration', 'Knowledge & Tools', 'Testing', 'Evaluation', 'Versions', 'Metrics']);
    expect(labels(m.sections[0].sacts)).toEqual(['Edit draft v6', 'Archive']);
    const rows = m.sections[0].rows!;
    expect(rows.find((r) => r.key === 'f:Operational state')!.acts!.map((x) => x.l)).toEqual(['Emergency disable']);
    const ro = tabOf(ctx({ perms: ['agent:read'] }), 'sceai_indicators_agent', 'overview');
    expect(ro.sections[0].sacts).toEqual([]);
    expect(ro.sections[0].rows!.some((r) => r.key === 'f:Operational state')).toBe(false);
  });

  it('configuration edits only drafts', () => {
    const m = tabOf(ctx(), 'sceai_indicators_agent', 'config');
    expect(m.sections[0].title).toBe('Draft v6');
    expect(labels(m.sections[0].sacts)).toEqual(['Compare with v5']);
    expect(m.sections[0].rows![0].acts!.map((x) => x.l)).toEqual(['Edit']);
    const pub = tabOf(ctx(), 'Article Agent', 'config');
    expect(pub.sections[0].title).toBe('Published v4');
    expect(labels(pub.sections[0].sacts)).toEqual(['Create draft to edit']);
    expect(pub.sections[0].rows![0].acts).toEqual([]);
    expect(pub.sections.map((s) => s.title)).toEqual(['Published v4', 'Execution limits and failure handling', 'Governance & Oversight', 'Guardrails']);
  });

  it('knowledge & tools shows draft tool changes', () => {
    const c = ctx();
    const o = c.D.agents.find((a) => a.id === 'Article Agent')!;
    addDraft(o, 'r.haddad', '');
    o.vers[0].cfg!.tset = ['kap:hybrid_search', 'kap:document_get', 'kap:entity_get'];
    const m = tabOf(c, 'Article Agent', 'knowledge');
    const tools = m.sections.find((s) => s.title === 'Tools · draft v5')!;
    const chg = Object.fromEntries(tools.rows!.map((r) => [r.cells[0].v, r.cells[4].v]));
    expect(chg).toEqual({ hybrid_search: '—', document_get: '—', extract_tables: 'Removed', entity_get: 'Added' });
    expect(m.sections.map((s) => s.title)).toContain('Entity sources');
    expect(m.sections.find((s) => s.title === 'Collections')!.rows!.map((r) => r.cells[0].v)).toEqual(['sceai_articles']);
  });

  it('testing shows the last run with trace', () => {
    const af = agentFactoryInit();
    const t0 = simAgent(af, af.tenants.sceai, 'sceai', 'sceai_indicators_agent', 'v5', 'Which indicators are currently off track and what do the plans say about them?', [], 1);
    const m = tabOf(ctx({ af, tests: { 'agent:sceai_indicators_agent': t0 } }), 'sceai_indicators_agent', 'testing');
    expect(m.sections.map((s) => s.title)).toEqual(['Test run', 'Tool invocations', 'Evidence', 'Execution trace']);
    expect(m.sections[0].rows!.map((r) => r.cells[0].v)).toContain('Next step');
    expect(labels(m.sections[0].sacts)).toEqual(['Run test', 'Open Playground']);
  });

  it('evaluation shows correction progress, gate and failed cases', () => {
    const m = tabOf(ctx(), 'sceai_indicators_agent', 'eval');
    expect(m.sections[0].title).toBe('Correction progress · v6');
    expect(m.sections[0].rows!.map((r) => r.cells[0].v)).toEqual(['1. Failure found', '2. Correction drafted', '3. Re-evaluated', '4. Published']);
    expect(m.sections[0].rows![2].cells[1].p).toEqual(['submitted', 'Next']);
    expect(m.sections.map((s) => s.title)).toEqual(['Correction progress · v6', 'Evaluation gate', 'Quality metrics', 'Version comparison', 'Failed test cases · EV-0412 · v5', 'Evaluation history', 'Evaluation datasets']);
    const failed = m.sections.find((s) => s.title?.startsWith('Failed'))!;
    expect(failed.cols![failed.cols!.length - 1]).toBe('In draft v6');
    expect(failed.rows![0].cells[3].v).toBe('Tool-call limit reached before all indicators were resolved');
  });

  it('versions offer publish and roll back when permitted', () => {
    const m = tabOf(ctx(), 'sceai_indicators_agent', 'versions');
    const v = m.sections.find((s) => s.title === 'Versions')!;
    expect(v.rows!.map((r) => labels(r.acts))).toEqual([['Publish'], [], ['Roll back']]);
    expect(labels(v.sacts)).toEqual(['Compare versions']);
    const ro = tabOf(ctx({ perms: ['agent:read'] }), 'sceai_indicators_agent', 'versions');
    expect(ro.sections.find((s) => s.title === 'Versions')!.rows!.every((r) => !r.acts!.length)).toBe(true);
  });

  it('metrics lists recent jobs with links to traces', () => {
    const c = ctx();
    const m = tabOf(c, 'sceai_indicators_agent', 'metrics');
    expect(m.sections[0].rows!.find((r) => r.key === 'f:Failures')!.cells[1].v).toBe('2');
    const jobs = m.sections[1];
    expect(jobs.rows).toHaveLength(7);
    jobs.rows![0].acts![0].f();
    expect(c.go.run).toHaveBeenCalledWith('4be0d913');
  });
});

describe('evaluation datasets', () => {
  it('lists datasets and their usage', () => {
    const m = evalSetsScreen(ctx());
    expect(m.head.title).toBe('Evaluation Datasets');
    expect(m.sections[0].rows!.map((r) => r.cells.map((x) => x.v))[2]).toEqual(['ES-REF', '2', 'English', '2', 'sceai_indicators_agent, Article Agent', 'sceai_admin']);
    expect(evalSetsScreen(ctx({ perms: ['agent:read'] })).head.add).toBeUndefined();
  });

  it('shows a dataset with its test cases', () => {
    const m = evalSetScreen(ctx(), 'ES-NUM');
    expect(m.head.title).toBe('ES-NUM · Numeric questions');
    const cases = m.sections[1];
    expect(cases.rows).toHaveLength(6);
    expect(cases.rows![5].cells[5]).toMatchObject({ v: 'From run b1c94f08', sub: 'Tool-call limit' });
    expect(labels(cases.sacts)).toEqual(['Add test case']);
    expect(evalSetScreen(ctx(), 'ES-XXX').denied).toBeTruthy();
  });
});

describe('create agent wizard', () => {
  it('validates and builds draft v1', () => {
    const ids = ['Intent Agent', 'my_agent'];
    expect(validateAgentStep({ ids }, 0, { id: 'Bad Name', purpose: 'x' })).toMatch(/lower-case/);
    expect(validateAgentStep({ ids }, 0, { id: 'my_agent', purpose: 'x' })).toBe('An agent with this name exists.');
    expect(validateAgentStep({ ids }, 3, { ent: 'Entities only', entTypes: [] })).toBe('Select at least one entity type.');
    const a = agentRecord({ id: 'supplier_agent', purpose: 'Contracts', instr: 'Answer from contracts.', model: 'Tenant default', fb: 'None', multi: 'None', lim: '10', dur: '60 s', fail: 'Refuse with an explanation', guards: ['Grounding required'], tools: ['kap:hybrid_search'], ent: 'Off', entTypes: [] }, 'r.haddad');
    expect(a.st).toBe('Draft');
    expect(a.vers[0].cfg).toMatchObject({ model: 'default:agent', tools: 10, guards: ['Prompt injection', 'Jailbreak', 'Grounding required'], tset: ['kap:hybrid_search'], ent: { mode: 'Off', hops: '—', types: [] } });
  });
});
