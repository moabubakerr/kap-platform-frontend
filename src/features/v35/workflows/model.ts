/**
 * Workflow model (port of the prototype's `wf*` functions, design-ref-v35/app.js
 * 2157–2234, and the designer operations of `agentHub` 2763–2907).
 *
 * A workflow version is a graph: nodes [id, kind, label, sub] and edges
 * [from, to, kind, condition, data passed]. Older versions were described as
 * stages; `wfFromStages` converts them once into the graph edited on the canvas.
 * Everything here is pure (mutating only the config passed in) so it can be tested.
 */

export type NodeKind = 'entry' | 'agent' | 'aggregate' | 'router' | 'review' | 'fallback' | 'output' | 'tool';
export type EdgeKind = 'seq' | 'par' | 'cond' | 'delegate' | 'fallback';
/** [id, kind, label (agent name for agent steps), sub (role)] */
export type WfNode = [string, NodeKind, string, string];
/** [from, to, kind, condition or label, data passed] */
export type WfEdge = [string, string, EdgeKind, string, string];
export type NodeProps = Record<string, string>;

export interface StageBranch { id?: string; agent?: string; cond?: string; role?: string; del?: { id?: string; agent: string; when?: string } | null }
export interface Stage {
  id: string;
  type: 'agent' | 'aggregate' | 'parallel' | 'route' | 'validate' | 'review';
  agent?: string;
  role?: string;
  side?: boolean;
  del?: { id?: string; agent: string; when?: string } | null;
  members?: { id?: string; agent: string; role?: string }[];
  by?: string;
  label?: string;
  routes?: StageBranch[];
  check?: string;
  onFail?: string;
  who?: string;
}
export interface StageFallback { on?: string; action?: string; label?: string; node?: boolean }

export interface WfCfg {
  nodes: WfNode[];
  edges: WfEdge[];
  pos: Record<string, [number, number]>;
  np: Record<string, NodeProps>;
  mode: string;
  fail: string;
  onErr: string;
  limits: { dur: string; steps: string };
  io: { in: [string, string]; out: [string, string] };
  map: [string, string][];
  /** stage model of earlier versions (removed by wfFromStages) */
  stages?: Stage[];
  fb?: StageFallback;
}

export interface Issue { id: string; sev: 'error' | 'warn'; m: string }

// ---------------------------------------------------------------- vocabulary
export const KL: Record<string, string> = { entry: 'Entry point', agent: 'Agent', router: 'Router', aggregate: 'Aggregation', review: 'Validation or review', fallback: 'Fallback', output: 'Output', tool: 'Tool' };
export const EL: Record<EdgeKind, string> = { seq: 'Sequential', cond: 'Conditional route', par: 'Parallel', delegate: 'Delegation', fallback: 'Fallback path' };
export const KTONE = { entry: 'brand', agent: 'base', router: 'run', aggregate: 'out', review: 'warn', fallback: 'off', output: 'out', tool: 'ref' } as const;
export const PATS: [string, string][] = [
  ['Sequential', 'Agents run one after another; each receives the previous result.'],
  ['Parallel then aggregate', 'Agents run at the same time; one agent combines their results.'],
  ['Conditional routing', 'A router sends each request to one of several agents.'],
  ['Supervisor with delegation', 'The first agent leads and hands sub-tasks to a specialist agent.'],
];
export const CHECKS = ['Numbers match the source data', 'Every statement has a citation', 'Answer language matches the question', 'No personal data in the answer'];
export const CHKL: Record<string, string> = { 'Numbers match the source data': 'Numeric verifier', 'Every statement has a citation': 'Citation check', 'Answer language matches the question': 'Language check', 'No personal data in the answer': 'Personal data check' };
export const FBA = ['Return a template answer', 'Hand over to a human reviewer', 'Stop and return an explanation', 'Stop and notify the owner'];
export const COMP: [string, string, string][] = [
  ['router', 'Router', 'Sends each request down one conditional path'],
  ['aggregate', 'Aggregator', 'Combines the results of earlier steps'],
  ['validate', 'Validator', 'Checks the result before it is returned'],
  ['human', 'Human review', 'A person reviews the result before it continues'],
  ['fallback', 'Fallback handler', 'Runs when a step or check fails'],
];
export const ETY: [EdgeKind, string][] = [['seq', 'Sequential'], ['par', 'Parallel'], ['cond', 'Conditional'], ['delegate', 'Delegation'], ['fallback', 'Failure path']];
export const NW = 160;
export const NH = 54;

