import { describe, expect, it, vi } from 'vitest';
import { agentFactoryInit } from '@/v35/data/agentFactory';
import { initialBusinessData } from '@/v35/data/businessData';
import { agentsMapScreen, corrSec, evalSec, versionsSec, wfTabOf, workflowScreen, workflowsScreen, type WfCtx } from './build';
import { cfgOf, gateL, gateOf, hashC, simAgent, simEval, wfKey } from './logic';
import { wfCheck } from './model';
import { wfView, type WfTenant } from './types';
import type { WfUi } from './state';

const noop = () => {};
const view = (t: 'sceai' | 'econ' | 'sandbox' = 'sceai') => wfView(agentFactoryInit(), initialBusinessData().agColl, t);
function ctx(D: WfTenant, o: Partial<WfCtx> = {}, ui: Partial<WfUi> = {}): WfCtx {
  const go = { list: vi.fn(), wf: vi.fn(), map: vi.fn(), pipeline: vi.fn(), agent: vi.fn(), evalset: vi.fn(), evalsets: vi.fn(), run: vi.fn(), audit: vi.fn() };
  const a = {
    create: vi.fn(), createDraft: vi.fn(), publish: vi.fn(), rollback: vi.fn(), compare: vi.fn(), compareF: vi.fn(), runEval: vi.fn(), runEvalF: vi.fn(), thresholdsF: vi.fn(),
    datasetsF: vi.fn(), disable: vi.fn(), reenable: vi.fn(), caseForm: vi.fn(), openSetting: vi.fn(), replay: vi.fn(), showStep: vi.fn(),
  };
  return {
    t: 'sceai', tn: 'SCEAI', D, ui: { wd: {}, ver: {}, test: {}, lastCase: null, ...ui }, actor: 'r.haddad',
    canRead: () => true, canUpd: true, canAppr: true, canOps: true, canCreate: true, canExec: true, go, a, ...o,
  };
}
const labels = (acts?: { l: string }[]) => (acts ?? []).map((x) => x.l);

describe('workflow data view', () => {
  it('reads workflows and agents of each tenant from the agent factory', () => {
    const D = view();
    expect(D.workflows.map((w) => w.id)).toEqual(['ask_ai', 'weekly_briefing']);
    expect(view('econ').workflows.map((w) => w.id)).toEqual(['budget_brief']);
    expect(view('sandbox').workflows.map((w) => w.id)).toEqual(['research_assistant']);
    const ag = D.agents.find((a) => a.id === 'sceai_indicators_agent')!;
    expect([ag.v, ag.draft, ag.tools, ag.colls]).toEqual(['v5', 'v6', 15, ['sceai_indicators', 'nds_planning_docs']]);
    expect(ag.tset).toContain('sceai_indicator_tools:find_indicator');
  });

  it('the published workflow graphs pass the structural checks', () => {
    for (const t of ['sceai', 'econ', 'sandbox'] as const) {
      const D = view(t);
      D.workflows.forEach((w) => expect(wfCheck(cfgOf(w), () => '').filter((i) => i.sev === 'error')).toEqual([]));
    }
  });
});

describe('workflows list', () => {
  it('shows the design columns and actions', () => {
    const c = ctx(view());
    const m = workflowsScreen(c, {}, noop);
    expect(m.head.title).toBe('Agent Workflows');
    expect(labels(m.head.acts)).toEqual(['Tenant agents map', 'Evaluation datasets']);
    expect(m.head.add?.l).toBe('Create workflow');
    const s = m.sections[0];
    expect(s.cols).toEqual(['Workflow', 'Status', 'Version', 'Orchestration', 'Entry point', 'Agents', 'Recent runs']);
    const r = s.rows![0];
    expect(r.cells.map((x) => x.v)).toEqual(['Ask AI', '', 'v9', 'Conditional routing · Parallel · Delegation', 'Chat and API', 'Intent Agent, sceai_indicators_agent, Indicator Picker, sceai_indicators_oxford, Article Agent, Composer Agent, Follow-up Agent', 'Succeeded · 12 min ago']);
    expect(r.cells[1].p).toEqual(['approved', 'Published']);
    expect(labels(r.acts)).toEqual(['Open', 'Designer']);
    r.acts![1].f();
    expect(c.go.wf).toHaveBeenCalledWith('ask_ai', 'designer');
    expect(m.filters?.count).toBe('2 of 2 workflows');
  });

  it('filters by search and gates create', () => {
    const m = workflowsScreen(ctx(view(), { canCreate: false }), { q: 'Reader' }, noop);
    expect(m.sections[0].rows!.map((r) => r.cells[0].v)).toEqual(['Weekly briefing']);
    expect(m.head.add).toBeUndefined();
  });

  it('explains when the tenant has no agent factory', () => {
    expect(workflowsScreen(ctx(view(), { t: null }), {}, noop).sections[0].callout).toBe('Agent workflows are not available in this tenant.');
  });
});

