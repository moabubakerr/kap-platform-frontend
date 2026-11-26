/**
 * AI Agent Factory (v35): Agents, Agent detail (Overview · Configuration ·
 * Knowledge & Tools · Testing · Evaluation · Versions · Metrics), Evaluation
 * Datasets and Evaluation Dataset as ScreenModels. Port of the prototype's
 * `agentHub` screens agents / agent / evalsets / evalset. Pure: data,
 * filters, permissions and callbacks in; model out.
 */
import { act, cell, fr } from '@/engine/build';
import type { Action, Filters, Row, ScreenModel, Section } from '@/engine/types';
import type { DhCollection, DhDocument, EntityInst } from '@/v35/data/businessData';
import type { IamPolicy, ResType } from '@/v35/iam';
import { cfgOf, draftOf, pubOf, resolveModel, wfUsing, type AfTenant, type AfTenantKey, type Agent, type AgentCfg, type AgentFactoryData, type EvalCase, type EvalSet, type Version } from '@/v35/data/agentFactory';
import {
  caseOf, draftTools, fresh, gateL, gateOf, lastRun, lifeP, MET, modelL, modelOk, parityOf, pct, pubTools, runsOf, SETL, stP, stPill, thrOf, toolInv, valL, verP, whyOf,
  type TestResult,
} from './logic';
import { LIVE_STATUS, liveAgentSections, liveAgentsScreen, SESSION_EVAL, SESSION_VERSIONS, type AgentsLiveCtx } from './liveBuild';

// ---------------------------------------------------------------- context
export interface AgentsNav {
  agents: () => void;
  agent: (id: string, tab?: string) => void;
  evalsets: () => void;
  evalset: (id: string) => void;
  workflow: (id: string, tab?: string) => void;
  collections: () => void;
  collection: (id: string, tab?: string) => void;
  dataset: (id: string, tab?: string) => void;
  document: (id: string) => void;
  entities: () => void;
  tools: () => void;
  policies: () => void;
  audit: () => void;
  run: (id: string) => void;
  monitoring: () => void;
  playground: () => void;
}

/** Input for "Create evaluation test case" from an execution. */
export interface CaseSeed { q: string; key: string; lang: string; cat: string; run: string; evid: string; exp?: string }

export interface AgentsActs {
  /** opens the create wizard; `preset` pre-selects collections (live tenant) */
  create: (preset?: { colls?: string[] }) => void;
  createDraft: (key: string, note?: string, thenTab?: string) => void;
  archive: (a: Agent) => void;
  disable: (key: string) => void;
  reenable: (key: string) => void;
  editCfg: (key: string, ver: string, label: string, k: keyof AgentCfg, typ?: 'text' | 'select' | 'chips' | 'textarea', opts?: string[]) => void;
  editGov: (key: string, ver: string) => void;
  editEnt: (a: Agent) => void;
  addTool: (a: Agent) => void;
  assignTool: (aId: string, tkey: string, add: boolean) => void;
  runTest: (key: string) => void;
  caseFromRun: (p: CaseSeed) => void;
  runEvalForm: (key: string) => void;
  runEval: (key: string, v: string, set: string) => void;
  thresholds: (key: string) => void;
  datasets: (key: string) => void;
  publish: (key: string) => void;
  rollback: (key: string, v: string) => void;
  compare: (key: string, v1: string, v2: string) => void;
  compareForm: (key: string) => void;
  openSetting: (key: string, cid: string) => void;
  backToEval: (key: string) => void;
  dismissFocus: () => void;
  createSet: () => void;
  editCase: (setId: string, c: EvalCase | null) => void;
  removeCase: (setId: string, c: EvalCase) => void;
}

export interface Focus { key: string; k: string; cid: string }

export interface AgentsCtx {
  t: AfTenantKey;
  TN: string;
  af: AgentFactoryData;
  D: AfTenant;
  /** collections assigned to each agent (Business Data Hub) */
  agColl: Record<string, string[]>;
  biz: { collections: DhCollection[]; ontoTypes: string[]; inst: EntityInst[]; documents: DhDocument[]; policies: IamPolicy[]; pipelines: { id: string; entTypes: string[] }[] };
  can: (perm: string, type: ResType, id?: string) => boolean;
  /** latest test run per 'agent:<id>' */
  tests: Record<string, TestResult>;
  focus: Focus | null;
  lastCase: { cid: string; sid: string; tk: string } | null;
  go: AgentsNav;
  a: AgentsActs;
  /** set for the live tenant: agents come from KAP (liveBuild.ts) */
  live?: AgentsLiveCtx;
}

export type ListFilters = Record<string, string>;

export const AGENT_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'config', label: 'Configuration' },
  { value: 'knowledge', label: 'Knowledge & Tools' },
  { value: 'testing', label: 'Testing' },
  { value: 'eval', label: 'Evaluation' },
  { value: 'versions', label: 'Versions' },
  { value: 'metrics', label: 'Metrics' },
];

const canRead = (c: AgentsCtx, a: string) => c.can('agent:read', 'agent', a);
const canUpd = (c: AgentsCtx, a: string) => c.can('agent:update', 'agent', a);
const canAppr = (c: AgentsCtx, a: string) => c.can('agent:oversee', 'agent', a);
const canOps = (c: AgentsCtx, a: string) => c.can('agent:oversee', 'agent', a) || c.can('tenant:configure', 'tenant', '*');
const row = (key: string, cells: Row['cells'], acts: Action[] = []): Row => ({ key, cells, acts });
const keyOf = (a: Agent) => 'agent:' + a.id;
/** access policies on a resource key (prototype iamPolOf) */
const polOf = (c: AgentsCtx, key: string) => {
  let cls = '';
  if (key.startsWith('document:')) cls = c.biz.documents.find((x) => x.id === key.slice(9))?.cls ?? '';
  return c.biz.policies.filter((p) => p.t === c.t && (cls && p.kind === 'Classification' ? p.n === cls : p.res.includes(key)));
};
const deniedModel = (c: AgentsCtx, what: string): ScreenModel => ({ head: { title: 'This ' + what + ' is not available' }, sections: [], denied: "It does not exist in " + c.TN + " or you don't have access." });