export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ---------------------------------------------------------------- stage model → graph
export function wfBuild(cfg: { stages?: Stage[]; io?: WfCfg['io']; fb?: StageFallback }, entrySub?: string) {
  const st = cfg.stages || [];
  const io = cfg.io || ({} as NonNullable<WfCfg['io']>);
  const nodes: WfNode[] = [['in', 'entry', (io.in || [])[0] || 'Request', (io.in || [])[1] || entrySub || '']];
  const edges: WfEdge[] = [];
  const own: Record<string, string> = { in: '@entry' };
  const eown: string[] = [];
  const E = (a: string, b: string, k: EdgeKind, c: string | undefined, o: string) => {
    edges.push([a, b, k, c || '', '']);
    eown.push(o);
  };
  let prev = ['in'];
  let prevLbl = '';
  const sides: string[] = [];
  let lastVal: Stage | null = null;
  st.forEach((s) => {
    if (s.type === 'agent' && s.side) {
      const anchor = prev[prev.length - 1];
      nodes.push([s.id, 'agent', s.agent || '—', s.role || 'Alongside']);
      own[s.id] = s.id;
      E(anchor, s.id, 'par', '', s.id);
      sides.push(s.id);
      return;
    }
    const into = (id: string, kind: NodeKind, label: string, role: string) => {
      nodes.push([id, kind, label, role]);
      own[id] = s.id;
      prev.forEach((p) => E(p, id, 'seq', prevLbl, s.id));
    };
    if (s.type === 'agent' || s.type === 'aggregate') {
      into(s.id, s.type, s.agent || '—', s.role || (s.type === 'aggregate' ? 'Combine results' : ''));
      if (s.del && s.del.agent) {
        const did = s.del.id || s.id + 'd';
        nodes.push([did, 'agent', s.del.agent, 'Delegated']);
        own[did] = s.id;
        E(s.id, did, 'delegate', s.del.when, s.id);
      }
      prev = [s.id];
      prevLbl = '';
    } else if (s.type === 'parallel') {
      const ids = (s.members || []).map((m, i) => {
        const id = m.id || s.id + '_' + i;
        nodes.push([id, 'agent', m.agent, m.role || 'In parallel']);
        own[id] = s.id;
        prev.forEach((p) => E(p, id, 'par', prevLbl, s.id));
        return id;
      });
      prev = ids.length ? ids : prev;
      prevLbl = '';
    } else if (s.type === 'route') {
      const rid = s.id;
      if (s.by) into(rid, 'agent', s.by, s.role || 'Routes the request');
      else into(rid, 'router', s.label || 'Route by condition', 'Conditional');
      const ids = (s.routes || []).map((b, i) => {
        const id = b.id || s.id + '_' + i;
        nodes.push([id, 'agent', b.agent || '—', b.role || b.cond || 'Branch ' + (i + 1)]);
        own[id] = s.id;
        E(rid, id, 'cond', b.cond || '', s.id);
        if (b.del && b.del.agent) {
          const did = b.del.id || id + 'd';
          nodes.push([did, 'agent', b.del.agent, 'Delegated']);
          own[did] = s.id;
          E(id, did, 'delegate', b.del.when, s.id);
        }
        return id;
      });
      prev = ids.length ? ids : [rid];
      prevLbl = '';
    } else if (s.type === 'validate') {
      into(s.id, 'review', s.label || 'Validation', 'Validation');
      prev = [s.id];
      prevLbl = 'passed';
      lastVal = s;
    } else if (s.type === 'review') {
      into(s.id, 'review', s.label || 'Human review', s.who || 'Human review');
      prev = [s.id];
      prevLbl = 'approved';
    }
  });
  nodes.push(['out', 'output', (io.out || [])[0] || 'Answer', (io.out || [])[1] || '']);
  own.out = '@output';
  prev.forEach((p) => E(p, 'out', 'seq', prevLbl, '@output'));
  sides.forEach((x) => E(x, 'out', 'par', '', x));
  const fb = cfg.fb || {};
  if (fb.node) {
    nodes.splice(nodes.length - 1, 0, ['fb', 'fallback', fb.label || 'Fallback', 'Fallback']);
    own.fb = '@fallback';
    const lv = lastVal as Stage | null;
    const viaVal = !!lv && fb.on !== 'A step fails or times out';
    const from = viaVal ? lv!.id : prev[prev.length - 1] === 'in' ? 'in' : prev[prev.length - 1];
    E(from, 'fb', 'fallback', viaVal ? 'failed' : 'step fails', '@fallback');
    E('fb', 'out', 'seq', '', '@fallback');
  }
  return { nodes, edges, own, eown };
}

/** Layered automatic layout (templates, imported structures and "Auto layout"). */
export function wfLayout(cfg: Pick<WfCfg, 'nodes' | 'edges'>): Record<string, [number, number]> {
  const N = cfg.nodes, E = cfg.edges;
  const lvl: Record<string, number> = {};
  N.forEach((n) => { lvl[n[0]] = 0; });
  for (let i = 0; i < N.length; i++)
    E.forEach(([a, b, k]) => {
      if (k !== 'delegate' && lvl[b] != null && lvl[a] != null && lvl[b] < lvl[a] + 1 && lvl[a] < N.length) lvl[b] = lvl[a] + 1;
    });
  E.filter((e) => e[2] === 'delegate').forEach(([a, b]) => { if (lvl[a] != null) lvl[b] = lvl[a]; });
  const out = N.find((n) => n[1] === 'output');
  if (out) {
    const mx = Math.max(...Object.values(lvl));
    lvl[out[0]] = mx + (N.some((n) => n[1] === 'fallback' && lvl[n[0]] === mx) ? 1 : 0);
  }
  const cols: Record<number, string[]> = {};
  N.forEach((n) => { (cols[lvl[n[0]]] = cols[lvl[n[0]]] || []).push(n[0]); });
  E.filter((e) => e[2] === 'delegate').forEach(([a, b]) => {
    const c = cols[lvl[a]];
    if (!c) return;
    const i = c.indexOf(b);
    if (i < 0) return;
    c.splice(i, 1);
    c.splice(c.indexOf(a) + 1, 0, b);
  });
  const maxR = Math.max(1, ...Object.values(cols).map((c) => c.length));
  const SX = 210, SY = 84;
  const P: Record<string, [number, number]> = {};
  Object.entries(cols).forEach(([l, ids]) => ids.forEach((id, i) => { P[id] = [24 + +l * SX, 24 + ((maxR - ids.length) * SY) / 2 + i * SY]; }));
  N.filter((n) => n[1] === 'fallback').forEach((n) => { if (cols[lvl[n[0]]].length === 1) P[n[0]][1] += SY; });
  return P;
}

