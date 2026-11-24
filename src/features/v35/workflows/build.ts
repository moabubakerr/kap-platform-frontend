/**
 * Agent Workflows (v35): workflow list, workflow details (Overview · Designer ·
 * Evaluation · Versions · Metrics) and the Tenant Agents Map as ScreenModels.
 * Port of the workflow parts of the prototype's `agentHub` (design-ref-v35/app.js
 * 2358–3113: `workflows`, `workflow`, `agmap`, `evalSec`, `corrSec`, `cmpSec`,
 * `versionsSec`, `killRows`). Pure: data, permissions and callbacks in; model out.
 * The designer itself is a React component passed in as a custom section.
 */
import type * as React from 'react';
import { act, cell, fr } from '@/engine/build';
import type { Action, DiagramSpec, DsStatus, Filters, Row, ScreenModel, Section } from '@/engine/types';
import type { WfTenant, WfTenantKey, Workflow } from './types';
import { agentsInG, KL, nodeL, runOrder } from './model';
import {
  agentLifeP, agentOf, caseOf, cfgOf, draftOf, fresh, gateL, gateOf, lastRun, MET, modelL, parityOf, pct, pubOf, runsOf, SETL, stP, thrOf, toolName,
  valL, verP, whyOf, wfKey, wfLifeP, wfUsing,
} from './logic';
import type { WfUi } from './state';

export interface WfNav {
  list: () => void;
  wf: (id: string, tab?: string) => void;
  map: () => void;
  pipeline: () => void;
  agent: (id: string) => void;
  evalset: (id: string) => void;
  evalsets: () => void;
  run: (id: string) => void;
  audit: () => void;
}

export interface CaseSeed { q: string; lang?: string; cat?: string; run?: string; evid?: string; exp?: string }

export interface WfActs {
  create: () => void;
  createDraft: (w: Workflow, note?: string, open?: boolean) => void;
  publish: (w: Workflow) => void;
  rollback: (w: Workflow, v: string) => void;
  compare: (w: Workflow, a: string, b: string) => void;
  compareF: (w: Workflow) => void;
  runEval: (w: Workflow, v: string, setId: string) => void;
  runEvalF: (w: Workflow) => void;
  thresholdsF: (w: Workflow) => void;
  datasetsF: (w: Workflow) => void;
  disable: (w: Workflow) => void;
  reenable: (w: Workflow) => void;
  caseForm: (w: Workflow, p: CaseSeed) => void;
  openSetting: (w: Workflow, cid: string) => void;
  /** open the designer in replay mode on a recorded run */
  replay: (w: Workflow, runId: string, v: string) => void;
  /** select a step on the canvas (execution steps table) */
  showStep: (w: Workflow, nodeId: string) => void;
}

export interface WfCtx {
  t: WfTenantKey | null;
  /** tenant display name */
  tn: string;
  D: WfTenant;
  ui: WfUi;
  actor: string;
  canRead: (agent: string) => boolean;
  /** agent:update on any agent: edit workflows */
  canUpd: boolean;
  /** agent:oversee: approve, evaluate */
  canAppr: boolean;
  /** agent:oversee or tenant:configure: emergency disable */
  canOps: boolean;
  /** agent:create: create workflows */
  canCreate: boolean;
  /** agent:execute or agent:update: run tests */
  canExec: boolean;
  go: WfNav;
  a: WfActs;
}

export type ListFilters = { q?: string; st?: string };

const noTenant = (title: string): ScreenModel => ({ head: { title }, sections: [{ callout: 'Agent workflows are not available in this tenant.' }] });
const notFound = (id: string, back: Action, tn: string): ScreenModel => ({ head: { title: id, acts: [back] }, sections: [{ callout: `This workflow is not available. It does not exist in ${tn} or you don't have access.` }] });