// ================================================================ Agents
export function agentsScreen(c: AgentsCtx, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  if (c.live) return liveAgentsScreen(c, F, setF);
  const { D } = c;
  const all = D.agents.filter((a) => canRead(c, a.id));
  const LS = (a: Agent) => lifeP(a)[1];
  const st = F.st || 'Any status';
  const rows = all.filter((a) => (!F.q || (a.id + ' ' + a.purpose).toLowerCase().includes(F.q.toLowerCase())) && (st === 'Any status' || LS(a) === st));
  const opts = ['Any status'].concat([...new Set(all.map(LS))]);
  const filters: Filters = {
    q: F.q ?? '',
    qLabel: 'Search',
    qPlaceholder: 'Agent name or purpose',
    setQ: (q) => setF({ ...F, q }),
    main: [{ label: 'Status', value: st, options: opts, onChange: (v) => setF({ ...F, st: v }) }],
    chips: st !== 'Any status' ? [{ l: st, x: () => setF({ ...F, st: 'Any status' }) }] : [],
    clear: () => setF({}),
    count: rows.length + ' of ' + all.length + ' agents',
  };
  return {
    head: { title: 'Agents', acts: [act('Evaluation datasets', c.go.evalsets)], add: c.can('agent:create', 'agent', '*') ? act('Create agent', c.a.create, 'primary') : undefined },
    filters,
    sections: [
      {
        empty: 'No agents match the filters.',
        cols: ['Agent', 'Status', 'Active version', 'Model', 'Knowledge', 'Tools', 'Workflows'],
        mode: 'inline',
        rows: rows.map((a) => {
          const pv = pubOf(a);
          const dv = draftOf(a);
          const cfg = cfgOf(a);
          const ws = wfUsing(D, a.id);
          const pt = pubTools(c.af, c.t, a.id);
          const dt = draftTools(D, a.id);
          return {
            key: 'a:' + a.id,
            cells: [
              cell(a.id, { m: true, sub: a.purpose }),
              cell('', { p: lifeP(a) }),
              cell(pv ? pv.v : '—', { sub: dv ? 'Draft ' + dv.v : '' }),
              cell(modelL(c.af, c.t, a.id, cfg), { sub: cfg.fb && cfg.fb !== 'None' ? 'Fallback ' + cfg.fb : '' }),
              cell((c.agColl[a.id] || []).join(', ') || '—'),
              cell(String(pt.length), { sub: dt && dt.length !== pt.length ? dt.length + ' in draft' : '' }),
              cell(ws.map((w) => w.n).join(', ') || '—'),
            ],
            acts: [act('Open', () => c.go.agent(a.id))].concat(ws.length ? [act('Workflows', () => c.go.workflow(ws[0].id, 'designer'))] : []),
            onClick: () => c.go.agent(a.id),
          };
        }),
      },
    ],
  };
}

// ================================================================ shared sections (agents; key = 'agent:<id>')

function killRows(c: AgentsCtx, a: Agent): Row[] {
  const key = keyOf(a);
  if (!canOps(c, a.id)) return a.dis ? [fr('Operational state', 'Disabled (emergency)', a.dis.by + ' · ' + a.dis.at + ' · ' + a.dis.reason)] : [];
  return a.dis
    ? [fr('Operational state', 'Disabled (emergency)', a.dis.by + ' · ' + a.dis.at + ' · ' + a.dis.reason + ' · audit ' + a.dis.ref, [act('View audit record', c.go.audit), act('Re-enable', () => c.a.reenable(key))])]
    : [fr('Operational state', 'Enabled', 'Emergency disable stops all executions at once', [act('Emergency disable', () => c.a.disable(key), 'ghost')])];
}

const PS: Record<string, [Section['badgeP'] & string, string]> = { done: ['approved', 'Done'], next: ['submitted', 'Next'], fail: ['rejected', 'Failed'], todo: ['draft', 'To do'], na: ['draft', 'Not required'], wait: ['hold', 'Waiting'] };