/** Derive the orchestration pattern (`mode`) and failure summary (`fail`) from the graph. */
export function wfDerive<T extends Partial<WfCfg>>(cfg: T): T & { mode: string; fail: string } {
  const E = cfg.edges || [];
  const k: string[] = [];
  if (E.some((e) => e[2] === 'cond')) k.push('Conditional routing');
  if (E.some((e) => e[2] === 'par')) k.push('Parallel');
  if (E.some((e) => e[2] === 'delegate')) k.push('Delegation');
  if (!k.length || (k.length === 1 && k[0] === 'Delegation')) k.unshift('Sequential');
  cfg.mode = k.join(' · ');
  const fbN = (cfg.nodes || []).find((n) => n[1] === 'fallback');
  const p = fbN ? (cfg.np || {})[fbN[0]] || {} : null;
  cfg.fail = fbN ? (p!.on || 'A step fails') + ': ' + String(p!.action || 'Return a template answer').toLowerCase() : cfg.onErr || 'Stop and return an explanation';
  return cfg as T & { mode: string; fail: string };
}

/** Convert the stage model of earlier versions into the canvas graph (once). */
export function wfFromStages(cfg: WfCfg, entry?: string): WfCfg {
  if (!cfg || !cfg.stages) return cfg;
  const g = wfBuild(cfg, entry);
  cfg.nodes = g.nodes;
  cfg.edges = g.edges.map((e) => [e[0], e[1], e[2], e[3], ''] as WfEdge);
  const np: Record<string, NodeProps> = {};
  (cfg.stages || []).forEach((s0) => {
    if (s0.type === 'validate') np[s0.id] = { rt: 'validate', check: s0.check || 'Numbers match the source data', onFail: s0.onFail === 'stop' ? 'Stop and return an explanation' : 'Use the fallback' };
    if (s0.type === 'review') np[s0.id] = { rt: 'human', who: s0.who || 'Agent reviewers' };
  });
  const fb = cfg.fb || {};
  if (fb.node) np.fb = { on: fb.on || 'Validation fails or a step times out', action: fb.action || 'Return a template answer' };
  cfg.np = np;
  cfg.onErr = fb.node ? 'Use the fallback handler' : fb.action || 'Stop and return an explanation';
  cfg.pos = wfLayout(cfg);
  delete cfg.stages;
  delete cfg.fb;
  return wfDerive(cfg);
}

/** Build the graph from stages, keeping the stage model (older `wfSync`). */
export function wfSync(cfg: WfCfg, entrySub?: string): WfCfg {
  if (!cfg || !cfg.stages) return cfg;
  const g = wfBuild(cfg, entrySub);
  cfg.nodes = g.nodes;
  cfg.edges = g.edges;
  cfg.mode = wfPattern(cfg.stages);
  const fb = cfg.fb || {};
  cfg.fail = fb.action ? (fb.on || 'On failure') + ': ' + fb.action.toLowerCase() : cfg.fail || 'Stop and return an explanation';
  return cfg;
}

export function wfPattern(stages: Stage[] | undefined): string {
  const t = (stages || []).map((s) => s.type);
  const k: string[] = [];
  if (t.includes('route')) k.push('Conditional routing');
  if (t.includes('parallel')) k.push('Parallel');
  if ((stages || []).some((s) => s.del || (s.routes || []).some((b) => b.del))) k.push('Delegation');
  if (!k.length || (k.length === 1 && k[0] === 'Delegation')) k.unshift('Sequential');
  return k.join(' · ');
}

export interface TemplateOpts { agg?: string; router?: string; val?: string; review?: string; conds?: Record<string, string> }

