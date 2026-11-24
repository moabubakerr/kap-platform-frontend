import { describe, expect, it } from 'vitest';
import {
  addNode, blankG, canConnect, clone, connectNodes, diffOf, dupNode, fromTemplate, removeSel, setEdgeKind, simWf, snap, wfBuild, wfCheck, wfDerive,
  wfFromStages, wfIssues, wfLayout, wfPattern, wfRoute, wfSay, wfSync, wfTemplate, type Stage, type WfCfg,
} from './model';

const ok = () => '';
const last = <T,>(a: T[]): T => a[a.length - 1];
const askStages = (): Stage[] => [
  { id: 'intent', type: 'agent', agent: 'Intent Agent', role: 'Understand' },
  { id: 'route', type: 'route', by: '', label: 'Route by question', routes: [
    { id: 'num', cond: 'numeric', agent: 'sceai_indicators_agent', role: 'Numeric · local', del: { id: 'pick', agent: 'Indicator Picker', when: 'unresolved' } },
    { id: 'oxf', cond: 'external context', agent: 'sceai_indicators_oxford', role: 'External context' },
    { id: 'art', cond: 'documents', agent: 'Article Agent', role: 'Documents' },
  ] },
  { id: 'comp', type: 'aggregate', agent: 'Composer Agent', role: 'Aggregate results' },
  { id: 'follow', type: 'agent', side: true, agent: 'Follow-up Agent', role: 'In parallel' },
  { id: 'verify', type: 'validate', label: 'Numeric verifier', check: 'Numbers match the source data', onFail: 'fallback' },
];
const askCfg = (): WfCfg => wfFromStages({
  stages: askStages(), io: { in: ['Request', 'Chat · API'], out: ['Answer', 'With citations'] },
  fb: { on: 'Validation fails or a step times out', action: 'Return a template answer', label: 'Template answer', node: true },
  limits: { dur: '60 s', steps: '12' }, map: [], nodes: [], edges: [], pos: {}, np: {}, mode: '', fail: '', onErr: '',
}, 'Chat and API');

describe('wfBuild / wfFromStages', () => {
  it('builds the Ask AI graph from its stages as the prototype data has it', () => {
    const c = askCfg();
    expect(c.nodes.map((n) => n[0])).toEqual(['in', 'intent', 'route', 'num', 'pick', 'oxf', 'art', 'comp', 'follow', 'verify', 'fb', 'out']);
    expect(c.nodes.find((n) => n[0] === 'route')).toEqual(['route', 'router', 'Route by question', 'Conditional']);
    const E = c.edges.map((e) => e.slice(0, 4).join(' '));
    expect(E).toContain('route num cond numeric');
    expect(E).toContain('num pick delegate unresolved');
    expect(E).toContain('comp follow par ');
    expect(E).toContain('verify out seq passed');
    expect(E).toContain('verify fb fallback failed');
    expect(E).toContain('fb out seq ');
    expect(E).toContain('follow out par ');
    expect(c.edges.every((e) => e.length === 5)).toBe(true);
    expect(c.np.verify).toEqual({ rt: 'validate', check: 'Numbers match the source data', onFail: 'Use the fallback' });
    expect(c.np.fb).toEqual({ on: 'Validation fails or a step times out', action: 'Return a template answer' });
    expect(c.mode).toBe('Conditional routing · Parallel · Delegation');
    expect(c.fail).toBe('Validation fails or a step times out: return a template answer');
    expect(c.stages).toBeUndefined();
    expect(Object.keys(c.pos)).toHaveLength(c.nodes.length);
  });

  it('routes with an agent instead of a router node, and stops without a fallback node', () => {
    const g = wfBuild({ stages: [{ id: 'router', type: 'route', by: 'exp_router', role: 'Route', routes: [{ id: 'res', cond: 'research', agent: 'a' }, { id: 'cust', cond: 'customer', agent: 'b' }] }] }, 'Chat');
    expect(g.nodes.map((n) => n[1])).toEqual(['entry', 'agent', 'agent', 'agent', 'output']);
    expect(g.edges.map((e) => e.slice(0, 3).join(' '))).toEqual(['in router seq', 'router res cond', 'router cust cond', 'res out seq', 'cust out seq']);
    const c = wfSync({ stages: [{ id: 's1', type: 'agent', agent: 'a' }], fb: { action: 'Stop and return an explanation', on: 'A step fails' } } as WfCfg);
    expect(c.mode).toBe('Sequential');
    expect(c.fail).toBe('A step fails: stop and return an explanation');
  });

  it('labels the edge after a human review "approved"', () => {
    const g = wfBuild({ stages: [{ id: 'a', type: 'agent', agent: 'x' }, { id: 'rev', type: 'review', who: 'Analyst' }] });
    expect(last(g.edges)!.slice(0, 4)).toEqual(['rev', 'out', 'seq', 'approved']);
  });
});

