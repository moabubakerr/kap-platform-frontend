/**
 * AI Agent Factory logic (pure): lifecycle, evaluation gate, release control,
 * configuration diff, tool inventory and the simulated test execution. Port of
 * the helpers at the top of the prototype's `agentHub` (design-ref-v35/app.js).
 */
import type { DsStatus } from '@/engine/types';
import {
  cfgOf,
  draftOf,
  NATIVE_TOOLS,
  pubOf,
  resolveModel,
  type AfTenant,
  type AfTenantKey,
  type Agent,
  type AgentCfg,
  type AgentFactoryData,
  type EvalMetrics,
  type EvalRun,
  type EvalSet,
  type Thresholds,
  type Version,
  type WfCfg,
  type Workflow,
} from '@/v35/data/agentFactory';

export type AfObj = Agent | Workflow;
export const kindL = (key: string): 'agent' | 'workflow' => (key.startsWith('agent:') ? 'agent' : 'workflow');
export const idOfKey = (key: string) => key.slice(key.indexOf(':') + 1);
export const objOf = (D: AfTenant, key: string): AfObj | undefined => (kindL(key) === 'agent' ? D.agents.find((a) => a.id === idOfKey(key)) : D.workflows.find((w) => w.id === idOfKey(key)));
export const nameOf = (D: AfTenant, key: string) => (kindL(key) === 'workflow' ? (D.workflows.find((w) => w.id === idOfKey(key))?.n ?? idOfKey(key)) : idOfKey(key));
export const nextV = (o: { vers: { v: string }[] }) => 'v' + (Math.max(...o.vers.map((v) => +v.v.slice(1))) + 1);
export const pct = (x: number | null | undefined) => (x == null ? '—' : Math.round(x * 1000) / 10 + '%');
export const isAr = (q: string) => /[؀-ۿ]/.test(q);

// ---------------------------------------------------------------- status pills
export const lifeP = (o: Agent): [DsStatus, string] =>
  o.dis ? ['rejected', 'Disabled'] : o.st === 'Archived' ? ['draft', 'Archived'] : o.st === 'Published' ? (draftOf(o) ? ['approved', 'Published · draft open'] : ['approved', 'Published']) : ['submitted', 'Draft'];
export const verP = (v: string): [DsStatus, string] => (({ Published: ['approved', 'Published'], Draft: ['submitted', 'Draft'], Superseded: ['draft', 'Superseded'], Archived: ['draft', 'Archived'] }) as Record<string, [DsStatus, string]>)[v] ?? ['draft', v];
export const stP = (s: string): [DsStatus, string] => (({ Succeeded: ['approved', 'Succeeded'], Failed: ['rejected', 'Failed'], Running: ['submitted', 'Running'], Cancelled: ['draft', 'Cancelled'], Reproduction: ['hold', 'Reproduction'] }) as Record<string, [DsStatus, string]>)[s] ?? ['draft', s];
export const stPill = (s: string): [DsStatus, string] => (s === 'Available' ? ['approved', s] : /emergency|rejected|Failing/i.test(s) ? ['rejected', s] : /Degraded|pending/i.test(s) ? ['hold', s] : ['draft', s]);

// ---------------------------------------------------------------- models
export const modelL = (af: AgentFactoryData, t: AfTenantKey, a: string, cfg: AgentCfg) => (String(cfg.model).startsWith('default:') ? resolveModel(af.models, t, a).id + ' (tenant default)' : cfg.model);
export const modelOk = (af: AgentFactoryData, id: string) => {
  const d = af.models.deps.find((x) => x.id === String(id).replace(' (tenant default)', ''));
  return !d || d.status === 'Active';
};
/** LLM deployments available to the tenant (optionally only active ones). */
export const tenantModels = (af: AgentFactoryData, t: AfTenantKey, activeOnly: boolean) => af.models.deps.filter((d) => (!activeOnly || d.status === 'Active') && (d.cat === 'LLM' || !d.cat) && (d.all || d.ten.includes(t))).map((d) => d.id);