/** Version open in the designer: the selected one, else the draft, else the published one. */
export const versionOf = (c: WfCtx, w: Workflow) => {
  const sel = c.ui.ver[(c.t || '') + ':' + w.id];
  return sel && w.vers.some((x) => x.v === sel && x.cfg) ? sel : (draftOf(w) || pubOf(w) || w.vers[0]).v;
};

// ================================================================ WORKFLOWS LIST
export function workflowsScreen(c: WfCtx, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  if (!c.t) return noTenant('Agent Workflows');
  const { D } = c;
  const LS = (w: Workflow) => wfLifeP(w)[1];
  const st = F.st || 'Any status';
  const q = (F.q || '').toLowerCase();
  const vis = D.workflows.filter((w) => (!q || (w.n + ' ' + w.purpose + ' ' + agentsInG(cfgOf(w)).join(' ')).toLowerCase().includes(q)) && (st === 'Any status' || LS(w) === st));
  const filters: Filters = {
    q: F.q || '',
    qLabel: 'Search',
    qPlaceholder: 'Workflow name, purpose or agent',
    setQ: (v) => setF({ ...F, q: v }),
    main: [{ label: 'Status', value: st, options: ['Any status', ...new Set(D.workflows.map(LS))], onChange: (v) => setF({ ...F, st: v }) }],
    chips: F.q || st !== 'Any status' ? [{ l: 'Filters', x: () => setF({}) }] : [],
    clear: () => setF({}),
    count: vis.length + ' of ' + D.workflows.length + ' workflows',
  };
  return {
    head: {
      title: 'Agent Workflows',
      acts: [act('Tenant agents map', c.go.map), act('Evaluation datasets', c.go.evalsets)],
      add: c.canCreate ? act('Create workflow', c.a.create, 'primary') : undefined,
    },
    filters,
    sections: [{
      cols: ['Workflow', 'Status', 'Version', 'Orchestration', 'Entry point', 'Agents', 'Recent runs'],
      empty: D.workflows.length ? 'No workflows match the filters.' : 'No workflows yet. Create the first workflow.',
      mode: 'inline',
      rows: vis.map((w): Row => {
        const pv = pubOf(w) || w.vers[0];
        const cfg = cfgOf(w);
        const runs = D.wfruns.filter((r) => r.wf === w.id);
        const dv = draftOf(w);
        return {
          key: 'w:' + w.id,
          cells: [
            cell(w.n, { sub: w.purpose }),
            cell('', { p: wfLifeP(w) }),
            cell(pv.v, { sub: dv ? 'Draft ' + dv.v : '' }),
            cell(cfg.mode),
            cell(w.entry),
            cell(agentsInG(cfg).join(', ') || '—'),
            cell(runs.length ? runs[0].st + ' · ' + runs[0].at : 'No runs', { sub: runs.length ? runs.length + ' recent' : '' }),
          ],
          acts: [act('Open', () => c.go.wf(w.id)), act('Designer', () => c.go.wf(w.id, 'designer'))],
          onClick: () => c.go.wf(w.id),
        };
      }),
    }],
  };
}

// ================================================================ WORKFLOW DETAILS
export const WF_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'designer', label: 'Designer' },
  { value: 'eval', label: 'Evaluation' },
  { value: 'versions', label: 'Versions' },
  { value: 'metrics', label: 'Metrics' },
];
/** Older tab keys of the prototype open the designer. */
export const wfTabOf = (tab?: string) => {
  const t0 = ({ map: 'designer', config: 'designer', testing: 'designer' } as Record<string, string>)[tab || ''] || tab;
  return WF_TABS.some((x) => x.value === t0) ? t0! : 'overview';
};

const killRows = (c: WfCtx, w: Workflow): Row[] => {
  if (!c.canOps) return w.dis ? [fr('Operational state', 'Disabled (emergency)', w.dis.by + ' · ' + w.dis.at + ' · ' + w.dis.reason)] : [];
  return w.dis
    ? [fr('Operational state', 'Disabled (emergency)', w.dis.by + ' · ' + w.dis.at + ' · ' + w.dis.reason + ' · audit ' + w.dis.ref, [act('View audit record', c.go.audit), act('Re-enable', () => c.a.reenable(w))])]
    : [fr('Operational state', 'Enabled', 'Emergency disable stops all executions at once', [act('Emergency disable', () => c.a.disable(w), 'ghost')])];
};