describe('wfLayout', () => {
  it('places nodes in layers left to right and delegates beside their caller', () => {
    const c = askCfg();
    const P = wfLayout(c);
    expect(P.in[0]).toBe(24);
    expect(P.intent[0]).toBe(24 + 210);
    expect(P.num[0]).toBe(P.pick[0]);
    expect(P.out[0]).toBeGreaterThan(P.verify[0]);
    expect(P.fb[0]).toBeGreaterThan(P.verify[0]);
  });
});

describe('wfDerive / wfPattern', () => {
  it('derives the orchestration pattern from the edges', () => {
    expect(wfDerive({ edges: [] }).mode).toBe('Sequential');
    expect(wfDerive({ edges: [['a', 'b', 'delegate', 'x', '']] }).mode).toBe('Sequential · Delegation');
    expect(wfDerive({ edges: [['a', 'b', 'par', '', '']] }).mode).toBe('Parallel');
    expect(wfDerive({ edges: [], onErr: 'Stop and notify the owner' }).fail).toBe('Stop and notify the owner');
    expect(wfPattern([{ id: 'p', type: 'parallel', members: [] }])).toBe('Parallel');
    expect(wfPattern(askStages())).toBe('Conditional routing · Delegation');
  });
});

describe('wfCheck', () => {
  it('passes the published Ask AI graph', () => {
    expect(wfCheck(askCfg(), ok)).toEqual([]);
  });

  it('reports unreachable steps, routers with one path, empty conditions and unknown agents', () => {
    const c = blankG('Chat');
    expect(wfCheck(c, ok)).toEqual([{ id: 'out', sev: 'error', m: 'There is no path from the entry point to Answer.' }]);
    const r = addNode(c, 'comp:router');
    const a = addNode(c, 'agent:ghost');
    connectNodes(c, 'in', r);
    connectNodes(c, r, a);
    connectNodes(c, a, 'out');
    const f = addNode(c, 'comp:fallback');
    const I = wfCheck(c, (x) => (x === 'ghost' ? 'does not exist in SCEAI' : ''));
    expect(I.map((i) => i.m)).toEqual([
      'Router needs at least two conditional paths.',
      'ghost does not exist in SCEAI.',
      'Template answer is never triggered: connect a failure path to it.',
      'Set the condition for Router → ghost.',
    ]);
    expect(I.find((i) => i.id === f)!.sev).toBe('warn');
  });

  it('warns about a validator without a failure path', () => {
    const c = blankG('Chat');
    const v = addNode(c, 'comp:validate');
    connectNodes(c, 'in', v);
    connectNodes(c, v, 'out');
    expect(wfCheck(c, ok)).toEqual([{ id: v, sev: 'warn', m: 'Numeric verifier has no failure path to a fallback handler.' }]);
    expect(c.edges[1][3]).toBe('passed');
  });
});