/** Stages of a starting structure for a pattern. */
export function wfTemplate(pattern: string, agents: string[], o: TemplateOpts = {}): Stage[] {
  const A = (agents || []).filter(Boolean);
  const S: Stage[] = [];
  let n = 0;
  const id = (p: string) => p + ++n;
  if (pattern === 'Sequential') A.forEach((a) => S.push({ id: id('s'), type: 'agent', agent: a, role: '' }));
  else if (pattern === 'Parallel then aggregate') {
    const agg = o.agg && A.includes(o.agg) ? o.agg : A[A.length - 1];
    const par = A.filter((a) => a !== agg);
    S.push({ id: id('p'), type: 'parallel', members: par.map((a) => ({ agent: a })) });
    S.push({ id: id('g'), type: 'aggregate', agent: agg, role: 'Combine results' });
  } else if (pattern === 'Conditional routing') {
    const by = o.router && o.router !== 'Rule-based conditions' && A.includes(o.router) ? o.router : '';
    const br = A.filter((a) => a !== by);
    S.push({ id: id('r'), type: 'route', by, label: by ? '' : 'Route by condition', routes: br.map((a) => ({ agent: a, cond: '' })) });
    if (o.agg && o.agg !== 'None') S.push({ id: id('g'), type: 'aggregate', agent: o.agg, role: 'Combine results' });
  } else if (pattern === 'Supervisor with delegation') {
    const [sup, ...rest] = A;
    S.push({ id: id('s'), type: 'agent', agent: sup, role: 'Supervisor', del: rest[0] ? { agent: rest[0], when: 'needs specialist input' } : null });
    rest.slice(1).forEach((a) => S.push({ id: id('s'), type: 'agent', agent: a, role: '' }));
  }
  if (o.val && o.val !== 'None') S.push({ id: id('v'), type: 'validate', label: o.val, check: o.val });
  if (o.review && o.review !== 'None') S.push({ id: id('h'), type: 'review', label: 'Human review', who: o.review });
  return S;
}

/** One sentence describing a stage (used to compare stage-model versions). */
export function wfSay(s: Stage): string {
  const L = (x?: string) => x || '—';
  if (s.type === 'agent') return s.side ? L(s.agent) + ' runs alongside the previous stage; its output is added to the result' : L(s.agent) + ' runs' + (s.role ? ' · ' + s.role : '') + (s.del && s.del.agent ? '. Delegates to ' + s.del.agent + ' when ' + (s.del.when || 'needed') : '');
  if (s.type === 'parallel') return (s.members || []).map((m) => m.agent).join(', ') + ' run at the same time';
  if (s.type === 'aggregate') return L(s.agent) + ' combines the results of the previous stage';
  if (s.type === 'route') return (s.by ? s.by + ' decides' : 'Rules decide') + ' which agent handles the request: ' + (s.routes || []).map((b) => (b.cond ? '"' + b.cond + '"' : 'condition not set') + ' → ' + L(b.agent) + (b.del && b.del.agent ? ' (delegates to ' + b.del.agent + ' when ' + (b.del.when || 'needed') + ')' : '')).join('; ');
  if (s.type === 'validate') return (s.label || 'Validation') + ' checks that ' + String(s.check || 'the answer is valid').replace(/^./, (c) => c.toLowerCase()) + (s.onFail === 'stop' ? '; on failure the workflow stops' : '; on failure the fallback applies');
  if (s.type === 'review') return (s.who || 'A reviewer') + ' reviews the result before it is returned';
  return '';
}

/** Issues of a stage-model configuration (older editor). */
export function wfIssues(cfg: { stages?: Stage[] }, agentOk: (a: string) => string): string[] {
  const I: string[] = [];
  const st = cfg.stages || [];
  if (!st.length) I.push('Add at least one stage.');
  st.forEach((s, i) => {
    const n = 'Stage ' + (i + 1);
    if (s.type === 'route') {
      if ((s.routes || []).length < 2) I.push(n + ': conditional routing needs at least two paths.');
      (s.routes || []).forEach((b, j) => {
        if (!(b.cond || '').trim()) I.push(n + ': set the condition for the path to ' + (b.agent || 'path ' + (j + 1)) + '.');
        if (!b.agent) I.push(n + ': choose the agent for path ' + (j + 1) + '.');
      });
    }
    if (s.type === 'parallel' && (s.members || []).length < 2) I.push(n + ': parallel execution needs at least two agents.');
    ([s.agent, s.by, s.del && s.del.agent] as (string | undefined | null | false)[])
      .concat((s.members || []).map((m) => m.agent))
      .concat((s.routes || []).flatMap((b) => [b.agent, b.del && b.del.agent]))
      .filter((x): x is string => !!x)
      .forEach((a) => { const p = agentOk(a); if (p) I.push(n + ': ' + a + ' ' + p + '.'); });
    if ((s.type === 'agent' || s.type === 'aggregate') && !s.agent) I.push(n + ': choose the agent.');
  });
  return [...new Set(I)];
}