const PS: Record<string, [DsStatus, string]> = { done: ['approved', 'Done'], next: ['submitted', 'Next'], fail: ['rejected', 'Failed'], todo: ['draft', 'To do'], na: ['draft', 'Not required'], wait: ['hold', 'Waiting'] };

/** Correction / release progress of the open draft (prototype `corrSec`). */
export function corrSec(c: WfCtx, w: Workflow): Section[] {
  const { D } = c;
  const key = wfKey(w.id);
  const pv = pubOf(w), dv = draftOf(w);
  const tv = dv || w.vers.find((v) => v.st === 'Published' && v.at === 'just now') || null;
  if (!tv) return [];
  const runs = runsOf(D, key);
  const base = runs.find((r) => !r.running && r.v !== tv.v && (r.failed.length || !gateOf(D, w, r).ok)) || null;
  const fixRun = lastRun(D, key, tv.v);
  const done = fixRun && !fixRun.running;
  const fixed = base && done ? base.failed.filter((x) => !fixRun!.failed.includes(x)) : [];
  const still = base && done ? fixRun!.failed : [];
  const g = done ? gateOf(D, w, fixRun!) : null;
  const setId = (w.evSets || [])[0] || (base && base.set) || (D.evalsets[0] || { id: '' }).id;
  type Step = [string, string, string, Action[]];
  const S: Step[] = [
    ['Failure found', base ? 'done' : 'na', base ? base.id + ' on ' + base.v + ' · ' + (base.failed.length ? base.failed.length + ' failed: ' + base.failed.join(', ') : 'gate failed') : /job|run/i.test(tv.note || '') ? tv.note : 'No failed evaluation', base && base.failed[0] ? [act('Open setting', () => c.a.openSetting(w, base.failed[0]))] : []],
    ['Correction drafted', 'done', tv.v + (tv.note ? ' · ' + tv.note : ''), [act('Compare', () => c.a.compare(w, (pv || w.vers[1] || tv).v, tv.v))]],
    [
      'Re-evaluated',
      !fixRun ? 'todo' : fixRun.running ? 'wait' : !fresh(w, fixRun) ? 'todo' : g!.ok ? 'done' : 'fail',
      !fixRun ? 'Not evaluated yet' : fixRun.running ? fixRun.id + ' running' : !fresh(w, fixRun) ? 'Configuration changed after ' + fixRun.id + ' · evaluate again' : fixRun.id + ' · gate ' + (g!.ok ? 'passed' : 'failed') + (fixed.length ? ' · fixes ' + fixed.join(', ') : '') + (still.length ? ' · still failing ' + still.join(', ') : ''),
      c.canUpd && (!fixRun || (!fixRun.running && (!g!.ok || !fresh(w, fixRun)))) && tv.st === 'Draft' ? [act('Run evaluation', () => c.a.runEval(w, tv.v, (fixRun && fixRun.set) || setId))] : [],
    ],
    (() => {
      const ok0 = !!g && g.ok && !!fixRun && fresh(w, fixRun);
      return ['Published', tv.st === 'Published' ? 'done' : 'todo', tv.st === 'Published' ? tv.v + ' is the published version' : 'Published version is ' + ((pv || { v: '' }).v || 'none'), c.canUpd && tv.st === 'Draft' && ok0 ? [act('Publish', () => c.a.publish(w))] : []] as Step;
    })(),
  ];
  if (!base) { S.shift(); S[0][0] = 'Change drafted'; }
  let nx = false;
  const rows = S.map(([l, s0, d0, a0], i): Row => {
    let p = PS[s0];
    if (!nx && (s0 === 'todo' || s0 === 'fail' || s0 === 'wait')) { nx = true; if (s0 === 'todo') p = PS.next; }
    return { key: 'cp:' + i, cells: [cell(i + 1 + '. ' + l), cell('', { p }), cell(d0)], acts: a0 };
  });
  return [{ title: (base ? 'Correction progress · ' : 'Release progress · ') + tv.v, cols: ['Step', 'Status', 'Detail'], mode: 'inline', rows }];
}

