/**
 * Lifecycle, evaluation gate and simulation helpers for workflows (port of the
 * shared parts of the prototype's `agentHub`: pubOf/draftOf/cfgOf, lifeP/verP,
 * MET/gateOf/gateL/hashC/simEval, simAgent, whyOf). Pure functions of the
 * tenant data.
 */
import type { DsStatus } from '@/engine/types';
import type { AgentRef, EvalRun, Metrics, Thresholds, WfTenant, WfVersion, Workflow } from './types';
import type { AgentSim, WfCfg } from './model';

export const wfKey = (id: string) => 'workflow:' + id;

export const pubOf = (o: { vers: WfVersion[] }) => o.vers.find((v) => v.st === 'Published');
export const draftOf = (o: { vers: WfVersion[] }) => o.vers.find((v) => v.st === 'Draft');
/** Configuration of version `v` (falls back to the published one, as the prototype). */
export const cfgOf = (o: Workflow, v?: string): WfCfg => {
  const x = o.vers.find((y) => y.v === v) || pubOf(o) || o.vers[0];
  return (x.cfg || (pubOf(o) || o.vers[0]).cfg || o.vers.find((y) => y.cfg)?.cfg) as WfCfg;
};
export const nextV = (o: { vers: WfVersion[] }) => 'v' + (Math.max(...o.vers.map((v) => +v.v.slice(1))) + 1);
export const wfStatus = (w: Workflow) => (pubOf(w) ? 'Published' : 'Draft');

export const lifeP = (o: { dis: unknown; st?: string; vers: WfVersion[] }): [DsStatus, string] =>
  o.dis ? ['rejected', 'Disabled'] : o.st === 'Archived' ? ['draft', 'Archived'] : o.st === 'Published' ? (draftOf(o) ? ['approved', 'Published · draft open'] : ['approved', 'Published']) : ['submitted', 'Draft'];
export const wfLifeP = (w: Workflow) => lifeP({ ...w, st: wfStatus(w) });
export const agentLifeP = (a: AgentRef): [DsStatus, string] =>
  a.dis ? ['rejected', 'Disabled'] : a.st === 'Archived' ? ['draft', 'Archived'] : a.st === 'Published' ? (a.draft ? ['approved', 'Published · draft open'] : ['approved', 'Published']) : ['submitted', 'Draft'];
export const verP = (s: string): [DsStatus, string] => (({ Published: ['approved', 'Published'], Draft: ['submitted', 'Draft'], Superseded: ['draft', 'Superseded'], Archived: ['draft', 'Archived'] }) as Record<string, [DsStatus, string]>)[s] || ['draft', s];
export const stP = (s: string): [DsStatus, string] =>
  (({ Succeeded: ['approved', 'Succeeded'], 'Succeeded with fallback': ['hold', 'Succeeded with fallback'], Failed: ['rejected', 'Failed'], Running: ['submitted', 'Running'], Cancelled: ['draft', 'Cancelled'], 'Waiting for review': ['hold', 'Waiting for review'], Reproduction: ['hold', 'Reproduction'] }) as Record<string, [DsStatus, string]>)[s] || ['draft', s];

export const pct = (x: number | null | undefined) => (x == null ? '—' : Math.round(x * 1000) / 10 + '%');

// ---------------------------------------------------------------- agents
export const agentOf = (D: WfTenant, id: string) => D.agents.find((a) => a.id === id);
/** Why an agent cannot be used in a workflow ('' = it can). */
export const agentOk = (D: WfTenant, tenantName: string) => (a: string) => {
  const x = agentOf(D, a);
  if (!x) return 'does not exist in ' + tenantName;
  if (x.st === 'Archived') return 'is archived';
  if (x.dis) return 'is disabled (emergency)';
  return '';
};
export const wfUsing = (D: WfTenant, a: string) => D.workflows.filter((w) => { const c = cfgOf(w); return c && c.nodes.some((n) => n[1] !== 'entry' && n[2] === a); });
export const modelL = (a: AgentRef) => a.model;
export const toolName = (t: string) => t.split(':').pop() || t;

/** One agent step of a simulated workflow run (failure rules of the prototype's `simAgent`). */
export function simAgent(a: AgentRef | undefined, q: string): AgentSim | null {
  if (!a) return null;
  if (a.dis) return { st: 'Failed', err: 'Agent is disabled (emergency)', tools: 0 };
  const unresolved = /occupancy|wakrah/i.test(q);
  const offTrack = /off track/i.test(q);
  if (unresolved) return /Indicator Picker/.test(a.fail || '') ? { st: 'Succeeded', err: '', tools: 2 } : { st: 'Failed', err: 'Indicator not found', tools: 1 };
  if (offTrack && a.tools < 20 && /indicators/.test(a.id)) return { st: 'Failed', err: 'Tool-call limit reached (' + a.tools + ' / ' + a.tools + ')', tools: 4 };
  return { st: 'Succeeded', err: '', tools: Math.min(3, a.tset.length) };
}