describe('workflow details', () => {
  it('maps older tab keys to the designer', () => {
    expect([wfTabOf('map'), wfTabOf('config'), wfTabOf('testing'), wfTabOf('eval'), wfTabOf('nope')]).toEqual(['designer', 'designer', 'designer', 'eval', 'overview']);
  });

  it('shows the overview with the participating agents and emergency disable', () => {
    const c = ctx(view());
    const m = workflowScreen(c, 'ask_ai', undefined, noop, () => null);
    expect(m.head.title).toBe('Ask AI');
    expect(m.head.tabs!.map((x) => x.label)).toEqual(['Overview', 'Designer', 'Evaluation', 'Versions', 'Metrics']);
    const rows = m.sections[0].rows!;
    expect(rows.map((r) => r.cells[0].v)).toEqual(['Purpose', 'Lifecycle', 'Entry point', 'Orchestration', 'Operational state', 'Fallback and error handling', 'Execution limits']);
    expect(rows[3].cells[1]).toMatchObject({ v: 'Conditional routing · Parallel · Delegation', sub: '10 steps · 7 agents' });
    expect(labels(rows[4].acts)).toEqual(['Emergency disable']);
    expect(m.sections[1].rows!.find((r) => r.key === 'pa:sceai_indicators_agent')!.cells[3].p).toEqual(['approved', 'Published · draft open']);
    const ro = workflowScreen(ctx(view(), { canOps: false }), 'ask_ai', undefined, noop, () => null);
    expect(ro.sections[0].rows!.some((r) => r.cells[0].v === 'Operational state')).toBe(false);
  });

  it('renders the designer as a custom section', () => {
    const m = workflowScreen(ctx(view()), 'ask_ai', 'designer', noop, (w, v) => `${w.id}@${v}`);
    expect(m.sections[0].custom).toBe('ask_ai@v9');
  });

  it('reports a missing workflow', () => {
    const m = workflowScreen(ctx(view()), 'nope', undefined, noop, () => null);
    expect(m.sections[0].callout).toContain('does not exist in SCEAI');
  });

  it('lists recent runs with replay on the metrics tab', () => {
    const c = ctx(view());
    const m = workflowScreen(c, 'ask_ai', 'metrics', noop, () => null);
    const r = m.sections[1].rows![1];
    expect(r.cells[0].v).toBe('w-77d0b912');
    expect(labels(r.acts)).toEqual(['Open', 'Replay']);
    r.acts![1].f();
    expect(c.a.replay).toHaveBeenCalled();
  });
});