function cmpSec(c: WfCtx, w: Workflow): Section[] {
  const key = wfKey(w.id);
  const vs = w.vers.filter((v) => { const r = lastRun(c.D, key, v.v); return r && !r.running; }).slice(0, 3);
  if (vs.length < 2) return [];
  const R = vs.map((v) => lastRun(c.D, key, v.v)!);
  const G0 = R.map((r) => gateOf(c.D, w, r));
  return [{
    title: 'Version comparison',
    cols: ['Metric', ...vs.map((v, i) => v.v + ' · ' + v.st + ' · ' + R[i].id)],
    mode: 'inline',
    rows: MET.map(([k, l]): Row => ({ key: 'vc:' + k, cells: [cell(l), ...G0.map((g) => { const x = g.res.find((y) => y[0] === k)!; return cell(valL(k, x[2]) + (x[4] ? '' : ' ✕'), { sub: x[4] ? '' : 'Below threshold' }); })] }))
      .concat([
        { key: 'vc:fc', cells: [cell('Failed cases'), ...R.map((r) => cell(r.failed.length ? r.failed.join(', ') : 'None'))] },
        { key: 'vc:g', cells: [cell('Evaluation gate'), ...G0.map((g) => cell('', { p: g.ok ? ['approved', 'Passed'] : ['rejected', 'Failed'] }))] },
      ]),
  }];
}