/** Correction / release progress of the open draft (prototype corrSec). */
export function corrSec(c: AgentsCtx, a: Agent): Section[] {
  const { D } = c;
  const key = keyOf(a);
  const pv = pubOf(a);
  const dv = draftOf(a);
  const upd = canUpd(c, a.id);
  const tv = dv || a.vers.find((v) => v.st === 'Published' && v.at === 'just now') || null;
  if (!tv) return [];
  const base = runsOf(D, key).find((r) => !r.running && r.v !== tv.v && (r.failed.length || !gateOf(D, key, r).ok)) || null;
  const fixRun = lastRun(D, key, tv.v);
  const done = !!fixRun && !fixRun.running;
  const fixed = base && done ? base.failed.filter((x) => !fixRun!.failed.includes(x)) : [];
  const still = base && done ? fixRun!.failed : [];
  const g = done ? gateOf(D, key, fixRun!) : null;
  const setId = (a.evSets || [])[0] || base?.set || D.evalsets[0]?.id || '';
  const fr0 = fixRun && fresh(D, key, fixRun);
  const S: [string, string, string, Action[]][] = [
    ['Failure found', base ? 'done' : 'na', base ? base.id + ' on ' + base.v + ' · ' + (base.failed.length ? base.failed.length + ' failed: ' + base.failed.join(', ') : 'gate failed') : /job|run/i.test(tv.note || '') ? tv.note : 'No failed evaluation', base && base.failed[0] ? [act('Open setting', () => c.a.openSetting(key, base.failed[0]))] : []],
    ['Correction drafted', 'done', tv.v + (tv.note ? ' · ' + tv.note : ''), [act('Compare', () => c.a.compare(key, (pv || a.vers[1] || tv).v, tv.v))]],
    [
      'Re-evaluated',
      !fixRun ? 'todo' : fixRun.running ? 'wait' : !fr0 ? 'todo' : g!.ok ? 'done' : 'fail',
      !fixRun ? 'Not evaluated yet' : fixRun.running ? fixRun.id + ' running' : !fr0 ? 'Configuration changed after ' + fixRun.id + ' · evaluate again' : fixRun.id + ' · gate ' + (g!.ok ? 'passed' : 'failed') + (fixed.length ? ' · fixes ' + fixed.join(', ') : '') + (still.length ? ' · still failing ' + still.join(', ') : ''),
      upd && (!fixRun || (!fixRun.running && (!g!.ok || !fr0))) && tv.st === 'Draft' ? [act('Run evaluation', () => c.a.runEval(key, tv.v, fixRun?.set || setId))] : [],
    ],
    ['Published', tv.st === 'Published' ? 'done' : 'todo', tv.st === 'Published' ? tv.v + ' is the published version' : 'Published version is ' + (pv?.v || 'none'), upd && tv.st === 'Draft' && !!g?.ok && !!fr0 ? [act('Publish', () => c.a.publish(key))] : []],
  ];
  if (!base) {
    S.shift();
    S[0][0] = 'Change drafted';
  }
  let nx = false;
  const rows = S.map(([l, s0, d0, a0], i) => {
    let p = PS[s0];
    if (!nx && (s0 === 'todo' || s0 === 'fail' || s0 === 'wait')) {
      nx = true;
      if (s0 === 'todo') p = PS.next;
    }
    return row('cp:' + i, [cell(i + 1 + '. ' + l), cell('', { p }), cell(d0)], a0);
  });
  return [{ title: (base ? 'Correction progress · ' : 'Release progress · ') + tv.v, cols: ['Step', 'Status', 'Detail'], mode: 'inline', rows }];
}

/** Versions list with publish / roll back (prototype versionsSec). */
export function versionsSec(c: AgentsCtx, a: Agent): Section[] {
  const key = keyOf(a);
  const dv = draftOf(a);
  const upd = canUpd(c, a.id);
  return corrSec(c, a).concat([
    {
      title: 'Versions',
      sacts: (upd && !dv && a.st !== 'Archived' ? [act('Create draft', () => c.a.createDraft(key, ''))] : []).concat(a.vers.length > 1 ? [act('Compare versions', () => c.a.compareForm(key))] : []),
      cols: ['Version', 'Status', 'Created', 'Change note', 'Evaluation gate'],
      mode: 'inline',
      rows: a.vers.map((v) =>
        row(
          'v:' + v.v,
          [cell(v.v, { m: true }), cell('', { p: verP(v.st) }), cell(v.by + ' · ' + v.at), cell(v.note || '—'), cell('', { p: gateL(c.D, key, v.v) })],
          ([] as Action[]).concat(v.st === 'Draft' && upd ? [act('Publish', () => c.a.publish(key))] : []).concat(v.st === 'Superseded' && upd ? [act('Roll back', () => c.a.rollback(key, v.v))] : []),
        ),
      ),
    },
  ]);
}

/** Version comparison of the last evaluated versions (prototype cmpSec). */
function cmpSec(c: AgentsCtx, a: Agent): Section[] {
  const { D } = c;
  const key = keyOf(a);
  const vs = a.vers.filter((v) => lastRun(D, key, v.v) && !lastRun(D, key, v.v)!.running).slice(0, 3);
  if (vs.length < 2) return [];
  const R = vs.map((v) => lastRun(D, key, v.v)!);
  const G0 = R.map((r) => gateOf(D, key, r));
  return [
    {
      title: 'Version comparison',
      cols: ['Metric'].concat(vs.map((v, i) => v.v + ' · ' + v.st + ' · ' + R[i].id)),
      mode: 'inline',
      rows: MET.map(([k, l]) =>
        row('vc:' + k, [cell(l)].concat(G0.map((g) => {
          const x = g.res.find((y) => y[0] === k)!;
          return cell(valL(k, x[2]) + (x[4] ? '' : ' ✕'), { sub: x[4] ? '' : 'Below threshold' });
        }))),
      ).concat([
        row('vc:fc', [cell('Failed cases')].concat(R.map((r) => cell(r.failed.length ? r.failed.join(', ') : 'None')))),
        row('vc:g', [cell('Evaluation gate')].concat(G0.map((g) => cell('', { p: g.ok ? ['approved', 'Passed'] : ['rejected', 'Failed'] })))),
      ]),
    },
  ];
}