describe('evaluation and versions', () => {
  it('evaluates the gate of the published version', () => {
    const D = view();
    const w = D.workflows[0];
    const r = D.evalruns.find((x) => x.t === wfKey('ask_ai'))!;
    expect(gateOf(D, w, r).ok).toBe(true);
    expect(gateL(D, w, 'v9')).toEqual(['approved', 'Gate passed']);
    expect(gateL(D, w, 'v8')).toEqual(['draft', 'Not evaluated']);
    const secs = evalSec(ctx(D), w);
    expect(secs.map((s) => s.title || '')).toEqual(['', 'Evaluation gate', 'Quality metrics', 'Failed test cases · EV-0414 · v9', 'Evaluation history', 'Evaluation datasets']);
    expect(secs[2].rows!.length).toBe(7 + 2);
  });

  it('a changed draft must be evaluated again (configuration hash)', () => {
    const D = view();
    const w = structuredClone(D.workflows[0]);
    w.vers.unshift({ v: 'v10', st: 'Draft', at: 'just now', by: 'x', note: '', cfg: structuredClone(cfgOf(w)) });
    D.evalruns.unshift({ id: 'EV-9', t: wfKey(w.id), v: 'v10', set: 'ES-WF', at: 'now', by: 'x', m: D.evalruns[0].m, failed: [], h: hashC(cfgOf(w, 'v10')) });
    D.workflows[0] = w;
    expect(gateL(D, w, 'v10')).toEqual(['approved', 'Gate passed']);
    w.vers[0].cfg!.limits.dur = '120 s';
    expect(gateL(D, w, 'v10')).toEqual(['hold', 'Changed · re-evaluate']);
    const cp = corrSec(ctx(D), w)[0];
    expect(cp.title).toBe('Release progress · v10');
    expect(cp.rows!.map((r) => r.cells[1].p![1])).toEqual(['Done', 'Next', 'To do']);
    expect(labels(cp.rows![1].acts)).toEqual(['Run evaluation']);
  });

  it('simulates evaluations from the previous result', () => {
    const D = view();
    const s = simEval(D, D.workflows[0], 'v9', 'ES-WF');
    // the v9 change note mentions a fallback: the prototype counts it as a fix (+0.02)
    expect(s.m.acc).toBe(0.97);
    expect(s.failed).toEqual([]);
  });

  it('offers publish, rollback and compare on the versions tab', () => {
    const D = view();
    const w = structuredClone(D.workflows[0]);
    w.vers.find((v) => v.v === 'v8')!.cfg = structuredClone(cfgOf(w));
    const c = ctx(D);
    const s = versionsSec(c, w).find((x) => x.title === 'Versions')!;
    expect(labels(s.sacts)).toEqual(['Create draft', 'Compare versions']);
    expect(labels(s.rows![1].acts)).toEqual(['Roll back', 'Compare with v9']);
    const ro = versionsSec(ctx(D, { canUpd: false }), w).find((x) => x.title === 'Versions')!;
    expect(labels(ro.sacts)).toEqual(['Compare versions']);
  });
});

describe('agent simulation', () => {
  it('fails unresolved indicators unless the agent delegates to the Indicator Picker', () => {
    const D = view();
    const a = D.agents.find((x) => x.id === 'sceai_indicators_agent')!;
    expect(simAgent(a, 'hotel occupancy in Al Wakrah')).toEqual({ st: 'Failed', err: 'Indicator not found', tools: 1 });
    expect(simAgent({ ...a, fail: 'Delegate unresolved indicators to Indicator Picker' }, 'hotel occupancy')!.st).toBe('Succeeded');
    expect(simAgent(a, 'Which indicators are off track?')!.err).toBe('Tool-call limit reached (15 / 15)');
    expect(simAgent({ ...a, dis: { by: 'x', at: 'now', reason: 'r', ref: 'A' } }, 'x')!.st).toBe('Failed');
    expect(simAgent(undefined, 'x')).toBeNull();
  });
});

describe('tenant agents map', () => {
  it('connects agents to workflows and tools, and links the Ask AI pipeline map', () => {
    const c = ctx(view());
    const m = agentsMapScreen(c, 'a:Composer Agent', noop);
    expect(m.head.title).toBe('Tenant Agents Map');
    expect(labels(m.head.acts)).toEqual(['Agent workflows', 'Ask AI pipeline map']);
    const g = m.sections[0].dgm!;
    expect(g.nodes.filter((n) => n.id.startsWith('w:')).map((n) => n.l1)).toEqual(['Ask AI', 'Weekly briefing']);
    expect(g.edges.filter((e) => e.a === 'a:Composer Agent' && e.b.startsWith('w:')).every((e) => e.tone === 'brand')).toBe(true);
    expect(g.inspect![0]).toEqual(['Agent', 'Composer Agent']);
    expect(labels(m.sections[0].sacts)).toEqual(['Open Composer Agent']);
    const econ = agentsMapScreen(ctx(view('econ'), { t: 'econ' }), null, noop);
    expect(labels(econ.head.acts)).toEqual(['Agent workflows']);
  });

  it('hides agents the viewer cannot read', () => {
    const m = agentsMapScreen(ctx(view(), { canRead: (a) => a !== 'Reader Agent' }), null, noop);
    expect(m.sections[0].dgm!.nodes.some((n) => n.id === 'a:Reader Agent')).toBe(false);
  });
});