/** Evaluation tab (prototype `evalSec`). */
export function evalSec(c: WfCtx, w: Workflow): Section[] {
  const { D } = c;
  const key = wfKey(w.id);
  const pv = pubOf(w), dv = draftOf(w);
  const th = thrOf(D, w);
  const upd = c.canUpd || c.canAppr;
  const runs = runsOf(D, key);
  const sets = D.evalsets.filter((s0) => (w.evSets || []).includes(s0.id));
  const latest = runs.find((r) => !r.running) || null;
  const g = latest ? gateOf(D, w, latest) : null;
  const thLbl = (k: string, d0: string) => (k === 'reg' ? '≥ ' + th.reg : k === 'parity' ? '≤ ' + th.parity : (d0 === 'max' ? '≤ ' : '≥ ') + pct(th[k as keyof typeof th]));
  const prevR = pv && latest && latest.v !== pv.v ? lastRun(D, key, pv.v) || null : null;
  const fr0 = latest && latest.failed.length ? latest : runs.find((r) => !r.running && r.failed.length) || latest;
  const drCol = !!(dv && fr0 && fr0.v !== dv.v);
  const lc = c.ui.lastCase && c.ui.lastCase.key === key ? c.ui.lastCase : null;
  return [
    { form: true, rows: [fr('Evaluation scope', 'Final answer of the complete workflow', 'Agents keep their own evaluation')] },
    ...(lc ? [{ form: true, rows: [fr('Test case added', lc.cid + ' · ' + lc.sid, 'Included in future regression runs', [act('Open dataset', () => c.go.evalset(lc.sid))])] } as Section] : []),
    ...corrSec(c, w),
    {
      form: true,
      title: 'Evaluation gate',
      sacts: upd ? [act('Run evaluation', () => c.a.runEvalF(w)), act('Edit thresholds', () => c.a.thresholdsF(w))] : [],
      rows: [
        fr('Latest result', latest ? latest.id + ' · ' + latest.v + ' · ' + latest.set : 'Not evaluated', latest ? latest.by + ' · ' + latest.at : ''),
        fr('Gate', g ? (g.ok ? 'Passed' : 'Failed · ' + g.res.filter((x) => !x[4]).map((x) => x[1]).join(', ')) : '—', dv ? 'Draft ' + dv.v + ': ' + gateL(D, w, dv.v)[1] : 'No draft'),
        fr('Thresholds', Object.keys(w.thr || {}).length ? 'Custom for this workflow' : 'Tenant defaults', ''),
        ...(runs.some((r) => r.running) ? [fr('In progress', runs.filter((r) => r.running).map((r) => r.id + ' · ' + r.v).join(', '))] : []),
      ],
    },
    {
      title: 'Quality metrics',
      cols: ['Metric', 'Threshold', ...(latest ? [latest.v + ' · ' + latest.id, 'Result'] : []), ...(prevR ? [pv!.v + ' (active)'] : [])],
      empty: 'Run an evaluation to see results.',
      mode: 'inline',
      rows: g
        ? g.res.map(([k, l, val, , ok0]): Row => {
            const pval = prevR ? (k === 'reg' ? 0 : k === 'parity' ? parityOf(prevR) : (prevR.m as unknown as Record<string, number>)[k]) : null;
            return { key: 'm:' + k, cells: [cell(l), cell(thLbl(k, MET.find((x) => x[0] === k)![2])), cell(valL(k, val)), cell('', { p: ok0 ? ['approved', 'Pass'] : ['rejected', 'Fail'] }), ...(prevR ? [cell(valL(k, pval!))] : [])] };
          }).concat(Object.entries(latest!.m.langs || {}).map(([lg, x]): Row => ({ key: 'lg:' + lg, cells: [cell('Accuracy · ' + lg), cell('—'), cell(pct(x)), cell(''), ...(prevR ? [cell(pct((prevR.m.langs || {})[lg]))] : [])] })))
        : [],
    },
    ...cmpSec(c, w),
    {
      title: 'Failed test cases' + (fr0 ? ' · ' + fr0.id + ' · ' + fr0.v : ''),
      empty: fr0 ? 'No failed cases.' : 'No evaluation yet.',
      cols: ['Case', 'Question', 'Observed', 'Why it failed', 'Related setting', ...(drCol ? ['In draft ' + dv!.v] : [])],
      mode: 'inline',
      rows: fr0
        ? fr0.failed.map((cid): Row => {
            const { s0, c: cs } = caseOf(D, cid);
            const w0 = whyOf(cid);
            const dr = drCol ? lastRun(D, key, dv!.v) : null;
            return {
              key: 'fc:' + cid,
              cells: [
                cell(cid, { m: true, sub: (s0 ? s0.id : '') + (cs.lang ? ' · ' + cs.lang : '') }),
                cell(cs.q, { sub: 'Expected: ' + (cs.refuse ? 'refusal' : cs.exp) }),
                cell(w0[0]),
                cell(w0[1]),
                cell(SETL[w0[2]] || w0[2]),
                ...(drCol ? [cell('', { p: !dr ? ['draft', 'Not evaluated'] : dr.running ? ['submitted', 'Evaluating'] : dr.failed.includes(cid) ? ['rejected', 'Still failing'] : ['approved', 'Passes'] })] : []),
              ],
              acts: [act('Open setting', () => c.a.openSetting(w, cid)), ...(s0 ? [act('Open case', () => c.go.evalset(s0.id))] : [])],
            };
          })
        : [],
    },
    {
      title: 'Evaluation history',
      cols: ['Run', 'Version', 'Dataset', 'When', 'Accuracy', 'Gate'],
      empty: 'No evaluations yet.',
      mode: 'inline',
      rows: runs.map((r): Row => ({ key: 'er:' + r.id, cells: [cell(r.id, { m: true }), cell(r.v), cell(r.set, { m: true }), cell(r.by + ' · ' + r.at), cell(r.running ? '—' : pct(r.m.acc)), cell('', { p: r.running ? ['submitted', 'Evaluating'] : gateOf(D, w, r).ok ? ['approved', 'Passed'] : ['rejected', 'Failed'] })] })),
    },
    {
      title: 'Evaluation datasets',
      sacts: upd ? [act('Select datasets', () => c.a.datasetsF(w))] : [],
      cols: ['Dataset', 'Cases', 'Languages', 'Owner'],
      empty: 'No datasets selected.',
      mode: 'inline',
      rows: sets.map((s0): Row => ({ key: 'es:' + s0.id, cells: [cell(s0.id, { m: true, sub: s0.n }), cell(s0.cases.length), cell([...new Set(s0.cases.map((x) => x.lang))].join(', ')), cell(s0.by, { m: true })], acts: [act('Open', () => c.go.evalset(s0.id))], onClick: () => c.go.evalset(s0.id) })),
    },
  ];
}

