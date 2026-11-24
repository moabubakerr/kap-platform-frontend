/**
 * The workflow screens' view of the AI Agent Factory data (`agentFactory.ts`,
 * owned by the Agents hub): workflows, evaluation datasets and runs, workflow
 * executions and schedules as stored, and each agent reduced to what the
 * workflow screens need (active version, model, limits, tools, collections).
 */
import {
  cfgOf as afCfgOf, draftOf as afDraftOf, pubOf as afPubOf, resolveModel, toolsOf,
  type AfTenantKey, type AgentFactoryData, type Disablement, type EvalMetrics, type EvalRun as AfEvalRun, type EvalSet as AfEvalSet,
  type Schedule, type Thresholds as AfThresholds, type WfRun as AfWfRun, type Workflow as AfWorkflow,
} from '@/v35/data/agentFactory';
import type { WfCfg } from './model';

export type WfTenantKey = AfTenantKey;
export type Workflow = AfWorkflow;
export type WfVersion = AfWorkflow['vers'][number];
export type EvalRun = AfEvalRun;
export type EvalSet = AfEvalSet;
export type Metrics = EvalMetrics;
export type Thresholds = AfThresholds;
export type WfRun = AfWfRun;
export type { Schedule, Disablement };

/** An agent as the workflow screens see it (its published version, or its only version). */
export interface AgentRef {
  id: string;
  purpose: string;
  st: 'Published' | 'Draft' | 'Archived';
  /** published version, or the only version */
  v: string;
  /** open draft version */
  draft?: string;
  dis: Disablement | null;
  /** model label (tenant default resolved) */
  model: string;
  /** max tool calls */
  tools: number;
  fail: string;
  /** assigned tools ('server:tool') */
  tset: string[];
  colls: string[];
}

export interface WfTenant {
  thr: Thresholds;
  agents: AgentRef[];
  workflows: Workflow[];
  evalsets: EvalSet[];
  evalruns: EvalRun[];
  wfruns: WfRun[];
  scheds: Schedule[];
  /** emergency-disabled tools by 'server:tool' key */
  toolDis: Record<string, Disablement>;
}

export const EMPTY_TENANT: WfTenant = { thr: { acc: 0.9, cit: 0.95, ref: 0.95, uns: 0.02, num: 1, reg: -0.02, parity: 0.05 }, agents: [], workflows: [], evalsets: [], evalruns: [], wfruns: [], scheds: [], toolDis: {} };

/** Build the view of tenant `t` from the agent factory data and the agent → collection index. */
export function wfView(data: AgentFactoryData, agColl: Record<string, string[]>, t: WfTenantKey): WfTenant {
  const D = data.tenants[t];
  const agents = D.agents.map((a): AgentRef => {
    const pv = afPubOf(a) || a.vers[0];
    const cfg = afCfgOf(a, pv.v);
    const model = !cfg ? '—' : String(cfg.model).startsWith('default:') ? (resolveModel(data.models, t, a.id).id || 'Tenant default') + ' (tenant default)' : cfg.model;
    return {
      id: a.id,
      purpose: a.purpose,
      st: a.st,
      v: pv.v,
      draft: afDraftOf(a)?.v,
      dis: a.dis,
      model,
      tools: cfg ? cfg.tools : 0,
      fail: cfg ? cfg.fail : '',
      tset: toolsOf(data, t, a.id).slice(),
      colls: (agColl[a.id] || []).slice(),
    };
  });
  return { thr: D.thr, agents, workflows: D.workflows, evalsets: D.evalsets, evalruns: D.evalruns, wfruns: D.wfruns, scheds: D.scheds, toolDis: D.toolDis || {} };
}

/** Configuration of a workflow version in the model's type. */
export const asCfg = (c: unknown) => c as WfCfg;

/** Sample requests for test runs (prototype `SAMPLES`). */
export const SAMPLES: Record<WfTenantKey, string[]> = {
  sceai: ['What was the tourism sector contribution to GDP in Q4 2024, and how does it compare with the target?', 'What was hotel occupancy in Al Wakrah last month?', 'Which indicators are currently off track and what do the plans say about them?', 'What does the National Development Strategy say about export diversification?', 'قارن التضخم في قطر وعُمان منذ 2020'],
  econ: ['Why is digital government spending below plan in Q3?', 'ما هو التعميم الخاص بإعداد موازنة 2027؟'],
  sandbox: ['What does the open data guide recommend for publishing CSV?', 'Summarise the latest correspondence with customer C001.'],
};