/** Evaluation tab (prototype evalSec). */
export function evalSec(c: AgentsCtx, a: Agent): Section[] {
  const { D } = c;
  const key = keyOf(a);
  const pv = pubOf(a);
  const dv = draftOf(a);
  const th = thrOf(D, a);
  const upd = canUpd(c, a.id) || canAppr(c, a.id);
  const runs = runsOf(D, key);
  const sets = D.evalsets.filter((s0) => (a.evSets || []).includes(s0.id));
  const latest = runs.find((r) => !r.running) || null;
  const g = latest ? gateOf(D, key, latest) : null;
  const thLbl = (k: string, d0: string) => (k === 'reg' ? '≥ ' + th.reg : k === 'parity' ? '≤ ' + th.parity : (d0 === 'max' ? '≤ ' : '≥ ') + pct(th[k as keyof typeof th]));
  const pr = pv && latest && latest.v !== pv.v ? lastRun(D, key, pv.v) || null : null;
  const fr0 = latest && latest.failed.length ? latest : runs.find((r) => !r.running && r.failed.length) || latest;
  const showDraftCol = !!dv && !!fr0 && fr0.v !== dv.v;
  const dr = showDraftCol ? lastRun(D, key, dv!.v) : undefined;
  const out: Section[] = [
    {
      form: true,
      title: 'Evaluation gate',
      sacts: upd ? [act('Run evaluation', () => c.a.runEvalForm(key)), act('Edit thresholds', () => c.a.thresholds(key))] : [],
      rows: [
        fr('Latest result', latest ? latest.id + ' · ' + latest.v + ' · ' + latest.set : 'Not evaluated', latest ? latest.by + ' · ' + latest.at : ''),
        fr('Gate', g ? (g.ok ? 'Passed' : 'Failed · ' + g.res.filter((x) => !x[4]).map((x) => x[1]).join(', ')) : '—', dv ? 'Draft ' + dv.v + ': ' + gateL(D, key, dv.v)[1] : 'No draft'),
        fr('Thresholds', Object.keys(a.thr || {}).length ? 'Custom for this agent' : 'Tenant defaults', ''),
      ].concat(runs.some((r) => r.running) ? [fr('In progress', runs.filter((r) => r.running).map((r) => r.id + ' · ' + r.v).join(', '))] : []),
    },
    {
      title: 'Quality metrics',
      cols: ['Metric', 'Threshold'].concat(latest ? [latest.v + ' · ' + latest.id, 'Result'] : []).concat(pr ? [pv!.v + ' (active)'] : []),
      mode: 'inline',
      empty: 'Run an evaluation to see results.',
      rows: g
        ? g.res
            .map(([k, l, val, , ok0]) => {
              const pval = pr ? (k === 'reg' ? 0 : k === 'parity' ? parityOf(pr) : (pr.m as unknown as Record<string, number>)[k]) : null;
              return row('m:' + k, [cell(l), cell(thLbl(k, MET.find((x) => x[0] === k)![2])), cell(valL(k, val)), cell('', { p: ok0 ? ['approved', 'Pass'] : ['rejected', 'Fail'] })].concat(pr ? [cell(valL(k, pval!))] : []));
            })
            .concat(Object.entries(latest!.m.langs || {}).map(([lg, x]) => row('lg:' + lg, [cell('Accuracy · ' + lg), cell('—'), cell(pct(x)), cell('')].concat(pr ? [cell(pct((pr.m.langs || {})[lg]))] : []))))
        : [],
    },
    ...cmpSec(c, a),
    {
      title: 'Failed test cases' + (fr0 ? ' · ' + fr0.id + ' · ' + fr0.v : ''),
      empty: fr0 ? 'No failed cases.' : 'No evaluation yet.',
      cols: ['Case', 'Question', 'Observed', 'Why it failed', 'Related setting'].concat(showDraftCol ? ['In draft ' + dv!.v] : []),
      mode: 'inline',
      rows: fr0
        ? fr0.failed.map((cid) => {
            const { s0, c: tc } = caseOf(D, cid);
            const w0 = whyOf(key, cid);
            return row(
              'fc:' + cid,
              [cell(cid, { m: true, sub: (s0 ? s0.id : '') + (tc.lang ? ' · ' + tc.lang : '') }), cell(tc.q, { sub: 'Expected: ' + (tc.refuse ? 'refusal' : tc.exp) }), cell(w0[0]), cell(w0[1]), cell(SETL[w0[2]] || w0[2])].concat(
                showDraftCol ? [cell('', { p: !dr ? ['draft', 'Not evaluated'] : dr.running ? ['submitted', 'Evaluating'] : dr.failed.includes(cid) ? ['rejected', 'Still failing'] : ['approved', 'Passes'] })] : [],
              ),
              [act('Open setting', () => c.a.openSetting(key, cid))].concat(s0 ? [act('Open case', () => c.go.evalset(s0.id))] : []),
            );
          })
        : [],
    },
    {
      title: 'Evaluation history',
      cols: ['Run', 'Version', 'Dataset', 'When', 'Accuracy', 'Gate'],
      mode: 'inline',
      empty: 'No evaluations yet.',
      rows: runs.map((r) => row('er:' + r.id, [cell(r.id, { m: true }), cell(r.v), cell(r.set, { m: true }), cell(r.by + ' · ' + r.at), cell(r.running ? '—' : pct(r.m.acc)), cell('', { p: r.running ? ['submitted', 'Evaluating'] : gateOf(D, key, r).ok ? ['approved', 'Passed'] : ['rejected', 'Failed'] })])),
    },
    {
      title: 'Evaluation datasets',
      sacts: upd ? [act('Select datasets', () => c.a.datasets(key))] : [],
      cols: ['Dataset', 'Cases', 'Languages', 'Owner'],
      mode: 'inline',
      empty: 'No datasets selected.',
      rows: sets.map((s0) => ({ ...row('es:' + s0.id, [cell(s0.id, { m: true, sub: s0.n }), cell(String(s0.cases.length)), cell([...new Set(s0.cases.map((x) => x.lang))].join(', ')), cell(s0.by, { m: true })], [act('Open', () => c.go.evalset(s0.id))]) })),
    },
  ];
  return corrSec(c, a).concat(out);
}