describe('templates', () => {
  it('builds each starting pattern', () => {
    expect(wfTemplate('Sequential', ['a', 'b']).map((s) => s.type)).toEqual(['agent', 'agent']);
    const par = wfTemplate('Parallel then aggregate', ['a', 'b', 'c'], { agg: 'b' });
    expect(par[0].members!.map((m) => m.agent)).toEqual(['a', 'c']);
    expect(par[1]).toMatchObject({ type: 'aggregate', agent: 'b' });
    expect(wfTemplate('Conditional routing', ['r', 'x', 'y'], { router: 'r' })[0]).toMatchObject({ type: 'route', by: 'r', routes: [{ agent: 'x' }, { agent: 'y' }] });
    expect(wfTemplate('Supervisor with delegation', ['s', 'd', 'e'])[0]).toMatchObject({ role: 'Supervisor', del: { agent: 'd' } });
    expect(wfTemplate('Sequential', ['a'], { val: 'Numbers match the source data', review: 'Analyst' }).map((s) => s.type)).toEqual(['agent', 'validate', 'review']);
  });

  it('opens a conditional routing template with conditions to set', () => {
    const c = fromTemplate('Chat', 'Conditional routing', ['a', 'b']);
    expect(c.mode).toBe('Conditional routing');
    expect(wfCheck(c, ok).filter((i) => i.sev === 'error').map((i) => i.m)).toEqual(['Set the condition for Route by condition → a.', 'Set the condition for Route by condition → b.']);
    const c2 = fromTemplate('Chat', 'Conditional routing', ['a', 'b'], { conds: { a: 'numbers', b: 'documents' } });
    expect(wfCheck(c2, ok)).toEqual([]);
  });

  it('describes stages and lists stage issues', () => {
    expect(wfSay(askStages()[1])).toBe('Rules decide which agent handles the request: "numeric" → sceai_indicators_agent (delegates to Indicator Picker when unresolved); "external context" → sceai_indicators_oxford; "documents" → Article Agent');
    expect(wfSay(askStages()[4])).toBe('Numeric verifier checks that numbers match the source data; on failure the fallback applies');
    expect(wfIssues({ stages: [] }, ok)).toEqual(['Add at least one stage.']);
    expect(wfIssues({ stages: [{ id: 'r', type: 'route', routes: [{ agent: 'x' }] }] }, (a) => (a === 'x' ? 'is archived' : ''))).toEqual([
      'Stage 1: conditional routing needs at least two paths.', 'Stage 1: set the condition for the path to x.', 'Stage 1: x is archived.',
    ]);
  });
});

describe('designer operations', () => {
  it('adds steps, keeps the output last and snaps dropped positions', () => {
    const c = blankG('Chat');
    const id = addNode(c, 'agent:Composer Agent', [300, 200]);
    expect(id).toBe('a1');
    expect(last(c.nodes)![1]).toBe('output');
    expect(c.pos.a1).toEqual([snap(300 - 80), snap(200 - 27)]);
    expect(addNode(c, 'comp:human')).toBe('h1');
    expect(c.np.h1).toEqual({ rt: 'human', who: 'Agent reviewers' });
  });

  it('chooses the edge kind from the nodes it connects', () => {
    const c = blankG('Chat');
    const a = addNode(c, 'agent:a'), b = addNode(c, 'agent:b'), f = addNode(c, 'comp:fallback'), h = addNode(c, 'comp:human');
    expect(canConnect(c, a, 'in')).toEqual({ err: 'Connections start at the entry point and end at the output.' });
    connectNodes(c, 'in', a);
    connectNodes(c, a, b);
    expect(connectNodes(c, a, h)).toEqual({ added: 2 });
    expect(c.edges.filter((e) => e[0] === a).map((e) => e[2])).toEqual(['par', 'par']);
    connectNodes(c, b, f);
    expect(last(c.edges)!.slice(0, 4)).toEqual([b, f, 'fallback', 'step fails']);
    connectNodes(c, h, 'out');
    expect(last(c.edges)![3]).toBe('approved');
    expect(canConnect(c, 'in', a)).toEqual({ existing: 0 });
  });

  it('removes and duplicates steps, never the entry point or the output', () => {
    const c = blankG('Chat');
    const a = addNode(c, 'agent:a');
    connectNodes(c, 'in', a);
    connectNodes(c, a, 'out');
    expect(removeSel(c, 'n:in')).toBe('The entry point and the output are part of every workflow.');
    const d = dupNode(c, a);
    expect(d).toBe('a2');
    expect(c.pos[d]).toEqual([c.pos[a][0] + 24, c.pos[a][1] + 70]);
    expect(removeSel(c, 'n:' + a)).toBe('');
    expect(c.edges).toEqual([]);
    connectNodes(c, 'in', d);
    expect(removeSel(c, 'e:0')).toBe('');
    expect(c.edges).toEqual([]);
  });

  it('turns sibling sequential edges parallel', () => {
    const c = blankG('Chat');
    const a = addNode(c, 'agent:a'), b = addNode(c, 'agent:b');
    c.edges.push(['in', a, 'seq', '', ''], ['in', b, 'seq', '', '']);
    setEdgeKind(c, 0, 'Parallel');
    expect(c.edges.map((e) => e[2])).toEqual(['par', 'par']);
    setEdgeKind(c, 0, 'Conditional');
    expect(c.edges[0][2]).toBe('cond');
  });
});