/** Versions tab (prototype `versionsSec`). */
export function versionsSec(c: WfCtx, w: Workflow): Section[] {
  const pv = pubOf(w), dv = draftOf(w);
  const upd = c.canUpd;
  return [
    ...corrSec(c, w),
    {
      title: 'Versions',
      sacts: [...(upd && !dv ? [act('Create draft', () => c.a.createDraft(w, ''))] : []), ...(w.vers.length > 1 ? [act('Compare versions', () => c.a.compareF(w))] : [])],
      cols: ['Version', 'Status', 'Created', 'Change note', 'Evaluation gate'],
      mode: 'inline',
      rows: w.vers.map((v): Row => ({
        key: 'v:' + v.v,
        cells: [cell(v.v, { m: true }), cell('', { p: verP(v.st) }), cell(v.by + ' · ' + v.at), cell(v.note || '—'), cell('', { p: gateL(c.D, w, v.v) })],
        acts: [
          ...(v.st === 'Draft' && upd ? [act('Publish', () => c.a.publish(w))] : []),
          ...(v.st === 'Superseded' && upd && v.cfg ? [act('Roll back', () => c.a.rollback(w, v.v))] : []),
          ...(pv && v.v !== pv.v && v.cfg ? [act('Compare with ' + pv.v, () => c.a.compare(w, pv.v, v.v), 'ghost')] : []),
        ],
      })),
    },
  ];
}

/** Execution steps of the test run or replay shown on the canvas (below the designer). */
export function execStepsSec(c: WfCtx, w: Workflow, vsel: string): Section[] {
  const k = (c.t || '') + ':' + w.id;
  const x = c.ui.wd[k];
  if (!x || x.v !== vsel || x.mode === 'design') return [];
  const T0 = c.ui.test[k];
  const testOv = x.mode === 'test' && T0 && T0.ver === vsel ? T0 : null;
  let RS: { steps?: [string, string, string, string, string?][]; path: Record<string, string> } | null = null;
  if (x.mode === 'test') RS = testOv && !testOv.running ? testOv : null;
  else {
    const runsW = c.D.wfruns.filter((r) => r.wf === w.id);
    const rr = runsW.find((r) => x.rp && r.id === x.rp.run) || (T0 && !T0.running && x.rp && x.rp.run === T0.id ? T0 : null) || runsW[0] || (T0 && !T0.running ? T0 : null);
    RS = rr || null;
  }
  if (!RS) return [];
  const cfg = x.cfg;
  const steps = RS.steps || runOrder(RS.path as Record<string, 'ok' | 'bad' | 'skip'>).map((id): [string, string, string, string, string] => {
    const n = cfg.nodes.find((y) => y[0] === id) || [id, 'agent', id, ''];
    return [n[2] || nodeL(cfg, id), n[1], RS!.path[id] === 'bad' ? 'Failed' : 'Succeeded', '', id];
  });
  return [{
    title: 'Execution steps',
    cols: ['#', 'Step', 'Type', 'Status', 'Detail'],
    mode: 'inline',
    rows: steps.map((s0, i): Row => ({
      key: 'xs:' + i,
      cells: [cell(i + 1), cell(s0[0]), cell(KL[s0[1]] || s0[1]), cell('', { p: stP(s0[2]) }), cell(s0[3] || '—')],
      acts: s0[4] ? [act('Show on canvas', () => c.a.showStep(w, s0[4]!))] : [],
    })),
  }];
}