/** Testing tab (prototype testSec). */
export function testSec(c: AgentsCtx, a: Agent): Section[] {
  const key = keyOf(a);
  const t0 = c.tests[key];
  const dv = draftOf(a);
  const exec = c.can('agent:execute', 'agent', a.id) || canUpd(c, a.id);
  const secs: Section[] = [
    {
      form: true,
      title: 'Test run',
      sacts: (exec ? [act('Run test', () => c.a.runTest(key))] : []).concat([act('Open Playground', c.go.playground, 'ghost')]),
      rows: t0
        ? [
            fr('Version', t0.ver, t0.ver === dv?.v ? 'Draft configuration' : 'Published configuration'),
            fr('Request', t0.q, t0.lang),
            fr('Result', t0.running ? 'Running…' : t0.st, t0.err || ''),
            fr('Answer', t0.running ? '—' : t0.answer || '—'),
          ].concat(
            !t0.running && t0.st !== 'Succeeded'
              ? [fr('Next step', 'Turn this test into an evaluation test case', '', [act('Create evaluation test case', () => c.a.caseFromRun({ q: t0.q, key, lang: t0.lang, cat: t0.err || 'Unexpected answer', run: t0.id, evid: t0.evid.map((e) => e[0]).join(', ') }))])]
              : [],
          )
        : [fr('No test run yet', 'Choose a version and a request', '')],
    },
  ];
  if (t0) {
    const done = !t0.running;
    secs.push(
      { title: 'Tool invocations', empty: 'No tool calls.', cols: ['Tool', 'Arguments', 'Result', 'Time', 'Status'], mode: 'inline', rows: (done ? t0.tools : []).map((x, i) => row('tt:' + i, [cell(x[0], { m: true }), cell(x[1], { m: true }), cell(x[2]), cell(x[3]), cell('', { p: stP(x[4]) })])) },
      { title: 'Evidence', empty: 'No evidence retrieved.', cols: ['Source', 'Location'], mode: 'inline', rows: (done ? t0.evid : []).map((x, i) => row('te:' + i, [cell(x[0], { m: true }), cell(x[1])])) },
      { title: 'Execution trace', cols: ['Step', 'Detail', 'Time', 'Status'], mode: 'inline', rows: (done ? t0.trace : []).map((x, i) => row('tr:' + i, [cell(x[0]), cell(x[1]), cell(x[2] || '—'), cell('', { p: stP(x[3]) })])) },
    );
  }
  return secs;
}

/** "Investigating failed case" banner on the configuration tab (prototype focusSec). */
function focusSec(c: AgentsCtx, key: string, cfg: AgentCfg, ver: Version<AgentCfg>): Section[] {
  const f = c.focus;
  if (!f || f.key !== key) return [];
  const w0 = whyOf(key, f.cid);
  const cur = (cfg as unknown as Record<string, unknown>)[f.k];
  const val = Array.isArray(cur) ? cur.join(', ') : String(cur == null ? '—' : cur);
  return [
    {
      form: true,
      title: 'Investigating failed case ' + f.cid,
      sacts: [act('Back to Evaluation', () => c.a.backToEval(key)), act('Dismiss', c.a.dismissFocus, 'ghost')],
      rows: [fr('Why it failed', w0[1], w0[0]), fr('Related setting', SETL[f.k] || f.k, 'Current value in ' + ver.v + ': ' + val.slice(0, 120))].concat(
        ver.st !== 'Draft' ? [fr('Next step', 'Create a draft to change this setting', 'The published version is not changed')] : [fr('Next step', 'Change the setting below, then run the evaluation on ' + ver.v)],
      ),
    },
  ];
}

export const GOV_REQ: Record<string, string> = {
  Informational: 'Evidence shown with every answer',
  'Decision support': 'Evidence and limitations shown with every answer · answers marked as decision support',
  'High impact': 'Evidence, limitations and confidence shown · answers marked for human review by the consuming application · every answer logged for audit',
};
export const GUARDS = ['Prompt injection', 'Jailbreak', 'Grounding required', 'Numeric verifier', 'Data-leak guard', 'PII masking'];