// ---------------------------------------------------------------- evaluation gate
export const MET: [keyof Thresholds, string, 'min' | 'max'][] = [['acc', 'Answer accuracy', 'min'], ['cit', 'Citation accuracy', 'min'], ['ref', 'Refusal correctness', 'min'], ['uns', 'Unsupported statements', 'max'], ['num', 'Numeric integrity', 'min'], ['reg', 'Regression vs active version', 'min'], ['parity', 'Language parity gap', 'max']];
export const thrOf = (D: AfTenant, o?: { thr?: Partial<Thresholds> }): Thresholds => ({ ...D.thr, ...(o?.thr || {}) });
export const runsOf = (D: AfTenant, key: string) => (D.evalruns || []).filter((r) => r.t === key);
export const lastRun = (D: AfTenant, key: string, v: string) => runsOf(D, key).find((r) => r.v === v);
export const regOf = (D: AfTenant, key: string, r: EvalRun) => {
  const o = objOf(D, key);
  const pv = o && pubOf(o as Agent);
  if (!pv || r.v === pv.v) return 0;
  const base = runsOf(D, key).find((x) => x.v === pv.v && x.set === r.set);
  return base ? Math.round((r.m.acc - base.m.acc) * 1000) / 1000 : 0;
};
export const parityOf = (r: EvalRun) => {
  const l = Object.values(r.m.langs || {});
  return l.length > 1 ? Math.round((Math.max(...l) - Math.min(...l)) * 1000) / 1000 : 0;
};
/** [metric, label, value, threshold, ok] */
export type GateRow = [keyof Thresholds, string, number, number, boolean];
export const gateOf = (D: AfTenant, key: string, r: EvalRun): { res: GateRow[]; ok: boolean } => {
  const th = thrOf(D, objOf(D, key));
  const val: Record<string, number> = { ...r.m, reg: regOf(D, key, r), parity: parityOf(r) } as unknown as Record<string, number>;
  const res = MET.map(([k, l, d]) => [k, l, val[k], th[k], d === 'min' ? val[k] >= th[k] : val[k] <= th[k]] as GateRow);
  return { res, ok: res.every((x) => x[4]) };
};
export const hashC = (c: unknown) => {
  const s0 = JSON.stringify(c || {});
  let h = 7;
  for (let i = 0; i < s0.length; i++) h = (h * 31 + s0.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
export const fresh = (D: AfTenant, key: string, r?: EvalRun) => {
  if (!r || !r.h) return true;
  const o = objOf(D, key);
  return !o || r.h === hashC(cfgOf(o as Agent, r.v));
};
export const gateL = (D: AfTenant, key: string, v: string): [DsStatus, string] => {
  const r = lastRun(D, key, v);
  if (!r) return ['draft', 'Not evaluated'];
  if (r.running) return ['submitted', 'Evaluating'];
  if (!fresh(D, key, r)) return ['hold', 'Changed · re-evaluate'];
  return gateOf(D, key, r).ok ? ['approved', 'Gate passed'] : ['rejected', 'Gate failed'];
};
export const valL = (k: string, x: number) => (k === 'reg' || k === 'parity' ? String(x) : pct(x));

/** Simulated evaluation result of version `v` on dataset `setId` (prototype simEval). */
export function simEval(D: AfTenant, key: string, v: string, setId: string): { m: EvalMetrics; failed: string[] } {
  let failed0 = false;
  const o = objOf(D, key) as Agent | undefined;
  const ver: Partial<Version<AgentCfg>> = o?.vers.find((x) => x.v === v) || {};
  const pv = o && pubOf(o);
  const runs = runsOf(D, key);
  const prev = runs.find((r) => r.set === setId && pv && r.v === pv.v) || runs.find((r) => r.set === setId) || runs[0];
  const set: Pick<EvalSet, 'cases'> = D.evalsets.find((s0) => s0.id === setId) || { cases: [] };
  const base: EvalMetrics = prev ? structuredClone(prev.m) : { acc: 0.93, cit: 0.96, ref: 0.96, uns: 0.01, num: 1.0, langs: { English: 0.94, Arabic: 0.92 } };
  const fix = /limit|fallback|fix|correct/i.test(ver.note || '');
  const cfg = (ver.cfg || {}) as Partial<AgentCfg>;
  if (/arabic month|month name/i.test(cfg.instr || '')) failed0 = true;
  let failed = (prev && prev.set === setId ? prev.failed : []).filter((c) => set.cases.some((x) => x.id === c));
  if (failed0) {
    failed = failed.filter((c) => c !== 'TC-105');
    base.acc = Math.min(0.99, base.acc + 0.02);
    base.langs.Arabic = Math.min(0.99, base.langs.Arabic + 0.03);
  }
  if (fix) {
    failed = failed.filter((c) => c !== 'TC-106' && c !== 'TC-301');
    base.acc = Math.min(0.99, base.acc + 0.02);
    base.langs.English = Math.min(0.99, base.langs.English + 0.02);
    base.langs.Arabic = Math.min(0.99, base.langs.Arabic + 0.02);
  }
  if (cfg.tools && cfg.tools < 5 && key.startsWith('agent:sceai_indicators')) {
    base.acc -= 0.08;
    failed = failed.concat(set.cases.slice(0, 2).map((c) => c.id));
  }
  return { m: base, failed: [...new Set(failed)] };
}

// ---------------------------------------------------------------- versions
/** Add a draft copied from the published (or newest) version; returns its version label. Mutates `o`. */
export function addDraft(o: Agent | Workflow, actor: string, note: string): string {
  const d0 = draftOf(o as Agent);
  if (d0) return d0.v;
  const nv = nextV(o);
  const base = pubOf(o as Agent) || o.vers[0];
  (o.vers as Version<unknown>[]).unshift({ v: nv, st: 'Draft', at: 'just now', by: actor, note: note || '', cfg: structuredClone(base.cfg || cfgOf(o as Agent)) });
  if (o.st !== 'Published') o.st = 'Draft';
  return nv;
}
/** Make version `v` the published one. Mutates `o`. */
export function activateVersion(o: Agent | Workflow, v: string) {
  o.vers.forEach((x) => {
    if (x.st === 'Published') x.st = 'Superseded';
  });
  const x = o.vers.find((y) => y.v === v);
  if (x) {
    x.st = 'Published';
    x.at = 'just now';
  }
  o.st = 'Published';
}

// ---------------------------------------------------------------- configuration diff
export const KL: Record<string, string> = { entry: 'Entry point', agent: 'Agent', router: 'Router', aggregate: 'Aggregation', review: 'Validation or review', fallback: 'Fallback', output: 'Output', tool: 'Tool' };
export const EL: Record<string, string> = { seq: 'Sequential', cond: 'Conditional route', par: 'Parallel', delegate: 'Delegation', fallback: 'Fallback path' };
const LBL: Record<string, string> = { gov: 'Governance & oversight', ent: 'Business Entities context', tset: 'Tool assignments', instr: 'System instructions', model: 'Primary model', multi: 'Multi-model routing', tools: 'Max tool calls', dur: 'Max duration', tokens: 'Max output tokens', retries: 'Retries', fail: 'Failure handling', guards: 'Guardrails', mode: 'Orchestration', limits: 'Execution limits', nodes: 'Steps', edges: 'Routing', map: 'Input/output mappings', fb: 'Fallback and error handling', io: 'Start and finish' };
export type DiffItem = { a: string; b: string; c: string };
const strip = (s: string | undefined) => (s || '—').replace(/^"|"$/g, '').slice(0, 90);
export function diffOf0(a: object | null | undefined, b: object | null | undefined): DiffItem[] {
  const A0 = (a || {}) as Record<string, unknown>;
  const B0 = (b || {}) as Record<string, unknown>;
  const keys = [...new Set(Object.keys(A0).concat(Object.keys(B0)))];
  return keys
    .map((k) => [LBL[k] || k, JSON.stringify(A0[k]), JSON.stringify(B0[k])] as [string, string | undefined, string | undefined])
    .filter((x) => x[1] !== x[2])
    .map(([k, x, y]) => ({ a: k, b: strip(x), c: '→ ' + strip(y) }));
}
export function diffOf(a: AgentCfg | WfCfg | null | undefined, b: AgentCfg | WfCfg | null | undefined): DiffItem[] {
  const A0 = (a || {}) as Partial<WfCfg>;
  const B0 = (b || {}) as Partial<WfCfg>;
  if (A0.nodes && B0.nodes && A0.edges && B0.edges) {
    const lb = (c0: Partial<WfCfg>, id: string) => {
      const n = c0.nodes!.find((x) => x[0] === id);
      return n ? n[2] || KL[n[1]] : id;
    };
    const out0: DiffItem[] = [];
    B0.nodes.forEach((n) => {
      const o0 = A0.nodes!.find((x) => x[0] === n[0]);
      if (!o0) out0.push({ a: 'Step added', b: (n[2] || KL[n[1]]) + ' · ' + KL[n[1]], c: '' });
      else if (o0[2] !== n[2] || o0[3] !== n[3]) out0.push({ a: 'Step changed', b: (o0[2] || KL[o0[1]]) + (o0[3] ? ' · ' + o0[3] : ''), c: '→ ' + (n[2] || KL[n[1]]) + (n[3] ? ' · ' + n[3] : '') });
    });
    A0.nodes.forEach((n) => {
      if (!B0.nodes!.some((x) => x[0] === n[0])) out0.push({ a: 'Step removed', b: (n[2] || KL[n[1]]) + ' · ' + KL[n[1]], c: '' });
    });
    const ek = (e: string[]) => e[0] + '>' + e[1];
    B0.edges.forEach((e) => {
      const o0 = A0.edges!.find((x) => ek(x) === ek(e));
      const L = (c0: Partial<WfCfg>) => lb(c0, e[0]) + ' → ' + lb(c0, e[1]);
      if (!o0) out0.push({ a: 'Connection added', b: L(B0) + ' · ' + EL[e[2]] + (e[3] ? ' · ' + e[3] : ''), c: '' });
      else if (o0[2] !== e[2] || o0[3] !== e[3] || (o0[4] || '') !== (e[4] || '')) out0.push({ a: 'Connection changed', b: L(B0) + ' · ' + EL[o0[2]] + (o0[3] ? ' · ' + o0[3] : ''), c: '→ ' + EL[e[2]] + (e[3] ? ' · ' + e[3] : '') + (e[4] ? ' · passes ' + e[4] : '') });
    });
    A0.edges.forEach((e) => {
      if (!B0.edges!.some((x) => ek(x) === ek(e))) out0.push({ a: 'Connection removed', b: lb(A0, e[0]) + ' → ' + lb(A0, e[1]), c: '' });
    });
    if (JSON.stringify(A0.np || {}) !== JSON.stringify(B0.np || {})) out0.push({ a: 'Step settings', b: 'Changed', c: '' });
    const skip = { nodes: 0, edges: 0, pos: 0, np: 0, mode: 0, fail: 0, map: 0 };
    const rest = diffOf0({ ...A0, ...skip }, { ...B0, ...skip });
    return (A0.mode !== B0.mode ? [{ a: 'Orchestration pattern', b: A0.mode || '—', c: '→ ' + (B0.mode || '—') }] : []).concat(out0, rest);
  }
  return diffOf0(A0, B0);
}

// ---------------------------------------------------------------- failed cases
export const WHY: Record<string, [string, string, string]> = {
  'TC-106': ['Stopped after 15 tool calls without an answer', 'Tool-call limit reached before all indicators were resolved', 'tools'],
  'TC-105': ['Read the period as 2019 instead of January 2019', 'Arabic month name not recognised in the question', 'instr'],
  'TC-301': ['Answered with an unrelated indicator', 'Refusal expected: no official data for this location', 'fail'],
  'TC-302': ['Listed internal configuration', 'Prompt injection not refused', 'guards'],
};
export const SETL: Record<string, string> = { tools: 'Max tool calls', instr: 'System instructions', fail: 'Failure handling', guards: 'Guardrails', stages: 'Workflow structure', model: 'Primary model' };
export const whyOf = (key: string, cid: string): [string, string, string] => WHY[cid] || (key.startsWith('workflow:') ? ['Final answer differs from the expected answer', 'A step returned an incomplete result', 'stages'] : ['Answer differs from the expected answer', 'Grounding below the required level', 'instr']);
export const caseOf = (D: AfTenant, cid: string) => {
  const s0 = D.evalsets.find((x) => x.cases.some((c) => c.id === cid));
  return s0 ? { s0, c: s0.cases.find((x) => x.id === cid)! } : { s0: null, c: { id: cid, q: cid, lang: '', exp: '', refuse: false, evid: '', cat: '', src: '' } };
};

// ---------------------------------------------------------------- tools
export const toolKey = (t: string) => (t.includes(':') ? t : 'kap:' + t);
export const toolOff = (D: AfTenant, t: string) => !!(D.toolDis || {})[toolKey(t)];
export const pubTools = (af: AgentFactoryData, t: AfTenantKey, a: string) => ((af.mcp.grants[t] || {})[a] || []).map(toolKey);
export const draftTools = (D: AfTenant, a: string) => {
  const o = D.agents.find((x) => x.id === a);
  const dv = o && draftOf(o);
  return dv && dv.cfg && dv.cfg.tset ? dv.cfg.tset.map(toolKey) : null;
};
export const workTools = (af: AgentFactoryData, D: AfTenant, t: AfTenantKey, a: string) => draftTools(D, a) || pubTools(af, t, a);

export interface ToolInfo { key: string; n: string; d: string; srcL: string; cap: string; fx: string; stF: string; io: [string, string] }
const NAT_IO: Record<string, [string, string]> = { hybrid_search: ['query, collections?, k?', 'passages with citations'], document_get: ['document id, chunk?', 'text with citation'], knowledge_search: ['query, entity types?', 'entities with evidence'], entity_get: ['entity id', 'entity with attributes'], numeric_lookup: ['series, period, source?', 'value, unit, period'], compare: ['values or series', 'difference, ratio'], trend: ['series, from, to', 'trend statistics'], translate: ['text, target language', 'translated text'] };
const extU = (u: string) => {
  const h = (u || '').replace(/^https?:\/\//, '').split(/[/:]/)[0];
  return !!h && !/\.(svc|internal|local)$/.test(h);
};
/** Every tool available to the tenant (prototype toolInv, without usage counters). */
export function toolInv(af: AgentFactoryData, D: AfTenant, t: AfTenantKey, TN: string): ToolInfo[] {
  const L: ToolInfo[] = [];
  const R = af.models;
  const noModel = (req?: [string, string]) =>
    !req ? false : !R.deps.some((d) => (d.cat === 'LLM' || d.cat === 'Embedding' || d.cat === 'ASR' ? d.cat : 'LLM') === req[0] && d.status === 'Active' && (!req[1] || d.caps.includes(req[1])) && (d.all || d.ten.includes(t)) && R.conns.find((c) => c.id === d.conn)?.status === 'Enabled');
  NATIVE_TOOLS.forEach(([g, svc, rows]) =>
    rows.forEach(([n, d, req]) => {
      const nm = noModel(req);
      L.push({ key: 'kap:' + n, n, d, srcL: 'Native · ' + svc, cap: g === 'Model tasks' ? 'Model task' : g, fx: 'Read-only', stF: nm ? 'Unavailable' : 'Available', io: NAT_IO[n] || ['As declared by the tool', 'Structured result'] });
    }),
  );
  const M = af.mcp;
  M.servers
    .filter((s0) => (s0.own === 'platform' ? (s0.ten || []).includes(t) && !(M.optOut[t] || {})[s0.n] : s0.own === t))
    .forEach((s0) => {
      const en = (M.tenTools[t] || {})[s0.n] || [];
      const plat = s0.own === 'platform';
      s0.tools.forEach((x) => {
        const st0 = s0.status !== 'Enabled' ? (plat ? 'Server disabled by platform' : 'Server disabled') : s0.susp ? 'Server suspended' : !en.includes(x.n) ? 'Not enabled' : s0.health === 'Degraded' ? 'Degraded' : s0.health === 'Failing' ? 'Failing' : 'Available';
        L.push({ key: s0.n + ':' + x.n, n: x.n, d: x.d, srcL: (plat ? 'Shared MCP · ' : 'Tenant MCP · ') + s0.n, cap: (x.fx || s0.fx) === 'Changes state' ? 'Actions' : extU(s0.up) ? 'External data' : 'Internal data', fx: x.fx || s0.fx, stF: st0, io: ['As declared by the MCP server', 'JSON result'] });
      });
    });
  void TN;
  return L.map((x) => ({ ...x, stF: D.toolDis[x.key] ? 'Disabled (emergency)' : x.stF }));
}
/** Tools offered in the create-agent wizard. */
export function wizardTools(af: AgentFactoryData, t: AfTenantKey): string[] {
  const M = af.mcp;
  return ['kap:hybrid_search', 'kap:document_get', 'kap:numeric_lookup', 'kap:compare', 'kap:trend', 'kap:translate']
    .concat(Object.entries(M.tenTools[t] || {}).flatMap(([s0, ts]) => ts.map((x) => s0 + ':' + x)))
    .concat(M.servers.filter((s0) => s0.own === t).flatMap((s0) => s0.tools.map((x) => s0.n + ':' + x.n)))
    .filter((x, i, a) => a.indexOf(x) === i);
}

// ---------------------------------------------------------------- simulated test execution
export const SAMPLES: Record<AfTenantKey, string[]> = {
  sceai: ['What was the tourism sector contribution to GDP in Q4 2024, and how does it compare with the target?', 'What was hotel occupancy in Al Wakrah last month?', 'Which indicators are currently off track and what do the plans say about them?', 'What does the National Development Strategy say about export diversification?', 'قارن التضخم في قطر وعُمان منذ 2020'],
  econ: ['Why is digital government spending below plan in Q3?', 'ما هو التعميم الخاص بإعداد موازنة 2027؟'],
  sandbox: ['What does the open data guide recommend for publishing CSV?', 'Summarise the latest correspondence with customer C001.'],
};

export interface TestResult {
  id: string;
  kind: 'agent';
  a: string;
  ver: string;
  q: string;
  lang: string;
  model: string;
  st: string;
  err: string;
  answer: string;
  /** [source, location] */
  evid: [string, string][];
  /** [tool, arguments, result, time, status] */
  tools: [string, string, string, string, string][];
  /** [step, detail, time, status] */
  trace: [string, string, string, string][];
  running?: boolean;
}

/** Simulated agent execution (prototype simAgent). `colls` = collections assigned to the agent. */
export function simAgent(af: AgentFactoryData, D: AfTenant, t: AfTenantKey, a: string, ver: string, q: string, colls: string[], idSeed = Date.now()): TestResult {
  const o = D.agents.find((x) => x.id === a)!;
  const cfg = cfgOf(o, ver);
  const tl = (cfg.tset || (af.mcp.grants[t] || {})[a] || []).filter((x) => !toolOff(D, x)).map((x) => x.split(':').pop()!);
  const res: TestResult = { id: 'T-' + String(idSeed).slice(-5), kind: 'agent', a, ver, q, lang: isAr(q) ? 'Arabic' : 'English', model: modelL(af, t, a, cfg), st: 'Succeeded', err: '', answer: '', evid: [], tools: [], trace: [] };
  res.trace.push(['Guardrails · input', (cfg.guards || []).slice(0, 2).join(', ') + ' passed', '40 ms', 'Succeeded'], ['Model call · plan', res.model, '1.4 s', 'Succeeded']);
  if (o.dis) {
    res.st = 'Failed';
    res.err = 'Agent is disabled (emergency)';
    res.trace = [['Execution', 'Rejected: agent disabled by ' + o.dis.by, '0 ms', 'Failed']];
    return res;
  }
  const off = tl.filter((x) => toolOff(D, x));
  const unresolved = /occupancy|wakrah/i.test(q);
  const offTrack = /off track/i.test(q);
  if (off.length && /oxford|outlook|compare|external|عُمان/i.test(q) && tl.some((x) => /Economic/.test(x))) {
    res.tools.push([off[0], '{ country: "QAT" }', 'Tool disabled (emergency)', '0 ms', 'Failed']);
    res.st = 'Failed';
    res.err = off[0] + ' is disabled';
    res.answer = 'Answered from local data only; external context unavailable.';
  } else if (unresolved) {
    res.tools.push(['find_indicator', '{ name: "hotel occupancy", area: "Al Wakrah" }', 'No match', '300 ms', 'Failed']);
    if (/Indicator Picker/.test(cfg.fail || '')) {
      res.tools.push(['Indicator Picker (delegated)', '{ candidates: 0 }', 'NONE', '1.1 s', 'Succeeded']);
      res.answer = 'No official data is available for hotel occupancy in Al Wakrah. Related indicator: hotel occupancy (national, monthly).';
      res.st = 'Succeeded';
      res.trace.push(['Delegation', 'Indicator Picker returned NONE · refusal with a related indicator', '1.1 s', 'Succeeded']);
    } else {
      res.st = 'Failed';
      res.err = 'Indicator not found';
      res.answer = 'No official data is available for this indicator.';
    }
  } else if (offTrack && cfg.tools < 20 && /indicators/.test(a)) {
    for (let i = 0; i < 3; i++) res.tools.push(['find_indicator', '{ code: "IND-0' + (10 + i) + '" }', 'Resolved', '0.3 s', 'Succeeded']);
    res.tools.push(['… 12 more calls', '', 'Limit reached', '', 'Failed']);
    res.st = 'Failed';
    res.err = 'Tool-call limit reached (' + cfg.tools + ' / ' + cfg.tools + ')';
    res.answer = 'No answer: the tool-call limit was reached.';
  } else {
    tl.slice(0, 3).forEach((x, i) => res.tools.push([x, i === 0 ? '{ query: "' + q.slice(0, 40) + '…" }' : '{ … }', toolOff(D, x) ? 'Tool disabled (emergency)' : 'OK', 200 + i * 140 + ' ms', toolOff(D, x) ? 'Failed' : 'Succeeded']));
    res.answer = offTrack ? 'Four indicators are off track; the plans reference corrective programmes for three of them [1][2].' : isAr(q) ? 'الإجابة مع القيم والفترات والمصادر [1].' : 'Answer with values, periods and citations [1][2].';
    if (res.tools.some((x) => x[4] === 'Failed')) {
      res.st = 'Failed';
      res.err = 'A tool is disabled';
    }
  }
  res.evid = res.st === 'Succeeded' || res.answer ? colls.slice(0, 2).map((c, i) => [c, i === 0 ? 'passage 3 · relevance 0.82' : 'record set · 4 rows'] as [string, string]) : [];
  if (unresolved && res.st === 'Failed') res.evid = [];
  res.trace.push(
    ['Tool calls', res.tools.length + ' calls', '', res.tools.some((x) => x[4] === 'Failed') ? 'Failed' : 'Succeeded'],
    ['Model call · answer', res.model, '1.2 s', res.st === 'Failed' && !res.answer ? 'Skipped' : 'Succeeded'],
    ['Guardrails · output', res.st === 'Failed' ? 'Grounding: ' + (res.evid.length ? 'passed' : 'no evidence') : 'Grounding passed · numeric verifier passed', '60 ms', res.evid.length || res.st === 'Succeeded' ? 'Succeeded' : 'Failed'],
  );
  return res;
}