/** Structural checks shown in the designer; errors block publishing, warnings do not. */
export function wfCheck(cfg: Pick<WfCfg, 'nodes' | 'edges' | 'np'>, agentOk: (a: string) => string): Issue[] {
  const N = cfg.nodes || [], E = cfg.edges || [];
  const I: Issue[] = [];
  const nm = (id: string | undefined) => { const n = N.find((x) => x[0] === id); return n ? n[2] || 'Unnamed step' : String(id); };
  const ent = N.find((n) => n[1] === 'entry'), outN = N.find((n) => n[1] === 'output');
  const reach = (start: string | undefined, fwd: boolean) => {
    const R = new Set<string>(start ? [start] : []);
    let ch = true;
    while (ch) {
      ch = false;
      E.forEach(([a, b, k]) => {
        const [x, y] = fwd ? [a, b] : [b, a];
        if (R.has(x) && !R.has(y)) { R.add(y); ch = true; }
        if (!fwd && k === 'delegate' && R.has(a) && !R.has(b)) { R.add(b); ch = true; }
      });
    }
    return R;
  };
  const R1 = reach(ent && ent[0], true), R2 = reach(outN && outN[0], false);
  if (outN && !R1.has(outN[0])) I.push({ id: outN[0], sev: 'error', m: 'There is no path from the entry point to ' + nm(outN[0]) + '.' });
  N.forEach((n) => {
    const id = n[0];
    if (n[1] === 'entry' || n[1] === 'output') return;
    const p = (cfg.np || {})[id] || {};
    if (!R1.has(id)) I.push({ id, sev: n[1] === 'fallback' ? 'warn' : 'error', m: nm(id) + (n[1] === 'fallback' ? ' is never triggered: connect a failure path to it.' : ' is not connected to the entry point.') });
    else if (!R2.has(id)) I.push({ id, sev: 'error', m: nm(id) + ' has no path to ' + nm(outN && outN[0]) + '.' });
    if ((n[1] === 'agent' || n[1] === 'aggregate') && !n[2]) I.push({ id, sev: 'error', m: 'Choose the agent for this ' + (n[1] === 'aggregate' ? 'aggregator' : 'step') + '.' });
    if ((n[1] === 'agent' || n[1] === 'aggregate') && n[2]) { const pr = agentOk(n[2]); if (pr) I.push({ id, sev: 'error', m: n[2] + ' ' + pr + '.' }); }
    if (n[1] === 'router' && E.filter((e) => e[0] === id && e[2] === 'cond').length < 2) I.push({ id, sev: 'error', m: nm(id) + ' needs at least two conditional paths.' });
    if (n[1] === 'review' && p.rt !== 'human' && p.onFail !== 'Stop and return an explanation' && !E.some((e) => e[0] === id && e[2] === 'fallback')) I.push({ id, sev: 'warn', m: nm(id) + ' has no failure path to a fallback handler.' });
  });
  E.forEach((e, i) => {
    if ((e[2] === 'cond' || e[2] === 'delegate') && !(e[3] || '').trim()) I.push({ id: 'e:' + i, sev: 'error', m: 'Set the ' + (e[2] === 'cond' ? 'condition' : 'delegation condition') + ' for ' + nm(e[0]) + ' → ' + nm(e[1]) + '.' });
  });
  return I;
}

// ---------------------------------------------------------------- templates for new workflows
export function fromTemplate(entry: string, pat: string, agents: string[], o: TemplateOpts & { fb?: string } = {}): WfCfg {
  const c = {
    stages: wfTemplate(pat, agents, o),
    io: { in: ['Request', entry || 'Chat'], out: ['Answer', ''] },
    fb: o.fb
      ? { on: 'Validation fails or a step times out', action: o.fb, label: o.fb === 'Return a template answer' ? 'Template answer' : 'Fallback handler', node: o.fb === 'Return a template answer' || o.fb === 'Hand over to a human reviewer' }
      : { node: false, action: 'Stop and return an explanation' },
    limits: { dur: '60 s', steps: '12' },
    map: [],
    nodes: [],
    edges: [],
    pos: {},
    np: {},
    mode: '',
    fail: '',
    onErr: '',
  } as WfCfg;
  if (pat === 'Conditional routing' && o.conds) c.stages!.filter((s0) => s0.type === 'route').forEach((s0) => (s0.routes || []).forEach((b) => { b.cond = (o.conds![b.agent || ''] || '').trim(); }));
  return wfFromStages(c, entry);
}

export function blankG(entry: string): WfCfg {
  return wfDerive({
    nodes: [['in', 'entry', 'Request', entry || 'Chat'], ['out', 'output', 'Answer', '']],
    edges: [],
    pos: { in: [24, 160], out: [600, 160] },
    np: {},
    io: { in: ['Request', entry || 'Chat'], out: ['Answer', ''] },
    limits: { dur: '60 s', steps: '12' },
    map: [],
    onErr: 'Stop and return an explanation',
    mode: '',
    fail: '',
  } as WfCfg);
}

export const agentsInG = (cfg: Pick<WfCfg, 'nodes'>) => [...new Set((cfg.nodes || []).filter((n) => (n[1] === 'agent' || n[1] === 'aggregate') && n[2]).map((n) => n[2]))];

export const nodeL = (c: Pick<WfCfg, 'nodes'>, id: string) => {
  const n = c.nodes.find((x) => x[0] === id);
  return n ? n[2] || (n[1] === 'aggregate' ? 'Aggregator' : 'Step') : id;
};

// ---------------------------------------------------------------- designer operations (mutate the working copy)
export const newId = (cfg: Pick<WfCfg, 'nodes'>, p: string) => {
  const used = new Set(cfg.nodes.map((n) => n[0]));
  let i = 1;
  while (used.has(p + i)) i++;
  return p + i;
};
export const snap = (v: number) => Math.max(8, Math.round(v / 8) * 8);