export function workflowScreen(c: WfCtx, id: string, tab0: string | undefined, setTab: (t: string) => void, designer: (w: Workflow, vsel: string) => React.ReactNode): ScreenModel {
  if (!c.t) return noTenant('Agent Workflows');
  const { D } = c;
  const w = D.workflows.find((x) => x.id === id);
  if (!w) return notFound(id, act('Back to workflows', c.go.list), c.tn);
  const tab = wfTabOf(tab0);
  const head = { title: w.n, status: wfLifeP(w), tabs: WF_TABS, tab, setTab };
  const pv = pubOf(w), dv = draftOf(w);
  const vsel = versionOf(c, w);
  const cfg = cfgOf(w, vsel);
  const agentsIn = agentsInG(cfg);
  let sections: Section[] = [];
  if (tab === 'overview')
    sections = [
      {
        form: true,
        sacts: [act('Open designer', () => setTab('designer'))],
        rows: [
          fr('Purpose', w.purpose),
          fr('Lifecycle', wfLifeP(w)[1], pv ? 'Published ' + pv.v + ' · ' + pv.at + (dv ? ' · draft ' + dv.v : '') : 'Not published'),
          fr('Entry point', w.entry),
          fr('Orchestration', cfg.mode, cfg.nodes.length - 2 + ' steps · ' + agentsIn.length + ' agents'),
          ...killRows(c, w),
          fr('Fallback and error handling', cfg.fail),
          fr('Execution limits', cfg.limits.dur + ' · ' + cfg.limits.steps + ' steps'),
        ],
      },
      {
        title: 'Participating agents',
        empty: 'No agents on the canvas yet.',
        cols: ['Agent', 'Role in this workflow', 'Published version', 'Status'],
        mode: 'inline',
        rows: agentsIn.map((a0): Row => {
          const ag = agentOf(D, a0);
          const n = cfg.nodes.find((x) => x[2] === a0);
          return {
            key: 'pa:' + a0,
            cells: [cell(a0, { m: true }), cell(n && n[3] ? n[3] : '—'), cell(ag && ag.st !== 'Draft' ? ag.v : 'None'), cell('', { p: !ag ? ['rejected', 'Not found'] : ag.dis ? ['rejected', 'Disabled'] : agentLifeP(ag) })],
            acts: ag ? [act('Open agent', () => c.go.agent(a0))] : [],
          };
        }),
      },
    ];
  if (tab === 'designer') sections = [{ custom: designer(w, vsel) }, ...execStepsSec(c, w, vsel)];
  if (tab === 'eval') sections = evalSec(c, w);
  if (tab === 'versions') sections = versionsSec(c, w);
  if (tab === 'metrics') {
    const m = w.m;
    const runs = D.wfruns.filter((r) => r.wf === w.id);
    sections = [
      { form: true, title: 'Last 7 days', rows: [fr('Runs', String(m[0])), fr('Success rate', m[1] ? m[1] + '%' : '—'), fr('Latency p95', m[2]), fr('Fallback rate', m[3])] },
      {
        title: 'Recent runs',
        empty: 'No runs yet.',
        cols: ['Run', 'Version', 'Caller', 'Status', 'When'],
        mode: 'inline',
        rows: runs.map((r): Row => ({
          key: 'wr:' + r.id,
          cells: [cell(r.id, { m: true, sub: r.q }), cell(r.v), cell(r.caller, { m: true }), cell('', { p: stP(r.st), tip: r.reason || '' }), cell(r.at)],
          acts: [act('Open', () => c.go.run(r.id)), act('Replay', () => c.a.replay(w, r.id, r.v))],
        })),
      },
    ];
  }
  return { head, sections };
}