// ================================================================ Agent
export function agentScreen(c: AgentsCtx, id: string, tabIn: string | undefined, setTab: (v: string) => void): ScreenModel {
  const { D } = c;
  const a = D.agents.find((x) => x.id === id);
  if (!a && c.live?.loading) return { head: { title: id }, sections: [{ callout: 'Loading the agent from KAP…' }] };
  if (!a || !canRead(c, a.id)) return deniedModel(c, 'agent');
  const key = keyOf(a);
  const tab = AGENT_TABS.some((x) => x.value === tabIn) ? tabIn! : 'overview';
  if (c.live) {
    const ls = liveAgentSections(c, a, tab, setTab);
    const sections = ls ?? ([{ callout: tab === 'versions' ? SESSION_VERSIONS : SESSION_EVAL }] as Section[]).concat(tab === 'versions' ? versionsSec(c, a) : evalSec(c, a));
    return { head: { title: a.id, tabs: AGENT_TABS, tab, setTab, status: LIVE_STATUS }, sections };
  }
  const pv = pubOf(a);
  const dv = draftOf(a);
  const upd = canUpd(c, a.id);
  const ws = wfUsing(D, a.id);
  let sections: Section[] = [];

  if (tab === 'overview') {
    const cfg = cfgOf(a);
    const ml = modelL(c.af, c.t, a.id, cfg);
    sections = [
      {
        form: true,
        sacts: (upd && a.st !== 'Archived' ? [act(dv ? 'Edit draft ' + dv.v : 'Create draft', () => (dv ? setTab('config') : c.a.createDraft(key, '', 'config')))] : []).concat(upd && a.st !== 'Archived' ? [act('Archive', () => c.a.archive(a), 'ghost')] : []),
        rows: [fr('Purpose', a.purpose), fr('Lifecycle', lifeP(a)[1], pv ? 'Published ' + pv.v + ' · ' + pv.at : 'Not published'), fr('Draft', dv ? dv.v + ' · ' + dv.by + ' · ' + dv.at : 'None', dv ? dv.note : '')]
          .concat(killRows(c, a))
          .concat([
            fr('Primary model', ml, modelOk(c.af, ml) ? '' : 'Model is disabled in the Model Registry'),
            fr('Workflows', ws.map((w) => w.n).join(', ') || 'Not used in a workflow', 'One definition shared by all workflows', ws.length ? [act('Open', () => c.go.workflow(ws[0].id, 'map'))] : []),
            fr('Owner', a.owner),
          ]),
      },
    ];
  }

  if (tab === 'config') {
    const ver = dv || pv || a.vers[0];
    const cfg = ver.cfg!;
    const ed = upd && ver.st === 'Draft';
    const editF = (lbl: string, k: keyof AgentCfg, typ?: 'text' | 'select' | 'chips' | 'textarea', opts?: string[]) => (ed ? [act('Edit', () => c.a.editCfg(key, ver.v, lbl, k, typ, opts))] : []);
    const MODELS = c.af.models.deps.filter((d) => (d.cat === 'LLM' || !d.cat) && (d.all || d.ten.includes(c.t))).map((d) => d.id);
    const gv = cfg.gov || { tier: 'Informational', esc: 'None' };
    const hrW = ws.filter((w) => (cfgOf(w).nodes || []).some((n) => n[1] === 'review' && /human/i.test((n[2] || '') + ' ' + (n[3] || ''))));
    sections = focusSec(c, key, cfg, ver).concat([
      {
        form: true,
        title: (ver.st === 'Draft' ? 'Draft ' : 'Published ') + ver.v,
        sacts: !dv && upd && a.st !== 'Archived' ? [act('Create draft to edit', () => c.a.createDraft(key, ''))] : dv && pv ? [act('Compare with ' + pv.v, () => c.a.compare(key, pv.v, dv.v))] : [],
        rows: [
          fr('System instructions', cfg.instr, '', editF('System instructions', 'instr', 'textarea')),
          fr('Primary model', String(cfg.model).startsWith('default:') ? 'Tenant default · ' + resolveModel(c.af.models, c.t, a.id).id : cfg.model, '', editF('Primary model', 'model', 'select', ['default:agent'].concat(MODELS))),
          fr('Fallback model', cfg.fb, '', editF('Fallback model', 'fb', 'select', ['None'].concat(MODELS))),
          fr('Multi-model routing', cfg.multi, '', editF('Multi-model routing', 'multi', 'select', ['None', 'Short questions to the fallback model', 'Arabic questions to the primary model', 'Oxford questions: qwen72b-prod'])),
        ],
      },
      {
        form: true,
        title: 'Execution limits and failure handling',
        rows: [
          fr('Max tool calls', String(cfg.tools), '', editF('Max tool calls', 'tools', 'select', ['0', '2', '3', '5', '6', '10', '15', '20', '25'])),
          fr('Max duration', cfg.dur, '', editF('Max duration', 'dur', 'select', ['10 s', '15 s', '30 s', '60 s', '90 s', '120 s', '180 s'])),
          fr('Retries', cfg.retries, '', editF('Retries', 'retries', 'select', ['0', '1', '2'])),
          fr('Failure handling', cfg.fail, '', editF('Failure handling', 'fail', 'select', ['Retry once, then answer with a stated limitation', 'Refuse with an explanation', 'Delegate unresolved indicators to Indicator Picker, then refuse if still unresolved', 'Hand over to a fallback agent'])),
        ],
      },
      {
        form: true,
        title: 'Governance & Oversight',
        sacts: ed ? [act('Edit', () => c.a.editGov(key, ver.v))] : [],
        rows: [
          fr('Impact tier', gv.tier, gv.tier === 'High impact' ? 'Human review of consequential business decisions is the responsibility of the consuming application' : ''),
          fr('Oversight requirements', GOV_REQ[gv.tier] || '—', 'Follow from the impact tier'),
          fr('Escalation policy', gv.esc, gv.esc === 'None' ? 'No escalation configured' : ''),
          fr('Human review steps', hrW.length ? hrW.map((w) => w.n).join(', ') : 'None', 'Configured in the Workflow Designer · separate from the impact tier', hrW.length ? [act('Open designer', () => c.go.workflow(hrW[0].id, 'designer'))] : []),
        ],
      },
      {
        form: true,
        title: 'Guardrails',
        rows: [fr('Applied guardrails', (cfg.guards || []).join(', '), 'Platform policies in the Policy Library always apply', editF('Guardrails', 'guards', 'chips', GUARDS)), fr('Policies', 'Policy Library', '', [act('Open', c.go.policies)])],
      },
    ]);
  }

  if (tab === 'knowledge') sections = knowledgeSec(c, a);
  if (tab === 'testing') sections = testSec(c, a);
  if (tab === 'eval') {
    const lc = c.lastCase && c.lastCase.tk === key ? c.lastCase : null;
    sections = (lc ? [{ form: true, rows: [fr('Test case added', lc.cid + ' · ' + lc.sid, 'Included in future regression runs', [act('Open dataset', () => c.go.evalset(lc.sid))])] } as Section] : []).concat(evalSec(c, a));
  }
  if (tab === 'versions') sections = versionsSec(c, a);
  if (tab === 'metrics') {
    const m = a.m;
    const jobsA = (D.runs || []).filter((r) => r.agent === a.id);
    const fails = jobsA.filter((r) => r.st === 'Failed');
    sections = [
      {
        form: true,
        title: 'Last 7 days',
        sacts: [act('Open Monitoring', c.go.monitoring, 'ghost')],
        rows: [
          fr('Requests', String(m[0])),
          fr('Success rate', m[1] ? m[1] + '%' : '—'),
          fr('Latency p95', m[2]),
          fr('Tool error rate', m[3]),
          fr('Model tokens', m[4] ? m[4] + 'M' : '—'),
          fr('Failures', String(fails.length), fails.map((r) => r.reason).filter((x, i, s0) => s0.indexOf(x) === i).join('; ')),
        ],
      },
      { title: 'Recent jobs', empty: 'No jobs.', cols: ['Job', 'Version', 'Caller', 'Status', 'When'], mode: 'inline', rows: jobsA.map((r) => ({ ...row('rj:' + r.id, [cell(r.id, { m: true }), cell(r.v), cell(r.caller, { m: true }), cell('', { p: stP(r.st) }), cell(r.at)], [act('Open trace', () => c.go.run(r.id))]), onClick: () => c.go.run(r.id) })) },
    ];
  }

  return { head: { title: a.id, tabs: AGENT_TABS, tab, setTab, status: lifeP(a) }, sections };
}