describe('simulation', () => {
  const sim = (q: string, fail: (a: string) => boolean = () => false) =>
    simWf(askCfg(), 'ask_ai', 'v9', q, (a) => (fail(a) ? { st: 'Failed', err: 'Indicator not found', tools: 1 } : { st: 'Succeeded', err: '', tools: 3 }), false, 'T-1');

  it('routes Ask AI requests like the prototype', () => {
    const c = askCfg();
    expect(wfRoute(c, 'What does the strategy say?', 'ask_ai')).toBe('art');
    expect(wfRoute(c, 'Compare with the Oxford outlook', 'ask_ai')).toBe('oxf');
    expect(wfRoute(c, 'Inflation in 2019', 'ask_ai')).toBe('num');
    const g = fromTemplate('Chat', 'Conditional routing', ['a', 'b'], { conds: { a: 'numbers', b: 'documents' } });
    expect(wfRoute(g, 'which documents mention it', 'other')).toBe(g.edges.find((e) => e[3] === 'documents')![1]);
    expect(wfRoute(g, 'unmatched', 'other')).toBe(g.edges.find((e) => e[3] === 'numbers')![1]);
  });

  it('walks the selected path and skips the fallback when nothing fails', () => {
    const r = sim('Inflation in 2019');
    expect(r.st).toBe('Succeeded');
    expect(r.path).toMatchObject({ in: 'ok', intent: 'ok', route: 'ok', num: 'ok', pick: 'skip', oxf: 'skip', art: 'skip', comp: 'ok', verify: 'ok', fb: 'skip', out: 'ok' });
    expect(r.steps.map((s) => s[4])).toEqual(['in', 'intent', 'route', 'num', 'comp', 'follow', 'out', 'verify']);
  });

  it('takes the delegation and the fallback when a step fails', () => {
    const r = sim('Hotel occupancy in Al Wakrah', (a) => a === 'sceai_indicators_agent' || a === 'Indicator Picker');
    expect(r.st).toBe('Succeeded with fallback');
    expect(r.path).toMatchObject({ num: 'bad', pick: 'bad', verify: 'bad', fb: 'ok', out: 'ok' });
    expect(r.answer).toBe('Template answer: no official data is available for this request.');
  });

  it('rejects every request while the workflow is disabled', () => {
    const r = simWf(askCfg(), 'ask_ai', 'v9', 'x', () => ({ st: 'Succeeded', err: '', tools: 1 }), true);
    expect(r.st).toBe('Failed');
    expect(r.path.in).toBe('bad');
    expect(r.path.out).toBe('skip');
  });
});

describe('diffOf', () => {
  it('lists added steps, changed connections and settings', () => {
    const a = askCfg();
    const b = clone(a);
    addNode(b, 'agent:Reader Agent');
    b.edges[0][4] = 'question';
    b.limits = { dur: '120 s', steps: '12' };
    const D = diffOf(a, b);
    expect(D).toContainEqual({ a: 'Step added', b: 'Reader Agent · Agent', c: '' });
    expect(D).toContainEqual({ a: 'Connection changed', b: 'Request → Intent Agent · Sequential', c: '→ Sequential · passes question' });
    expect(D.find((x) => x.a === 'Execution limits')).toBeTruthy();
    expect(diffOf(a, clone(a))).toEqual([]);
  });
});