// ================================================================ TENANT AGENTS MAP
export function agentsMapScreen(c: WfCtx, sel: string | null, setSel: (s: string | null) => void): ScreenModel {
  if (!c.t) return noTenant('Tenant Agents Map');
  const { D } = c;
  const vis = D.agents.filter((a) => c.canRead(a.id) && a.st !== 'Archived');
  const pick = (k: string) => () => setSel(sel === k ? null : k);
  const nodes: DiagramSpec['nodes'] = vis
    .map((a, i) => ({ id: 'a:' + a.id, x: 16, y: 16 + i * 74, w: 190, h: 54, l1: a.id, l2: a.dis ? 'Disabled' : 'Agent · ' + a.v, tone: (a.dis ? 'bad' : 'base') as 'bad' | 'base', sel: sel === 'a:' + a.id, click: pick('a:' + a.id) }))
    .concat(D.workflows.map((w, i) => ({ id: 'w:' + w.id, x: 300, y: 16 + i * 90, w: 190, h: 54, l1: w.n, l2: 'Workflow · ' + (pubOf(w) || w.vers[0]).v, tone: (w.dis ? 'bad' : 'out') as 'bad' | 'base', sel: sel === 'w:' + w.id, click: pick('w:' + w.id) })));
  const tl = [...new Set(vis.flatMap((a) => a.tset))];
  const toolOff = (t: string) => !!D.toolDis[t.includes(':') ? t : 'kap:' + t];
  tl.forEach((t, i) => nodes.push({ id: 't:' + t, x: 590, y: 16 + i * 60, w: 170, h: 46, l1: toolName(t), l2: toolOff(t) ? 'Disabled' : 'Tool', tone: toolOff(t) ? 'bad' : 'ref' }));
  const edges: DiagramSpec['edges'] = [
    ...D.workflows.flatMap((w) => agentsInG(cfgOf(w)).filter((x) => vis.some((a) => a.id === x)).map((x): DiagramSpec['edges'][number] => ({ a: 'a:' + x, b: 'w:' + w.id, tone: sel === 'a:' + x || sel === 'w:' + w.id ? 'brand' : undefined }))),
    ...vis.flatMap((a) => a.tset.map((t): DiagramSpec['edges'][number] => ({ a: 'a:' + a.id, b: 't:' + t, dash: '2 3', tone: 'ref', noArrow: true }))),
  ];
  const sa = sel && sel.startsWith('a:') ? agentOf(D, sel.slice(2)) : null;
  const sw = sel && sel.startsWith('w:') ? D.workflows.find((w) => w.id === sel.slice(2)) : null;
  const inspect: DiagramSpec['inspect'] = sa
    ? [['Agent', sa.id], ['Purpose', sa.purpose], ['Model', modelL(sa)], ['Workflows', wfUsing(D, sa.id).map((w) => w.n).join(', ') || 'None'], ['Tools', sa.tset.map(toolName).join(', ') || 'None'], ['Collections', sa.colls.join(', ') || 'None']]
    : sw
      ? [['Workflow', sw.n], ['Agents', agentsInG(cfgOf(sw)).join(', ')], ['Entry point', sw.entry]]
      : [];
  return {
    head: {
      title: 'Tenant Agents Map',
      acts: [act('Agent workflows', c.go.list), ...(c.t === 'sceai' ? [act('Ask AI pipeline map', c.go.pipeline)] : [])],
    },
    sections: [{
      sacts: sa ? [act('Open ' + sa.id, () => c.go.agent(sa.id))] : sw ? [act('Open ' + sw.n, () => c.go.wf(sw.id, 'designer'))] : [],
      note: 'Select an agent or a workflow to see how they are connected.',
      dgm: {
        nodes,
        edges,
        legend: [['Agent', 'base'], ['Router or orchestrator', 'run'], ['Workflow', 'out'], ['Tool', 'ref'], ['Disabled', 'bad']],
        inspect,
        inspectT: sa || sw ? 'Selected' : '',
      },
    }],
  };
}