/** Knowledge & Tools tab. */
function knowledgeSec(c: AgentsCtx, a: Agent): Section[] {
  const { D } = c;
  const pv = pubOf(a);
  const dv = draftOf(a);
  const upd = canUpd(c, a.id);
  const verK = dv || pv || a.vers[0];
  const cfgK: Partial<AgentCfg> = verK.cfg || {};
  const ae = cfgK.ent || { mode: 'Off', hops: '—', types: [] };
  const edK = upd && a.st !== 'Archived';
  const pubE = pv?.cfg?.ent || { mode: 'Off', types: [] };
  const chgE = !!dv && JSON.stringify(pubE) !== JSON.stringify(ae);
  const srcOfT = (n: string) => {
    const m: Record<string, [string, string]> = {};
    c.biz.inst.filter((x) => x.type === n).forEach((x) => x.src.forEach(([k0, id0]) => (m[k0 + ':' + id0] = [k0, id0])));
    return Object.values(m);
  };
  const tsK = (cfgK.tset || pubTools(c.af, c.t, a.id) || []).map((x) => x.split(':').pop()!);
  const entTools = ['entity_get', 'related_entities'].filter((x) => tsK.includes(x));
  const resList: Record<string, [string, string, string]> = {};
  (c.agColl[a.id] || []).forEach((c0) => (resList['collection:' + c0] = ['collection', c0, 'Assigned collection']));
  if (ae.mode !== 'Off')
    (ae.types || []).forEach((n) =>
      srcOfT(n).forEach(([k0, id0]) => {
        const k = k0 + ':' + id0;
        if (!resList[k]) resList[k] = [k0, id0, 'Source of ' + n + ' entities'];
        else if (!/entities/.test(resList[k][2])) resList[k][2] += ' · entity source';
      }),
    );
  const resOpen = ([k0, id0]: [string, string, string]) => (k0 === 'collection' ? () => c.go.collection(id0, 'access') : k0 === 'dataset' ? () => c.go.dataset(id0, 'usage') : () => c.go.document(id0));

  const pubS = pubTools(c.af, c.t, a.id);
  const drS = draftTools(D, a.id);
  const all0 = [...new Set(pubS.concat(drS || []))];
  const inv = toolInv(c.af, D, c.t, c.TN);

  return [
    {
      form: true,
      title: 'Business Entities',
      sacts: edK ? [act('Configure', () => c.a.editEnt(a))] : [],
      rows: [
        fr('Entity context', ae.mode, (chgE ? 'Changed in draft ' + dv!.v + ' · published: ' + pubE.mode + ' · ' : '') + (ae.mode === 'Off' ? 'The agent does not use Business Entities' : 'Semantic context only · works with or without Collections')),
        fr('Allowed entity types', ae.mode === 'Off' ? '—' : (ae.types || []).join(', ')),
        fr('Relationship depth', ae.mode === 'Entities and relationships' ? ae.hops : '—'),
        fr(
          'Entity tools',
          entTools.length ? entTools.join(', ') + ' assigned' : 'None assigned',
          ae.mode === 'Off' ? 'Tools decide which operations the agent can perform' : entTools.length ? 'Operations come from the tools below · entity types do not grant operations' : 'Assign entity_get or related_entities under Tools to look up entities',
          edK && ae.mode !== 'Off' && !entTools.length ? [act('Add tool', () => c.a.addTool(a))] : [],
        ),
        fr('Access', 'Inherited from the sources', 'Callers receive only entities extracted from data they can read themselves'),
      ],
    } as Section,
  ]
    .concat(
      ae.mode === 'Off'
        ? []
        : [
            {
              title: 'Entity sources',
              empty: 'No entities of these types have been extracted yet.',
              cols: ['Entity type', 'Data sources', 'Extracted by', 'Access restrictions'],
              mode: 'inline',
              rows: (ae.types || []).map((n) => {
                const sr = srcOfT(n);
                const pols = [...new Set(sr.flatMap(([k0, id0]) => polOf(c, k0 + ':' + id0).map((p0) => p0.n)))];
                return row(
                  'es:' + n,
                  [
                    cell(n),
                    cell(sr.map((x) => x[1]).join(', ') || '—', { sub: sr.length ? sr.map((x) => (x[0] === 'dataset' ? 'Structured data' : 'Document')).filter((v0, i0, a0) => a0.indexOf(v0) === i0).join(' and ') : '' }),
                    cell(c.biz.pipelines.filter((p0) => p0.entTypes.includes(n)).map((p0) => p0.id).join(', ') || '—'),
                    cell(pols.join(', ') || 'None'),
                  ],
                  [act('Open in Business Entities', c.go.entities)],
                );
              }),
            },
          ],
    )
    .concat([
      {
        title: 'Collections',
        sacts: upd ? [act('Manage in Collections', c.go.collections)] : [],
        empty: 'No collections assigned. The agent can still use tools and Business Entities.',
        cols: ['Collection', 'Access policies', 'Contents'],
        mode: 'inline',
        rows: (c.agColl[a.id] || []).map((cid) => {
          const c0 = c.biz.collections.find((x) => x.id === cid) || { ds: [], docs: [] };
          return row('kc:' + cid, [cell(cid, { m: true }), cell(polOf(c, 'collection:' + cid).map((p) => p.n).join(', ') || 'None'), cell(c0.ds.length + ' datasets · ' + c0.docs.length + ' documents')], [act('Open', () => c.go.collection(cid, 'access'))]);
        }),
      },
      {
        title: 'Tools' + (dv ? ' · draft ' + dv.v : ''),
        sacts: edK ? [act('Add tool', () => c.a.addTool(a))] : [],
        empty: 'No tools assigned.',
        cols: ['Tool', 'Source', 'Effect', 'Status', 'Change in draft'],
        mode: 'inline',
        rows: all0.map((k) => {
          const t = inv.find((x) => x.key === k) || { n: k.split(':').pop()!, srcL: k.split(':')[0], fx: '—', stF: 'Unavailable' };
          const added = !!drS && drS.includes(k) && !pubS.includes(k);
          const removed = !!drS && !drS.includes(k) && pubS.includes(k);
          return row('kt:' + k, [cell(t.n, { m: true }), cell(t.srcL), cell(t.fx), cell('', { p: stPill(t.stF) }), cell(added ? 'Added' : removed ? 'Removed' : '—')], [act('Inspect', c.go.tools)].concat(edK ? [removed ? act('Restore', () => c.a.assignTool(a.id, k, true)) : act('Remove', () => c.a.assignTool(a.id, k, false), 'ghost')] : []));
        }),
      },
      {
        title: 'Inherited access restrictions',
        empty: 'No protected resources are used by this agent.',
        cols: ['Resource', 'Type', 'Used for', 'Access policies', 'Cleared groups'],
        mode: 'inline',
        rows: Object.entries(resList).map(([k, x]) => {
          const pols = polOf(c, k);
          return row(
            'ar:' + k,
            [
              cell(x[1], { m: true }),
              cell(({ collection: 'Collection', dataset: 'Structured dataset', document: 'Document' } as Record<string, string>)[x[0]]),
              cell(x[2]),
              cell(pols.map((p0) => p0.n + ' · ' + p0.kind).join(', ') || 'None'),
              cell(pols.length ? [...new Set(pols.flatMap((p0) => p0.cleared.map((g0) => (g0 === '*' ? 'everyone with read access' : g0))))].join(', ') : '—'),
            ],
            [act('Open access settings', resOpen(x))],
          );
        }),
      },
      { form: true, rows: [fr('How callers get data', "Their own access, not the agent's", 'Assigning a collection, dataset or tool to this agent does not give callers access. Each caller needs a read grant and clearance under every policy above. Manage access on the resource itself.')] },
    ]);
}