/** Add an agent ('agent:<name>') or component ('comp:router|aggregate|validate|human|fallback'); returns the new id. */
export function addNode(c: WfCfg, key: string, at?: [number, number]): string {
  const i0 = key.indexOf(':');
  const t = key.slice(0, i0), ref = key.slice(i0 + 1);
  const free = (): [number, number] => {
    const ys = c.nodes.map((m) => (c.pos[m[0]] || [0, 0])[1]);
    return [Math.max(...c.nodes.map((m) => (c.pos[m[0]] || [0, 0])[0])) - 200, Math.max(...ys) + 84];
  };
  const p: [number, number] = at ? [snap(at[0] - NW / 2), snap(at[1] - NH / 2)] : free();
  let id: string;
  if (t === 'agent') { id = newId(c, 'a'); c.nodes.push([id, 'agent', ref, '']); }
  else if (ref === 'router') { id = newId(c, 'r'); c.nodes.push([id, 'router', 'Router', 'Conditional']); }
  else if (ref === 'aggregate') { id = newId(c, 'g'); c.nodes.push([id, 'aggregate', '', 'Combine results']); }
  else if (ref === 'validate') { id = newId(c, 'v'); c.nodes.push([id, 'review', CHKL[CHECKS[0]], 'Validation']); c.np[id] = { rt: 'validate', check: CHECKS[0], onFail: 'Use the fallback' }; }
  else if (ref === 'human') { id = newId(c, 'h'); c.nodes.push([id, 'review', 'Human review', 'Agent reviewers']); c.np[id] = { rt: 'human', who: 'Agent reviewers' }; }
  else { id = newId(c, 'f'); c.nodes.push([id, 'fallback', 'Template answer', 'Fallback']); c.np[id] = { on: 'Validation fails or a step times out', action: FBA[0] }; }
  // keep the output last
  const o0 = c.nodes.findIndex((m) => m[1] === 'output');
  if (o0 >= 0 && o0 < c.nodes.length - 1) { const nn = c.nodes.pop()!; c.nodes.splice(o0, 0, nn); }
  c.pos[id] = p;
  return id;
}

export type ConnectResult = { err: string } | { existing: number } | { added: number } | { none: true };

/** Check a connection a → b without changing anything. */
export function canConnect(c: WfCfg, a: string, b: string): ConnectResult {
  const A0 = c.nodes.find((n) => n[0] === a), B0 = c.nodes.find((n) => n[0] === b);
  if (!A0 || !B0 || a === b) return { none: true };
  if (B0[1] === 'entry' || A0[1] === 'output') return { err: 'Connections start at the entry point and end at the output.' };
  const ex = c.edges.findIndex((e) => e[0] === a && e[1] === b);
  if (ex >= 0) return { existing: ex };
  return { added: c.edges.length };
}

/** Connect a → b; the edge kind follows from the nodes (router → conditional, fallback → failure path, second output → parallel). */
export function connectNodes(c: WfCfg, a: string, b: string): ConnectResult {
  const r = canConnect(c, a, b);
  if (!('added' in r)) return r;
  const A0 = c.nodes.find((n) => n[0] === a)!, B0 = c.nodes.find((n) => n[0] === b)!;
  const outs = c.edges.filter((e) => e[0] === a);
  let k: EdgeKind = 'seq', cond = '';
  const human = ((c.np || {})[a] || {}).rt === 'human';
  if (A0[1] === 'router') k = 'cond';
  else if (B0[1] === 'fallback') { k = 'fallback'; cond = A0[1] === 'review' ? 'failed' : 'step fails'; }
  else if (A0[1] === 'review' && !human) cond = outs.some((e) => e[2] === 'seq') ? '' : 'passed';
  else if (outs.some((e) => e[2] === 'seq' || e[2] === 'par')) { k = 'par'; c.edges.forEach((e) => { if (e[0] === a && e[2] === 'seq') e[2] = 'par'; }); }
  if (A0[1] === 'review' && human) cond = 'approved';
  c.edges.push([a, b, k, cond, '']);
  return { added: c.edges.length - 1 };
}

/** Remove the selected node ('n:<id>') or connection ('e:<i>'); returns an error message when not allowed. */
export function removeSel(c: WfCfg, sel: string): string {
  if (sel.startsWith('e:')) { c.edges.splice(+sel.slice(2), 1); return ''; }
  const id = sel.slice(2);
  const nd = c.nodes.find((n) => n[0] === id);
  if (!nd || nd[1] === 'entry' || nd[1] === 'output') return 'The entry point and the output are part of every workflow.';
  c.nodes = c.nodes.filter((m) => m[0] !== id);
  c.edges = c.edges.filter((e) => e[0] !== id && e[1] !== id);
  delete c.pos[id];
  delete c.np[id];
  return '';
}

/** Duplicate a step; returns the new id or '' when it cannot be duplicated. */
export function dupNode(c: WfCfg, id: string): string {
  const nd = c.nodes.find((n) => n[0] === id);
  if (!nd || nd[1] === 'entry' || nd[1] === 'output') return '';
  const nid = newId(c, id.replace(/\d+$/, '') || 'n');
  c.nodes.splice(c.nodes.length - 1, 0, [nid, nd[1], nd[2], nd[3]]);
  const p = c.pos[id] || [0, 0];
  c.pos[nid] = [p[0] + 24, p[1] + 70];
  if (c.np[id]) c.np[nid] = clone(c.np[id]);
  return nid;
}