// ---------------------------------------------------------------- evaluation gate
export const MET: [keyof Thresholds, string, 'min' | 'max'][] = [
  ['acc', 'Answer accuracy', 'min'], ['cit', 'Citation accuracy', 'min'], ['ref', 'Refusal correctness', 'min'], ['uns', 'Unsupported statements', 'max'],
  ['num', 'Numeric integrity', 'min'], ['reg', 'Regression vs active version', 'min'], ['parity', 'Language parity gap', 'max'],
];
export const thrOf = (D: WfTenant, o: Workflow): Thresholds => ({ ...D.thr, ...(o.thr || {}) });
export const runsOf = (D: WfTenant, key: string) => (D.evalruns || []).filter((r) => r.t === key);
export const lastRun = (D: WfTenant, key: string, v: string) => runsOf(D, key).find((r) => r.v === v);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
export function regOf(D: WfTenant, o: Workflow, r: EvalRun) {
  const pv = pubOf(o);
  if (!pv || r.v === pv.v) return 0;
  const base = runsOf(D, wfKey(o.id)).find((x) => x.v === pv.v && x.set === r.set);
  return base ? r3(r.m.acc - base.m.acc) : 0;
}
export const parityOf = (r: EvalRun) => { const l = Object.values(r.m.langs || {}); return l.length > 1 ? r3(Math.max(...l) - Math.min(...l)) : 0; };
export type GateRow = [keyof Thresholds, string, number, number, boolean];
export function gateOf(D: WfTenant, o: Workflow, r: EvalRun): { res: GateRow[]; ok: boolean } {
  const th = thrOf(D, o);
  const val: Record<string, number> = { ...(r.m as unknown as Record<string, number>), reg: regOf(D, o, r), parity: parityOf(r) };
  const res = MET.map(([k, l, d]): GateRow => [k, l, val[k], th[k], d === 'min' ? val[k] >= th[k] : val[k] <= th[k]]);
  return { res, ok: res.every((x) => x[4]) };
}
/** Hash of a configuration: an evaluation counts only for the configuration it ran on. */
export const hashC = (c: unknown) => { const s0 = JSON.stringify(c || {}); let h = 7; for (let i = 0; i < s0.length; i++) h = (h * 31 + s0.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export const fresh = (o: Workflow, r: EvalRun | undefined) => !r || !r.h || r.h === hashC(cfgOf(o, r.v));
export function gateL(D: WfTenant, o: Workflow, v: string): [DsStatus, string] {
  const r = lastRun(D, wfKey(o.id), v);
  if (!r) return ['draft', 'Not evaluated'];
  if (r.running) return ['submitted', 'Evaluating'];
  if (!fresh(o, r)) return ['hold', 'Changed · re-evaluate'];
  return gateOf(D, o, r).ok ? ['approved', 'Gate passed'] : ['rejected', 'Gate failed'];
}
export const valL = (k: string, x: number) => (k === 'reg' || k === 'parity' ? String(x) : pct(x));

/** Simulated evaluation result for a version on a dataset (prototype `simEval`). */
export function simEval(D: WfTenant, o: Workflow, v: string, setId: string): { m: Metrics; failed: string[] } {
  const key = wfKey(o.id);
  const ver = o.vers.find((x) => x.v === v);
  const pv = pubOf(o);
  const prev = runsOf(D, key).find((r) => r.set === setId && pv && r.v === pv.v) || runsOf(D, key).find((r) => r.set === setId) || runsOf(D, key)[0];
  const set = D.evalsets.find((s0) => s0.id === setId) || { cases: [] };
  const base: Metrics = prev ? JSON.parse(JSON.stringify(prev.m)) : { acc: 0.93, cit: 0.96, ref: 0.96, uns: 0.01, num: 1.0, langs: { English: 0.94, Arabic: 0.92 } };
  const fix = /limit|fallback|fix|correct/i.test(ver?.note || '');
  let failed = (prev && prev.set === setId ? prev.failed : []).filter((c) => set.cases.some((x) => x.id === c));
  if (fix) {
    failed = failed.filter((c) => c !== 'TC-106' && c !== 'TC-301');
    base.acc = Math.min(0.99, base.acc + 0.02);
    base.langs.English = Math.min(0.99, (base.langs.English ?? 0.9) + 0.02);
    base.langs.Arabic = Math.min(0.99, (base.langs.Arabic ?? 0.9) + 0.02);
  }
  return { m: base, failed: [...new Set(failed)] };
}

// ---------------------------------------------------------------- failure reasons
export const SETL: Record<string, string> = { tools: 'Max tool calls', instr: 'System instructions', fail: 'Failure handling', guards: 'Guardrails', stages: 'Workflow structure', model: 'Primary model' };
const WHY: Record<string, [string, string, string]> = {
  'TC-106': ['Stopped after 15 tool calls without an answer', 'Tool-call limit reached before all indicators were resolved', 'tools'],
  'TC-105': ['Read the period as 2019 instead of January 2019', 'Arabic month name not recognised in the question', 'instr'],
  'TC-301': ['Answered with an unrelated indicator', 'Refusal expected: no official data for this location', 'fail'],
  'TC-302': ['Listed internal configuration', 'Prompt injection not refused', 'guards'],
};
export const whyOf = (cid: string): [string, string, string] => WHY[cid] || ['Final answer differs from the expected answer', 'A step returned an incomplete result', 'stages'];
export const caseOf = (D: WfTenant, cid: string) => {
  const s0 = D.evalsets.find((x) => x.cases.some((c) => c.id === cid));
  return s0 ? { s0, c: s0.cases.find((x) => x.id === cid)! } : { s0: null, c: { q: cid, lang: '', exp: '', refuse: false } };
};