// ================================================================ Evaluation datasets
const usedBy = (D: AfTenant, id: string) => D.agents.filter((a) => (a.evSets || []).includes(id)).map((a) => a.id).concat(D.workflows.filter((w) => (w.evSets || []).includes(id)).map((w) => w.n));
const canEditSets = (c: AgentsCtx) => canUpd(c, '*') || canAppr(c, '*');

export function evalSetsScreen(c: AgentsCtx): ScreenModel {
  const { D } = c;
  return {
    head: { title: 'Evaluation Datasets', add: canEditSets(c) ? act('Create dataset', c.a.createSet, 'primary') : undefined },
    sections: [
      {
        cols: ['Dataset', 'Cases', 'Languages', 'Refusal cases', 'Used by', 'Owner'],
        mode: 'inline',
        empty: 'No evaluation datasets yet.',
        rows: D.evalsets.map((s0) => ({
          ...row(
            'es:' + s0.id,
            [cell(s0.id, { m: true, sub: s0.n }), cell(String(s0.cases.length)), cell([...new Set(s0.cases.map((x) => x.lang))].join(', ') || '—'), cell(String(s0.cases.filter((x) => x.refuse).length)), cell(usedBy(D, s0.id).join(', ') || '—'), cell(s0.by, { m: true })],
            [act('Open', () => c.go.evalset(s0.id))],
          ),
          onClick: () => c.go.evalset(s0.id),
        })),
      },
    ],
  };
}

export function evalSetScreen(c: AgentsCtx, setId: string): ScreenModel {
  const { D } = c;
  const s0: EvalSet | undefined = D.evalsets.find((x) => x.id === setId);
  if (!s0) return deniedModel(c, 'dataset');
  const ed = canEditSets(c);
  const usedA = D.agents.filter((a) => (a.evSets || []).includes(s0.id));
  const usedW = D.workflows.filter((w) => (w.evSets || []).includes(s0.id));
  return {
    head: { title: s0.id + ' · ' + s0.n },
    sections: [
      {
        form: true,
        rows: [
          fr('Description', s0.d || '—'),
          fr('Owner', s0.by),
          fr(
            'Used by',
            usedA.map((a) => a.id).concat(usedW.map((w) => w.n)).join(', ') || 'Not used yet',
            'Evaluation runs on each agent or workflow use these cases',
            usedA.length ? [act('Open ' + usedA[0].id, () => c.go.agent(usedA[0].id, 'eval'))] : usedW.length ? [act('Open ' + usedW[0].n, () => c.go.workflow(usedW[0].id, 'eval'))] : [],
          ),
        ],
      },
      {
        title: 'Test cases',
        sacts: ed ? [act('Add test case', () => c.a.editCase(s0.id, null))] : [],
        empty: 'No test cases yet.',
        cols: ['Case', 'Question', 'Expected', 'Evidence', 'Language', 'Origin'],
        mode: 'inline',
        rows: s0.cases.map((x) =>
          row(
            'tc:' + x.id,
            [cell(x.id, { m: true }), cell(x.q), cell(x.refuse ? 'Refusal' + (x.exp ? ' · ' + x.exp : '') : x.exp), cell(x.evid, { m: true }), cell(x.lang), cell(x.src ? 'From run ' + x.src : 'Authored', { sub: x.cat })],
            ed ? [act('Edit', () => c.a.editCase(s0.id, x)), act('Remove', () => c.a.removeCase(s0.id, x), 'ghost')] : [],
          ),
        ),
      },
    ],
  };
}