/** Change an edge's kind (by label from ETY); switching to Parallel turns sibling sequential edges parallel too. */
export function setEdgeKind(c: WfCfg, i: number, label: string) {
  const e = c.edges[i];
  if (!e) return;
  e[2] = (ETY.find((t) => t[1] === label) || ETY[0])[0];
  if (label === 'Parallel') c.edges.forEach((e2) => { if (e2[0] === e[0] && e2[2] === 'seq') e2[2] = 'par'; });
}

// ---------------------------------------------------------------- simulated execution
export type PathSt = 'ok' | 'bad' | 'skip';
export interface AgentSim { st: 'Succeeded' | 'Failed'; err: string; tools: number }
export interface WfSimResult {
  id: string;
  kind: 'workflow';
  w: string;
  ver: string;
  q: string;
  lang: string;
  st: string;
  err: string;
  answer: string;
  /** [label, kind, status, note, node id] */
  steps: [string, string, string, string, string?][];
  path: Record<string, PathSt>;
}

export const isAr = (q: string) => /[؀-ۿ]/.test(q);

/** Which conditional branch a request takes (prototype `routeOf` / `wfRoute`). */
export function wfRoute(cfg: Pick<WfCfg, 'nodes' | 'edges'>, q: string, wfId?: string): string | null {
  const cE = cfg.edges.filter((e) => e[2] === 'cond');
  if (!cE.length) return null;
  if (wfId === 'ask_ai' && cfg.nodes.some((n) => n[0] === 'num')) return /strategy|document|article|says|plan/i.test(q) ? 'art' : /oxford|outlook|compare.*(oman|gcc)|عُمان|global/i.test(q) ? 'oxf' : 'num';
  const ql = q.toLowerCase();
  const hit = cE.find((e) => (e[3] || '').toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter((t) => t.length > 3).some((t) => ql.includes(t)));
  return (hit || cE[0])[1];
}

/**
 * Walk the graph for a request. `agent(name, q)` simulates one agent step
 * (null when the agent does not exist); disabled agents fail.
 */
export function simWf(cfg: WfCfg, wfId: string, ver: string, q: string, agent: (name: string, q: string) => AgentSim | null, wfDisabled: boolean, id = 'T-' + String(Date.now()).slice(-5)): WfSimResult {
  const N = cfg.nodes, E = cfg.edges;
  const path: Record<string, PathSt> = {};
  const steps: WfSimResult['steps'] = [];
  const route = wfRoute(cfg, q, wfId);
  const branchNodes = E.filter((e) => e[2] === 'cond').map((e) => e[1]);
  let failed = false;
  const res: WfSimResult = { id, kind: 'workflow', w: wfId, ver, q, lang: isAr(q) ? 'Arabic' : 'English', st: 'Succeeded', err: '', answer: '', steps, path };
  const walk = (nid: string, seen: Set<string>) => {
    if (seen.has(nid)) return;
    seen.add(nid);
    const n = N.find((x) => x[0] === nid);
    if (!n) return;
    if (branchNodes.includes(nid) && route && nid !== route) { path[nid] = 'skip'; return; }
    let s0: PathSt = 'ok', note = '';
    if (n[1] === 'agent') {
      const r = agent(n[2], q);
      if (!r) { s0 = 'bad'; note = 'Agent disabled'; }
      else if (r.st === 'Failed') { s0 = 'bad'; note = r.err; }
      else note = r.tools + ' tool calls';
    }
    if (n[1] === 'fallback') {
      if (!failed) { path[nid] = 'skip'; return; }
      note = 'Template answer returned';
    }
    if (n[1] === 'review' && failed) { s0 = 'bad'; note = 'Verification failed'; }
    if (n[1] === 'review' && !failed) note = n[2] === 'Human review' ? 'Reviewed by a person (simulated)' : 'Numbers verified';
    path[nid] = s0;
    steps.push([n[2] || KL[n[1]], n[1], s0 === 'ok' ? 'Succeeded' : 'Failed', note, nid]);
    if (s0 === 'bad' && n[1] === 'agent') failed = true;
    E.filter((e) => e[0] === nid).forEach((e) => {
      if (e[2] === 'fallback' && !failed) return;
      if (e[2] === 'fallback' && failed) { walk(e[1], seen); return; }
      if (e[2] === 'delegate') { if (s0 === 'bad') walk(e[1], seen); else path[e[1]] = path[e[1]] || 'skip'; return; }
      if (n[1] === 'review' && failed) return;
      walk(e[1], seen);
    });
  };
  if (N.length) walk(N[0][0], new Set());
  N.forEach((n) => { if (!path[n[0]]) path[n[0]] = 'skip'; });
  if (wfDisabled) {
    N.forEach((n) => { path[n[0]] = n[1] === 'entry' ? 'bad' : 'skip'; });
    res.st = 'Failed';
    res.err = 'Workflow is disabled (emergency)';
    res.steps = [['Request', 'entry', 'Failed', 'Rejected: workflow disabled']];
    return res;
  }
  if (failed) {
    res.st = N.some((n) => n[1] === 'fallback' && path[n[0]] === 'ok') ? 'Succeeded with fallback' : 'Failed';
    res.err = steps.filter((x) => x[2] === 'Failed').map((x) => x[0] + ': ' + x[3]).join('; ');
    res.answer = res.st === 'Failed' ? '' : 'Template answer: no official data is available for this request.';
  } else res.answer = isAr(q) ? 'الإجابة النهائية مع المصادر [1][2].' : "Final answer composed from the agents' results with citations [1][2].";
  return res;
}

/** Nodes in the order they ran (not skipped). */
export const runOrder = (path: Record<string, PathSt> | undefined) => Object.keys(path || {}).filter((n) => (path || {})[n] !== 'skip');

// ---------------------------------------------------------------- configuration diff (publish dialog, compare)
export interface DiffItem { a: string; b: string; c: string }
const LBL: Record<string, string> = { gov: 'Governance & oversight', ent: 'Business Entities context', tset: 'Tool assignments', instr: 'System instructions', model: 'Primary model', fb: 'Fallback and error handling', multi: 'Multi-model routing', tools: 'Max tool calls', dur: 'Max duration', tokens: 'Max output tokens', retries: 'Retries', fail: 'Failure handling', guards: 'Guardrails', mode: 'Orchestration', limits: 'Execution limits', nodes: 'Steps', edges: 'Routing', map: 'Input/output mappings', io: 'Start and finish', onErr: 'Without a fallback handler' };

function diffOf0(a: Record<string, unknown>, b: Record<string, unknown>): DiffItem[] {
  const keys = [...new Set(Object.keys(a).concat(Object.keys(b)))];
  return keys
    .map((k) => [LBL[k] || k, JSON.stringify(a[k]), JSON.stringify(b[k])] as [string, string | undefined, string | undefined])
    .filter((x) => x[1] !== x[2])
    .map(([k, x, y]) => ({ a: k, b: (x || '—').replace(/^"|"$/g, '').slice(0, 90), c: '→ ' + (y || '—').replace(/^"|"$/g, '').slice(0, 90) }));
}

export function diffOf(a: WfCfg | null | undefined, b: WfCfg | null | undefined): DiffItem[] {
  const A0 = (a || {}) as WfCfg, B0 = (b || {}) as WfCfg;
  if (A0.nodes && B0.nodes && A0.edges && B0.edges) {
    const lb = (c0: WfCfg, id: string) => { const n = c0.nodes.find((x) => x[0] === id); return n ? n[2] || KL[n[1]] : id; };
    const out0: DiffItem[] = [];
    B0.nodes.forEach((n) => {
      const o0 = A0.nodes.find((x) => x[0] === n[0]);
      if (!o0) out0.push({ a: 'Step added', b: (n[2] || KL[n[1]]) + ' · ' + KL[n[1]], c: '' });
      else if (o0[2] !== n[2] || o0[3] !== n[3]) out0.push({ a: 'Step changed', b: (o0[2] || KL[o0[1]]) + (o0[3] ? ' · ' + o0[3] : ''), c: '→ ' + (n[2] || KL[n[1]]) + (n[3] ? ' · ' + n[3] : '') });
    });
    A0.nodes.forEach((n) => { if (!B0.nodes.some((x) => x[0] === n[0])) out0.push({ a: 'Step removed', b: (n[2] || KL[n[1]]) + ' · ' + KL[n[1]], c: '' }); });
    const ek = (e: WfEdge) => e[0] + '>' + e[1];
    B0.edges.forEach((e) => {
      const o0 = A0.edges.find((x) => ek(x) === ek(e));
      const L = (c0: WfCfg) => lb(c0, e[0]) + ' → ' + lb(c0, e[1]);
      if (!o0) out0.push({ a: 'Connection added', b: L(B0) + ' · ' + EL[e[2]] + (e[3] ? ' · ' + e[3] : ''), c: '' });
      else if (o0[2] !== e[2] || o0[3] !== e[3] || (o0[4] || '') !== (e[4] || '')) out0.push({ a: 'Connection changed', b: L(B0) + ' · ' + EL[o0[2]] + (o0[3] ? ' · ' + o0[3] : ''), c: '→ ' + EL[e[2]] + (e[3] ? ' · ' + e[3] : '') + (e[4] ? ' · passes ' + e[4] : '') });
    });
    A0.edges.forEach((e) => { if (!B0.edges.some((x) => ek(x) === ek(e))) out0.push({ a: 'Connection removed', b: lb(A0, e[0]) + ' → ' + lb(A0, e[1]), c: '' }); });
    if (JSON.stringify(A0.np || {}) !== JSON.stringify(B0.np || {})) out0.push({ a: 'Step settings', b: 'Changed', c: '' });
    const strip = (x: WfCfg) => { const { nodes: _n, edges: _e, pos: _p, np: _np, mode: _m, fail: _f, map: _map, ...rest } = x; return rest as Record<string, unknown>; };
    const rest = diffOf0(strip(A0), strip(B0));
    return (A0.mode !== B0.mode ? [{ a: 'Orchestration pattern', b: A0.mode || '—', c: '→ ' + (B0.mode || '—') }] : []).concat(out0, rest);
  }
  return diffOf0(A0 as unknown as Record<string, unknown>, B0 as unknown as Record<string, unknown>);
}
