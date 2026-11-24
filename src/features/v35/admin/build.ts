/**
 * Platform & tenant administration (v35) as ScreenModels. Port of the
 * prototype's `platAdmin` screens: pConfig, pMon, pAudit / audit, pKeys, pLic,
 * tConfig, tSec. Builders take data, permissions and callbacks; actions open
 * the shared dialogs, change `adminStore` and record Unified Audit Log events.
 */
import { act, cell, fr, kv } from '@/engine/build';
import type { FormField, FormValues } from '@/engine/dialogs';
import type { Action, DsStatus, Filters, PageHead, Row, ScreenModel, Section } from '@/engine/types';
import type { AuditEvent } from '@/v35/data/audit';
import {
  assignedOf, LANGS, LN, langNames, SECRETS, SEED_AUDIT, REG_CONNS, REG_DEPS, telemetry, TN,
  type AdminData, type AdminTenant, type Alert, type AlertRule, type HistEntry, type PlatformKey, type RotState, type TenantCred, type Vault,
} from '@/v35/data/admin';
import {
  addHist, depList, healthP, isInt, mapOf, mappingError, meta, pArea, pGet, pSet, refOf, rotHow, rotKv, rotState, stagePill, tArea, tGet, tSet, vaultId, vaultUsedBy, vName, vOf, VTYPES,
} from './logic';

export interface AdminUi {
  form: (title: string, fields: FormField[], saveL: string, save: (v: FormValues) => string) => void;
  confirm: (title: string, body: string, items: { a: string; b?: string; c?: string }[], cta: string, fn: () => void) => void;
  info: (title: string, body: string, items?: { a: string; b?: string; c?: string }[]) => void;
  toast: (msg: string) => void;
}

export interface AdminCtx {
  /** the signed-in ("view as") account */
  actor: string;
  /** render snapshot */
  D: AdminData;
  /** fresh state (timers, chained dialogs) */
  get: () => AdminData;
  set: (fn: (d: AdminData) => void) => void;
  ui: AdminUi;
  audit: (e: Omit<AuditEvent, 'id' | 'at'>) => void;
  /** platform permission of the account */
  canP: (perm: string) => boolean;
  /** tenant:configure in the current tenant */
  canT: boolean;
  /** current tenant (tenant screens) */
  T: AdminTenant | null;
  go: (path: string) => void;
  openUrl: (url: string) => void;
  later: (fn: () => void, ms: number) => void;
  /** active platform administrators plus tenant users (licence "Named administrators") */
  adminCount: number;
  /** live session events of the Unified Audit Log */
  events: AuditEvent[];
}

type Ev = (action: string, res: string, tenants: AdminTenant[], area: string) => void;
const evOf = (c: AdminCtx, lvl: 'tenant' | 'platform'): Ev => (action, res, tenants, area) => c.audit({ who: c.actor, action, res, tenants, lvl, area });

const tabsOf = (T: [string, string][]) => T.map(([value, label]) => ({ value, label }));
const pickTab = (T: [string, string][], t: string | undefined) => (T.some((x) => x[0] === t) ? t! : T[0][0]);

/** Form row with an Edit action when allowed (prototype `fr` inside platAdmin). */
const er = (can: boolean, label: string, val: unknown, sub: string, edit: (() => void) | null, o?: { tip?: string; lock?: string }): Row => fr(label, val, sub, can && edit ? [act('Edit', edit)] : [], o);

/** Configuration history with roll back (prototype `histTable`). */
function histTable(c: AdminCtx, H0: HistEntry[], curOf: (k: string) => string | undefined, canM: boolean, roll: (h: HistEntry) => void, label: string): Section {
  return {
    cols: ['Version', 'Area', 'Setting', 'Change', 'Changed by', 'When', 'Status'],
    empty: 'No configuration changes yet.',
    mode: 'inline',
    rows: H0.map((h): Row => {
      const latest = H0.find((x) => x.key === h.key) === h;
      const cur = String(curOf(h.key)) === String(h.nw);
      const canRoll = canM && latest && cur && h.old !== '—';
      return {
        key: label + h.v,
        cells: [cell(`v${h.v}`, { m: true }), cell(h.area), cell(h.key), cell(`${h.old} → ${h.nw}`), cell(h.by, { m: true }), cell(h.at), cell('', { p: latest && cur ? ['approved', 'Current'] : ['draft', 'Superseded'] })],
        quick: canRoll
          ? [act('Roll back', () => c.ui.confirm(`Roll back ${h.key}?`, `Creates a new version that restores "${h.old}". The change is applied immediately and recorded in the Unified Audit Log.`, [], 'Roll back', () => roll(h)))]
          : [],
      };
    }),
  };
}

// ================================================================ rotation lifecycle
// Requested → Completed (new version written by the backend) → Verified (each dependent checked) or Verification failed
type Outcome = (tries: number) => Record<string, [string, string]>;

function rotUpd(c: AdminCtx, id: string, fn: (r: RotState) => RotState) {
  c.set((d) => {
    d.rot[id] = fn(d.rot[id] ?? { tries: 0, deps: {} });
  });
}

function startRot(c: AdminCtx, ev: Ev, id: string, label: string, deps: string[], area: string, tenants: AdminTenant[], note: string) {
  rotUpd(c, id, () => ({ stage: 'Requested', by: c.actor, req: 'just now', deps: Object.fromEntries(deps.map((d) => [d, 'Pending'])), tries: 0 }));
  c.ui.toast(`${label}: rotation requested.`);
  ev('Requested rotation', label, tenants, area);
  c.later(() => {
    rotUpd(c, id, (r) => ({ ...r, stage: 'Completed', done: 'just now', doneNote: note }));
    c.ui.toast(`${label}: new version created. Verify the dependent services.`);
    ev('Rotation completed', `${label} · ${note}`, tenants, area);
  }, 1500);
}

function verify(c: AdminCtx, ev: Ev, id: string, label: string, deps: string[], outcome: Outcome, area: string, tenants: AdminTenant[]) {
  const r = c.get().rot[id] ?? { tries: 0, deps: {} };
  const res = outcome(r.tries || 0);
  const st = (d: string) => (res[d] ?? ['Verified', 'Check passed']);
  const ok = deps.every((d) => st(d)[0] === 'Verified');
  rotUpd(c, id, (x) => ({ ...x, stage: ok ? 'Verified' : 'Verification failed', ver: 'just now', tries: (x.tries || 0) + 1, deps: Object.fromEntries(deps.map((d) => [d, st(d)[0]])), detail: Object.fromEntries(deps.map((d) => [d, st(d)[1]])) }));
  c.ui.toast(ok ? `${label}: verified on ${deps.length}${deps.length === 1 ? ' dependent.' : ' dependents.'}` : `${label}: verification failed. See details.`);
  ev(ok ? 'Verified rotation' : 'Rotation verification failed', `${label} · ${deps.map((d) => `${d} ${st(d)[0].toLowerCase()}`).join(', ')}`, tenants, area);
}

// ================================================================ PLATFORM CONFIGURATION
export const PCONFIG_TABS: [string, string][] = [['general', 'General'], ['work', 'Workloads & Scheduling'], ['security', 'Security Defaults'], ['history', 'Configuration History']];

/** Change one platform setting and record a version (prototype `pChange`); returns an error or ''. */
export function pChange(c: AdminCtx, key: string, nv: string, toast?: string): string {
  const ov = pGet(c.get().pcfg, key);
  if (String(ov) === String(nv)) return 'No change.';
  c.set((d) => {
    pSet(d.pcfg, key, nv, c.actor);
    addHist(d.pcfg, pArea(key), key, ov, nv, c.actor);
  });
  c.ui.toast(toast || `${key} saved.`);
  evOf(c, 'platform')('Changed platform setting', `${key}: ${ov} → ${nv}`, [], 'Platform Configuration');
  return '';
}

export function platformConfigScreen(c: AdminCtx, tab0: string | undefined, setTab: (t: string) => void): ScreenModel {
  const canM = c.canP('config:manage');
  const P = c.D.pcfg;
  const tab = pickTab(PCONFIG_TABS, tab0);
  const head: PageHead = { title: 'Platform Configuration', tabs: tabsOf(PCONFIG_TABS), tab, setTab };
  const f =(label: string, val: unknown, sub: string, edit: (() => void) | null, o?: { tip?: string; lock?: string }) => er(canM, label, val, sub, edit, o);
  let sections: Section[] = [];
  if (tab === 'general') {
    const G = P.general;
    sections = [
      {
        form: true,
        rows: [
          f('Installation name', G.name, `Changed by ${meta(P.gmeta.name)}`, () =>
            c.ui.form('Installation name', [{ k: 'v', label: 'Installation name', type: 'text', val: G.name, hint: 'Shown in the console header and in notifications.' }], 'Save', (v) => {
              const x = String(v.v ?? '').trim();
              if (x.length < 3 || x.length > 60) return 'Enter 3 to 60 characters.';
              return pChange(c, 'Installation name', x);
            }),
          ),
          f('Admin session timeout', G.timeout, `Applies to platform and tenant administration sessions · changed by ${meta(P.gmeta.timeout)}`, () =>
            c.ui.form('Admin session timeout', [{ k: 'v', label: 'Sign out after inactivity', type: 'select', opts: ['15 min', '30 min', '60 min', '120 min'], val: G.timeout }], 'Save', (v) => pChange(c, 'Admin session timeout', v.v)),
          ),
          f('Supported interface languages', langNames(G.langs), `Tenants choose their languages from this list · changed by ${meta(P.gmeta.langs)}`, () =>
            c.ui.form('Supported interface languages', [{ k: 'v', label: 'Languages', type: 'chips', opts: LANGS.map((x) => x[1]), val: G.langs.map((x) => LN[x]) }], 'Save', (v) => {
              const sel = LANGS.filter((x) => (v.v || []).includes(x[1])).map((x) => x[1]);
              if (!sel.length) return 'Select at least one language.';
              if (!sel.includes(LN[G.defLang])) return `Keep the default language (${LN[G.defLang]}) or change the default first.`;
              const TC = c.get().tcfg;
              const inUse = (Object.keys(TC) as AdminTenant[]).flatMap((t) => TC[t].lang.langs.map((x) => [t, x] as const)).filter(([, x]) => !sel.includes(LN[x]));
              if (inUse.length) return `${LN[inUse[0][1]]} is enabled by ${TN[inUse[0][0]]}. Ask the tenant to disable it first.`;
              return pChange(c, 'Supported interface languages', sel.join(', '));
            }),
          ),
          f('Default interface language', LN[G.defLang], `Used when a tenant has not set its own default · changed by ${meta(P.gmeta.defLang)}`, () =>
            c.ui.form('Default interface language', [{ k: 'v', label: 'Default language', type: 'select', opts: G.langs.map((x) => LN[x]), val: LN[G.defLang] }], 'Save', (v) => pChange(c, 'Default interface language', v.v)),
          ),
        ],
      },
    ];
  }
  if (tab === 'work') {
    const qmax = (q: string) => P.queues.find((x) => x[0] === q)?.[2] ?? 0;
    const qlv = (q: string) => +((P.queues.find((x) => x[0] === q)?.[3] ?? '1–5').split('–')[1]);
    const sf = (label: string, key: string, sub: string, opts: string[] | null, o?: { lo: number; hi: number; hint?: string }): Row =>
      fr(label, pGet(P, key), sub, canM
        ? [act('Edit', () => c.ui.form(label, [opts ? { k: 'v', label, type: 'select', opts, val: pGet(P, key) } : { k: 'v', label, type: 'num', val: pGet(P, key), hint: o?.hint }], 'Save', (v) => {
            if (!opts && o && !isInt(v.v, o.lo, o.hi)) return `Enter a whole number from ${o.lo} to ${o.hi}.`;
            return pChange(c, key, String(v.v).trim());
          }))]
        : []);
    sections = [
      {
        title: 'Tenant workload allocations',
        tip: 'A request runs only within the model endpoint limit, the platform queue capacity and the tenant allocation. The most restrictive one applies.',
        cols: ['Tenant', 'Queue', 'Platform maximum', 'Fair share', 'Max in flight', 'Priority ceiling', 'Bulk window'],
        mode: 'inline',
        rows: P.alloc.map((r): Row => ({
          key: `a:${r[0]}${r[1]}`,
          cells: [cell(TN[r[0]]), cell(r[1], { m: true }), cell(`${qmax(r[1])} in flight`, { tip: 'Queue capacity of the Data Bus deployment · read-only' }), cell(r[2]), cell(r[3]), cell(r[4]), cell(r[5])],
          acts: canM
            ? [act('Edit', () => c.ui.form(`${TN[r[0]]} · ${r[1]}`, [
                { k: 'fs', label: 'Fair share', type: 'select', opts: ['10%', '20%', '30%', '40%', '50%', '60%'], val: r[2] },
                { k: 'mx', label: 'Max in flight', type: 'num', val: r[3], hint: `Up to ${qmax(r[1])}, the queue capacity.` },
                { k: 'pc', label: 'Priority ceiling', type: 'select', opts: Array.from({ length: qlv(r[1]) }, (_, i) => String(i + 1)), val: r[4] },
                { k: 'bw', label: 'Bulk window', type: 'select', opts: ['Not restricted', '01:00–04:00 AST', '02:00–05:00 AST', '22:00–06:00 AST'], val: r[5] },
              ], 'Save', (v) => saveAlloc(c, r, v)))]
            : [],
        })),
      },
      {
        form: true,
        title: 'Scheduling policies',
        rows: [
          sf('Dispatch order', 'Dispatch order', 'Applies to both queues', ['Interactive first, then scheduled, then bulk', 'Strict priority, then submission time']),
          sf('Retries after a failed task · kap.agent', 'Retries · kap.agent', 'Before the job is marked failed', ['0', '1', '2', '3']),
          sf('Retries after a failed task · kap.pipeline', 'Retries · kap.pipeline', 'Before the run is marked failed', ['0', '1', '2', '3']),
        ],
      },
      {
        form: true,
        title: 'Run limits',
        tip: 'Platform maximum. Tenants and individual agents can set lower values.',
        rows: [
          sf('Max tool calls per run', 'Max tool calls per run', 'Tenants and agents may set lower values', null, { lo: 1, hi: 50, hint: 'Whole number from 1 to 50.' }),
          sf('Max run duration', 'Max run duration', 'Runs are stopped when the limit is reached', ['120 s', '180 s', '300 s', '600 s']),
        ],
      },
    ];
  }
  if (tab === 'security') {
    const S = P.security;
    const pol = (label: string, val: string, sub: string, tip: string, fields: FormField[], save: (v: FormValues) => string): Row =>
      fr(label, val, sub, canM ? [act('Edit', () => c.ui.form(label, fields, 'Save', save))] : [], { tip });
    const EXTRA = ['PII detection', 'Harmful content', 'Off-topic requests'];
    sections = [
      {
        form: true,
        rows: [
          pol('Maximum data classification for external AI models and tools', S.cls, `Tenants may lower it · changed by ${meta(P.smeta.cls)}`, 'Applies to model endpoints and MCP servers outside the KAP perimeter. L2 and L3 data never leaves the platform; this is fixed.',
            [{ k: 'v', label: 'Highest classification allowed', type: 'select', opts: ['L0 · Public', 'L1 · Internal'], val: S.cls, hint: 'L2 · Restricted and L3 · Secret are never sent outside the platform.' }], (v) => pChange(c, 'External AI · max classification', v.v)),
          pol('Personal data sent to external services', S.pii, `Tenants may only keep or tighten this · changed by ${meta(P.smeta.pii)}`, 'Enforced by the egress gateway and the guardrails before any external call.',
            [{ k: 'v', label: 'Policy', type: 'select', opts: ['Not allowed', 'Allowed only after masking'], val: S.pii }], (v) => pChange(c, 'Personal data to external services', v.v)),
          pol('Outbound network access', S.egress, `All outbound traffic passes through the egress gateway; this is fixed · changed by ${meta(P.smeta.egress)}`, 'Destinations not on the allowlist are blocked.',
            [{ k: 'v', label: 'Policy', type: 'select', opts: ['Platform allowlist only', 'Platform allowlist plus reviewed tenant entries'], val: S.egress, hint: 'Tenant entries are reviewed by platform administrators before they take effect.' }], (v) => pChange(c, 'Outbound network access', v.v)),
          pol('AI input guardrails', ['Prompt injection', 'Jailbreak', ...S.guard].join(', '), `Prompt injection and jailbreak detection are always on · all enabled languages · changed by ${meta(P.smeta.guard)}`, 'Checks run on every user input before it reaches a model.',
            [{ k: 'v', label: 'Additional checks', type: 'chips', opts: EXTRA, val: S.guard.slice(), hint: 'Prompt injection and jailbreak detection cannot be turned off.' }],
            (v) => pChange(c, 'AI input guardrails', ['Prompt injection', 'Jailbreak', ...EXTRA.filter((x) => (v.v || []).includes(x))].join(', '))),
        ],
      },
    ];
  }
  if (tab === 'history') {
    sections = [
      histTable(c, P.hist, (k) => pGet(P, k), canM, (h) => {
        const err = pChange(c, h.key, h.old, `Rolled back ${h.key} to "${h.old}".`);
        if (err) c.ui.toast(err);
      }, 'h:'),
    ];
  }
  return { head, sections };
}

/** Save a tenant workload allocation (several versioned keys at once). */
export function saveAlloc(c: AdminCtx, r: AdminData['pcfg']['alloc'][number], v: FormValues): string {
  const P = c.get().pcfg;
  const qmax = P.queues.find((x) => x[0] === r[1])?.[2] ?? 0;
  if (!isInt(v.mx, 1, qmax)) return `Max in flight must be a whole number from 1 to ${qmax}.`;
  const tl = c.get().tcfg[r[0]].lim[r[1] === 'kap.agent' ? 'agentConc' : 'pipeConc'];
  const ch: [string, string, string][] = ([['fair share', r[2], v.fs], ['max in flight', r[3], String(v.mx).trim()], ['priority ceiling', r[4], v.pc], ['bulk window', r[5], v.bw]] as [string, string, string][]).filter((x) => x[1] !== x[2]);
  if (!ch.length) return 'No change.';
  c.set((d) => {
    ch.forEach(([k, o, nv]) => {
      const key = `${TN[r[0]]} · ${r[1]} · ${k}`;
      pSet(d.pcfg, key, nv, c.actor);
      addHist(d.pcfg, 'Workloads & Scheduling', key, o, nv, c.actor);
    });
  });
  c.ui.toast(`${TN[r[0]]} · ${r[1]} allocation saved.${+v.mx < +tl ? ` The tenant limit of ${tl} is capped at ${v.mx}.` : ''}`);
  evOf(c, 'platform')('Changed tenant workload allocation', `${TN[r[0]]} · ${r[1]} · ${ch.map((x) => `${x[0]} ${x[1]} → ${x[2]}`).join(', ')}`, [r[0]], 'Platform Configuration');
  return '';
}

// ================================================================ MONITORING & ALERTS
const METRICS: Record<string, string> = { 'Queue wait time': 'min', 'MCP error rate': '%', 'Tokens per minute vs endpoint limit': '%', 'Days until license expiry': 'days', 'Job failure rate': '%', 'SIEM forwarding lag': 'min', 'Worker occupancy': '%', 'Telemetry age': 'min' };
const sevP = (s: string): DsStatus => (s === 'Critical' ? 'rejected' : s === 'Warning' ? 'hold' : 'draft');
const alertP = (s: Alert['st']): DsStatus => ({ Open: 'rejected', Acknowledged: 'submitted', Investigating: 'submitted', Recovered: 'approved', Closed: 'draft' } as const)[s];
export const cond = (r: Pick<AlertRule, 'metric' | 'op' | 'thr' | 'unit' | 'dur'>) => `${r.metric} ${r.op} ${r.thr} ${r.unit}${r.dur === 'Immediately' ? '' : ` for ${r.dur}`}`;
const ORD: Alert['st'][] = ['Open', 'Investigating', 'Acknowledged', 'Recovered', 'Closed'];

/** Update an alert, add an activity entry, toast and record (prototype `upA`). */
function upA(c: AdminCtx, id: string, fn: (a: Alert) => void, toast: string, action: string, res: string, note?: string) {
  c.set((d) => {
    const x = d.mon.alerts.find((y) => y.id === id);
    if (!x) return;
    fn(x);
    x.log = [{ at: 'just now', who: c.actor, what: action + (note ? `: ${note}` : '') }, ...(x.log ?? [])];
  });
  c.ui.toast(toast);
  evOf(c, 'platform')(action, res, [], 'Monitoring & Alerts');
}

/** Validate and save an alert rule (prototype `ruleForm` save); returns an error or ''. */
export function saveRule(c: AdminCtx, r: AlertRule | null, v: FormValues): string {
  const RU = c.get().mon.rules;
  const nm = String(v.n ?? '').trim();
  if (nm.length < 3) return 'Enter a rule name.';
  if (!/^\d+(\.\d+)?$/.test(String(v.thr ?? '').trim())) return 'Threshold must be a number.';
  if (METRICS[v.metric] === '%' && +v.thr > 100) return 'A percentage threshold cannot exceed 100.';
  if (RU.some((x) => x.n === nm && (!r || x.id !== r.id))) return 'A rule with this name exists.';
  const rec: AlertRule = { id: r ? r.id : `r${RU.length + 1}${Date.now() % 1000}`, n: nm, metric: v.metric, op: v.op, thr: String(v.thr).trim(), unit: METRICS[v.metric], dur: v.dur, sev: v.sev, route: v.route, on: r ? r.on : true, fired: r ? r.fired : 'Never', mg: 'KAP' };
  c.set((d) => {
    if (r) d.mon.rules[d.mon.rules.findIndex((x) => x.id === r.id)] = rec;
    else d.mon.rules.push(rec);
  });
  c.ui.toast(`${r ? 'Rule saved: ' : 'Rule added: '}${nm}.`);
  evOf(c, 'platform')(r ? 'Changed alert rule' : 'Added alert rule', `${nm} · ${cond(rec)} → ${rec.route}`, [], 'Monitoring & Alerts');
  return '';
}

export function monitoringScreen(c: AdminCtx): ScreenModel {
  const canM = c.canP('monitor:manage');
  const TM = telemetry(c.D.pcfg);
  const { alerts: AL, rules: RU, routes: RT } = c.D.mon;
  const ruleOf = (id: string) => RU.find((r) => r.id === id);
  const ack = (a: Alert) => () => upA(c, a.id, (x) => { x.st = 'Acknowledged'; x.ack = `${c.actor} · just now`; }, `${a.id} acknowledged. It stays active until monitoring reports recovery.`, 'Acknowledged alert', `${a.id} · ${a.comp}`);
  const note = (a: Alert) => () =>
    c.ui.form(`Investigation note · ${a.id}`, [
      { k: 'n', label: 'Note', type: 'text', ph: 'What was checked or changed' },
      { k: 'own', label: 'Owner', type: 'select', opts: [...new Set(['Platform operations', 'Security operations', 'On-call', a.owner])], val: a.owner },
    ], 'Add note', (v) => {
      const t = String(v.n ?? '').trim();
      if (t.length < 5) return 'Enter a short note (at least 5 characters).';
      upA(c, a.id, (x) => { x.st = x.st === 'Open' || x.st === 'Acknowledged' ? 'Investigating' : x.st; x.owner = v.own; }, `Note added to ${a.id}.`, 'Added investigation note', `${a.id} · ${t}${v.own !== a.owner ? ` · owner → ${v.own}` : ''}`, t);
      return '';
    });
  const close = (a: Alert) => () =>
    c.ui.form(`Close ${a.id}`, [
      { k: 'r', label: 'Reason', type: 'select', opts: ['Fixed; monitoring has not caught up', 'Known issue tracked elsewhere', 'False positive'], val: 'Fixed; monitoring has not caught up' },
      { k: 'ref', label: 'Reference', type: 'text', ph: 'Ticket or change number' },
    ], 'Close alert', (v) => {
      const ref = String(v.ref ?? '').trim();
      if (!ref) return 'Enter a ticket or change reference.';
      upA(c, a.id, (x) => { x.st = 'Closed'; x.closed = `${c.actor} · ${v.r} · ${ref}`; }, `${a.id} closed. It reopens if the condition is detected again.`, 'Closed alert', `${a.id} · ${v.r} · ${ref}`);
      return '';
    });
  const ruleForm = (r: AlertRule | null) =>
    c.ui.form(r ? 'Edit alert rule' : 'Add alert rule', [
      { k: 'n', label: 'Name', type: 'text', val: r ? r.n : '' },
      { k: 'metric', label: 'Metric', type: 'select', opts: Object.keys(METRICS), val: r ? r.metric : 'Queue wait time' },
      { k: 'op', label: 'Condition', type: 'select', opts: ['>', '<'], val: r ? r.op : '>' },
      { k: 'thr', label: 'Threshold', type: 'num', val: r ? r.thr : '', hint: 'Unit follows the metric: minutes, %, or days.' },
      { k: 'dur', label: 'For at least', type: 'select', opts: ['Immediately', '5 min', '10 min', '15 min', '1 h'], val: r ? r.dur : '5 min' },
      { k: 'sev', label: 'Severity', type: 'select', opts: ['Critical', 'Warning', 'Info'], val: r ? r.sev : 'Warning' },
      { k: 'route', label: 'Notify', type: 'select', opts: RT.map((x) => x.n), val: r ? r.route : 'Platform operations' },
    ], r ? 'Save' : 'Add rule', (v) => saveRule(c, r, v));
  const active = (a: Alert) => ['Open', 'Acknowledged', 'Investigating'].includes(a.st);
  const sections: Section[] = [
    {
      group: 'Platform health',
      title: 'Services',
      tip: 'Status comes from the last telemetry received. Older than 5 minutes is Stale; older than 30 minutes or missing is Unknown. Neither is ever shown as Healthy.',
      cols: ['Service', 'Status', 'Detail', 'Telemetry source', 'Last report'],
      mode: 'inline',
      rows: TM.services.map((r): Row => ({ key: `sv:${r.n}`, cells: [cell(r.n), cell('', { p: r.pill, tip: r.why }), cell(r.shown), cell(r.src), cell(r.last)], acts: r.link ? [act(r.link[0], () => c.go(r.link![1]))] : [] })),
    },
    {
      title: 'Data Bus queues and workers',
      tip: 'Read-only metrics reported by the Data Bus and the worker pool every 15 s. Occupancy is busy workers out of available workers.',
      cols: ['Queue', 'Queue depth', 'Oldest waiting', 'Workers available', 'Worker health', 'Active tasks', 'Failed tasks · 1 h', 'Occupancy', 'Last report'],
      mode: 'inline',
      rows: TM.queues.map((w): Row => ({
        key: `w:${w.q}`,
        cells: [
          cell(w.q, { m: true }), cell(w.fresh ? w.depth : '—'), cell(w.fresh ? w.oldest : '—'), cell(w.fresh ? `${w.avail} of ${w.deployed} deployed` : '—'), cell(w.fresh ? w.health : '—'), cell(w.fresh ? w.active : '—'), cell(w.fresh ? w.failed : '—'),
          cell(w.fresh ? `${w.active} of ${w.avail} busy · ${Math.round((w.active / w.avail) * 100)}%` : 'Stale data'), cell(w.last),
        ],
      })),
    },
    {
      group: 'Active alerts and failures',
      cols: ['Severity', 'Affected component', 'Issue', 'Status', 'First seen', 'Last seen', 'Owner'],
      empty: 'No alerts.',
      rows: AL.slice().sort((a, b) => ORD.indexOf(a.st) - ORD.indexOf(b.st)).map((a): Row => {
        const ru = ruleOf(a.rule);
        return {
          key: `al:${a.id}`,
          cells: [cell('', { p: [sevP(a.sev), a.sev] }), cell(a.comp, { sub: a.id }), cell(a.issue), cell('', { p: [alertP(a.st), a.st] }), cell(a.first), cell(a.last), cell(a.owner)],
          kv: kv([
            ['Occurrences', a.n],
            ['Rule', ru ? `${ru.n} · ${cond(ru)}` : '—'],
            ['Evidence', a.ev],
            ['Notified', ru?.route],
            ['Acknowledged by', a.ack],
            ['Recovery', a.rec || (a.st === 'Closed' ? 'Closed manually · not confirmed by monitoring' : 'Not recovered · monitoring still reports the condition')],
            ['Closed by', a.closed],
          ]),
          lists: [{ title: 'Activity', items: [...(a.log ?? []), { at: a.first, who: 'Monitoring', what: `Alert raised by rule ${ru?.n ?? a.rule}` }].map((l) => ({ a: l.at, b: l.who, c: l.what })) }],
          quick: canM && a.st === 'Open' ? [act('Acknowledge', ack(a))] : [],
          acts: canM
            ? [
                ...(a.st === 'Open' ? [act('Acknowledge', ack(a))] : []),
                ...(active(a) ? [act('Add note…', note(a))] : []),
                ...(active(a) && c.canP('platform:manage') ? [act('Close…', close(a))] : []),
              ]
            : [],
        };
      }),
    },
    {
      group: 'Alert configuration and external monitoring',
      title: 'Alert rules',
      sacts: canM ? [act('Add rule', () => ruleForm(null))] : [],
      tip: 'KAP evaluates the rules marked KAP. Rules managed in Grafana are shown read-only; change them in Grafana.',
      cols: ['Rule', 'Condition', 'Severity', 'Notify', 'Managed in', 'Last fired', 'Status'],
      mode: 'inline',
      rows: RU.map((r): Row => ({
        key: `ru:${r.id}`,
        cells: [cell(r.n), cell(cond(r)), cell('', { p: [sevP(r.sev), r.sev] }), cell(r.route), cell(r.mg === 'Grafana' ? 'Grafana Alerting' : 'KAP'), cell(r.fired), cell('', { p: r.on ? ['approved', 'Enabled'] : ['draft', 'Disabled'] })],
        lockTip: r.mg === 'Grafana' ? 'Managed in Grafana Alerting · read-only here' : undefined,
        acts:
          r.mg === 'Grafana'
            ? [act('Open in Grafana', () => c.openUrl('https://grafana.kap.internal/alerting/list'))]
            : canM
              ? [
                  act('Edit', () => ruleForm(r)),
                  act(r.on ? 'Disable' : 'Enable', () => {
                    c.set((d) => {
                      const x = d.mon.rules.find((y) => y.id === r.id);
                      if (x) x.on = !x.on;
                    });
                    c.ui.toast(r.n + (r.on ? ' disabled.' : ' enabled.'));
                    evOf(c, 'platform')(r.on ? 'Disabled alert rule' : 'Enabled alert rule', r.n, [], 'Monitoring & Alerts');
                  }),
                ]
              : [],
      })),
    },
    {
      title: 'Notification routes',
      cols: ['Recipient', 'Channel', 'Destination', 'Severities'],
      mode: 'inline',
      rows: RT.map((r): Row => ({
        key: `rt:${r.n}`,
        cells: [cell(r.n), cell(r.ch), cell(r.dest), cell(r.sev.join(', '))],
        acts: canM
          ? [act('Edit', () => c.ui.form(r.n, [
              { k: 'ch', label: 'Channel', type: 'select', opts: ['ITSM ticket', 'ITSM page', 'E-mail', 'SIEM and e-mail', 'Ops chat'], val: r.ch },
              { k: 'dest', label: 'Destination', type: 'text', val: r.dest },
              { k: 'sev', label: 'Severities', type: 'chips', opts: ['Critical', 'Warning', 'Info'], val: r.sev.slice() },
            ], 'Save', (v) => {
              const dest = String(v.dest ?? '').trim();
              if (!dest) return 'Enter a destination.';
              if (!(v.sev || []).length) return 'Select at least one severity.';
              c.set((d) => {
                const x = d.mon.routes.find((y) => y.n === r.n);
                if (x) Object.assign(x, { ch: v.ch, dest, sev: ['Critical', 'Warning', 'Info'].filter((s) => v.sev.includes(s)) });
              });
              c.ui.toast(`${r.n} route saved.`);
              evOf(c, 'platform')('Changed notification route', `${r.n} → ${v.ch} · ${dest}`, [], 'Monitoring & Alerts');
              return '';
            }))]
          : [],
      })),
    },
    {
      title: 'External monitoring',
      cols: ['System', 'Use', 'Address', 'Connection'],
      mode: 'inline',
      rows: TM.external.map((r): Row => ({ key: `x:${r[0]}`, cells: [cell(r[0]), cell(r[1]), cell(r[2], { m: true }), cell('', { p: r[3], tip: r[4] })], lockTip: `Read-only · managed in ${r[0]}`, acts: [act('Open', () => c.openUrl(r[2]))] })),
    },
  ];
  return { head: { title: 'Monitoring & Alerts' }, sections };
}

// ================================================================ UNIFIED AUDIT LOG (platform and tenant)
export interface AuditRow { when: string; age: number; who: string; tk: string[]; ten: string; area: string; action: string; res: string }
export type AuditFilters = Partial<Record<'who' | 'ten' | 'area' | 'time' | 'q', string>>;
const tenL = (tk: string[]) => (tk.length ? tk.map((t) => TN[t] || t).join(', ') : 'Platform');
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/** Live session events (newest first) followed by the seed events; tenant scope keeps only the tenant's events. */
export function auditRows(events: AuditEvent[], T: string | null): AuditRow[] {
  const live: AuditRow[] = events.map((e) => ({ when: `Today · ${hhmm(e.at)}`, age: 0, who: e.who, tk: e.tenants ?? [], ten: tenL(e.tenants ?? []), area: e.area || (e.lvl === 'tenant' ? 'Tenant' : 'Platform Administration'), action: e.action, res: e.res }));
  const seed: AuditRow[] = SEED_AUDIT.map((e) => ({ ...e, ten: tenL(e.tk) }));
  return [...live, ...seed].filter((e) => !T || e.tk.includes(T));
}

export function auditScreen(c: AdminCtx, isT: boolean, F: AuditFilters, setF: (f: AuditFilters) => void): ScreenModel {
  const T = isT ? c.T : null;
  if (isT && !T) return noTenant('Unified Audit Log');
  const ALLE = auditRows(c.events, T);
  const uniq = (k: 'who' | 'area') => ['Any', ...new Set(ALLE.map((e) => e[k]))];
  const tmax = ({ 'Any time': 1e9, Today: 1, 'Last 7 days': 7, 'Last 30 days': 30 } as Record<string, number>)[F.time || 'Any time'] ?? 1e9;
  const any = (x?: string) => !x || x === 'Any';
  const rows = ALLE.filter(
    (e) =>
      (any(F.who) || e.who === F.who) &&
      (isT || any(F.ten) || e.ten.includes(F.ten!)) &&
      (any(F.area) || e.area === F.area) &&
      e.age <= tmax &&
      (!F.q || `${e.res} ${e.action}`.toLowerCase().includes(F.q.toLowerCase())),
  );
  const defs: [keyof AuditFilters, string, string[]][] = [
    ['who', 'Actor', uniq('who')],
    ...(isT ? [] : [['ten', 'Tenant', ['Any', 'Platform', 'SCEAI', 'Economic Affairs', 'sandbox']] as [keyof AuditFilters, string, string[]]]),
    ['area', 'Operation area', uniq('area')],
    ['time', 'Time', ['Any time', 'Today', 'Last 7 days', 'Last 30 days']],
  ];
  const filters: Filters = {
    q: F.q ?? '',
    qLabel: 'Resource or operation',
    setQ: (q) => setF({ ...F, q }),
    main: defs.map(([k, label, options]) => ({ label, value: F[k] || options[0], options, onChange: (v: string) => setF({ ...F, [k]: v }) })),
    chips: defs.filter(([k, , o]) => F[k] && F[k] !== o[0]).map(([k]) => ({ l: F[k]!, x: () => setF({ ...F, [k]: '' }) })),
    clear: () => setF({}),
    count: `${rows.length} events`,
  };
  const exportAll = () => {
    c.ui.toast(`Exported ${rows.length} events as CSV.`);
    evOf(c, isT ? 'tenant' : 'platform')('Exported audit events', `${rows.length} events`, T ? [T] : [], 'Unified Audit Log');
  };
  return {
    head: { title: 'Unified Audit Log', add: act('Export', exportAll, 'primary') },
    filters,
    sections: [
      {
        cols: isT ? ['When', 'Actor', 'Area', 'Operation', 'Resource'] : ['When', 'Actor', 'Tenant', 'Area', 'Operation', 'Resource'],
        empty: 'No events match the filters.',
        rows: rows.map((e, i): Row => ({
          key: `ev:${i}${e.when}${e.res}`,
          cells: [cell(e.when), cell(e.who, { m: true }), ...(isT ? [] : [cell(e.ten)]), cell(e.area), cell(e.action), cell(e.res)],
          kv: kv([['Scope', isT ? (e.tk.length ? 'Tenant' : 'Platform') : e.ten], ['Record', `AUD-${48210 - i}`], ['Integrity', 'Hash-chained · signed with audit-signing']]),
        })),
      },
    ],
  };
}

// ================================================================ SECRETS & KEYS
export const SECRETS_TABS: [string, string][] = [['keys', 'Encryption Keys'], ['creds', 'Service & Integration Credentials'], ['vaults', 'Vault Backends']];

function keyRow(c: AdminCtx, canM: boolean, k: PlatformKey): Row {
  const P = c.D.pcfg;
  const ev = evOf(c, 'platform');
  const id = `key:${k.id}`;
  const r = c.D.rot[id];
  const inFlight = !!(r && r.stage && r.stage !== 'Verified');
  const status: [DsStatus, string] = r && r.stage === 'Verification failed' ? ['rejected', 'Failing'] : inFlight ? ['draft', 'Not verified'] : healthP(k.health);
  const last = r && r.done ? r.done : k.rot;
  const sched = inFlight ? stagePill(r)! : rotState(r && r.done ? 0 : k.age, k.every, k.mode);
  const outcome: Outcome = (tries) =>
    k.id === 'callback-signing'
      ? tries === 0
        ? { 'Tenant callback receivers': ['Failed', 'dashboards.sceai.gov.qa rejected the test callback (401): the receiver still expects the previous key. Update it, then verify again.'], 'Callback dispatcher': ['Verified', 'Signing with the new version'] }
        : { 'Tenant callback receivers': ['Verified', 'Test callback accepted by 1 of 1 receivers'], 'Callback dispatcher': ['Verified', 'Signing with the new version'] }
      : Object.fromEntries(k.deps.map((d) => [d, ['Verified', k.id === 'audit-signing' ? 'New records signed and verified; earlier records still verify with previous versions' : 'Test decrypt of a re-wrapped data key passed']]));
  const note = ({ transit: 'new key version active; data keys re-wrapped', overlap: 'new version active; both versions sign callbacks during the overlap window' } as Record<string, string>)[k.mode] || 'new version active';
  const how = rotHow(P, k);
  const acts: Action[] =
    !canM || k.mode === 'hsm' || r?.stage === 'Requested'
      ? []
      : r && (r.stage === 'Completed' || r.stage === 'Verification failed')
        ? [act('Verify', () => verify(c, ev, id, k.id, k.deps, outcome, 'Secrets & Keys', []))]
        : k.mode === 'overlap'
          ? [act('Rotate…', () => c.ui.form(`Rotate ${k.id}`, [{ k: 'ov', label: 'Overlap window', type: 'select', opts: ['24 h', '72 h', '7 days'], val: '72 h', hint: 'Callbacks are signed with both versions during this window. Receivers must be updated before it ends.' }], 'Request rotation', (v) => {
              startRot(c, ev, id, k.id, k.deps, 'Secrets & Keys', [], `${note} (${v.ov})`);
              return '';
            }))]
          : [act('Rotate', () => c.ui.confirm(`Rotate ${k.id}?`, `${how} Verify the dependent services afterwards.`, k.deps.map((d) => ({ a: d, b: 'Will need verification', c: '' })), 'Request rotation', () => startRot(c, ev, id, k.id, k.deps, 'Secrets & Keys', [], note)))];
  return {
    key: `k:${k.id}`,
    cells: [cell(k.id, { m: true }), cell(k.p), cell(vName(P, k.v)), cell('', { p: status, tip: inFlight ? 'The new version has not been verified yet' : `Verified ${k.chk}` }), cell(last), cell('', { p: sched, tip: k.mode === 'hsm' ? 'Rotated outside KAP' : `Every ${k.every} days` })],
    kv: kv([
      ['Managed by', k.mode === 'hsm' ? 'Key ceremony procedure KC-02 · outside KAP' : vOf(P, k.v).n],
      ['Last verified', inFlight ? 'Not yet for the new version' : k.chk],
      ['Rotation schedule', k.mode === 'hsm' ? 'Annual key ceremony' : `Every ${k.every} days`],
      ['How rotation works', how],
      ...rotKv(r),
    ]),
    lists: depList(k.deps, r, 'Pending verification'),
    acts,
  };
}

function credRow(c: AdminCtx, canM: boolean, [path, kind]: [string, string, string]): Row {
  const P = c.D.pcfg;
  const ev = evOf(c, 'platform');
  const n = path.split('/').pop()!;
  const id = `cred:${n}`;
  const r = c.D.rot[id];
  const conns = REG_CONNS.filter((x) => x.secret === path);
  const deps = REG_DEPS.filter((d) => conns.some((x) => x.id === d[1])).map((d) => d[0]);
  const c0 = conns[0];
  const pki = kind === 'Client certificate';
  const base: [DsStatus, string] = !c0 ? ['draft', 'Not in use'] : c0.health === 'Healthy' ? ['approved', 'Verified'] : c0.health === 'Failing' ? ['rejected', 'Failing'] : ['draft', 'Not verified'];
  const status: [DsStatus, string] = r?.stage === 'Completed' ? ['draft', 'Not verified'] : r?.stage === 'Verification failed' ? ['rejected', 'Failing'] : r?.stage === 'Verified' ? ['approved', 'Verified'] : base;
  const outcome: Outcome = () =>
    Object.fromEntries(deps.map((d) => [d, c0 && c0.health === 'Failing' ? ['Failed', `Connection test failed: TLS timeout to ${c0.ep.replace(/^https?:\/\//, '').split('/')[0]}. The credential may be correct; the endpoint is not reachable.`] : ['Verified', 'Connection test passed with the new value']]));
  const vault = vOf(P, mapOf(P, 'platform').v).n;
  const acts: Action[] =
    !canM || pki
      ? []
      : r && (r.stage === 'Completed' || r.stage === 'Verification failed')
        ? [act('Verify', () => verify(c, ev, id, n, deps, outcome, 'Secrets & Keys', []))]
        : [act('Replace value…', () => c.ui.form(`Replace ${n}`, [{ k: 'v', label: 'New value', type: 'text', ph: `Paste the new ${kind.toLowerCase()}`, hint: `Written to ${vault} and never shown again.` }], 'Replace', (v) => {
            if (String(v.v ?? '').trim().length < 12) return `The value looks too short for a ${kind.toLowerCase()}.`;
            rotUpd(c, id, () => ({ stage: 'Completed', by: c.actor, req: 'just now', done: 'just now', doneNote: 'new version written to the vault', deps: Object.fromEntries(deps.map((d) => [d, 'Pending'])), tries: 0 }));
            c.ui.toast(`${n} replaced. ${deps.length ? `Verify ${deps.join(', ')} to confirm they use the new value.` : 'Nothing uses it yet.'}`);
            ev('Replaced service credential', `${n} · value not recorded`, [], 'Secrets & Keys');
            return '';
          }))];
  return {
    key: `c:${n}`,
    cells: [
      cell(n, { m: true }), cell(kind), cell(c0 ? c0.n : 'Not in use'), cell(pki ? 'Internal PKI' : refOf(P, 'platform', path), { m: !pki }),
      cell('', { p: status, tip: r?.stage === 'Completed' ? 'Replaced; dependents not verified yet' : c0 ? `Connection test ${c0.lastOk}` : 'No consumer' }),
      cell(r && r.done ? r.done : ({ 'Client certificate': '120 d ago', 'Bearer token': '33 d ago', 'API key': '48 d ago' } as Record<string, string>)[kind] || '—'),
      cell(pki ? 'Expires in 245 d' : '—'),
    ],
    kv: kv([['Managed by', pki ? 'Internal PKI · renewed 30 days before expiry' : vault], ['Last verification', c0 ? `Connection test ${c0.lastOk}${c0.health === 'Failing' ? ` · failing: ${c0.errors}` : ''}` : 'Not used by any connection'], ...rotKv(r)]),
    lists: depList(deps, r, 'Pending verification'),
    acts,
  };
}

/** Validate and save a vault backend (prototype `vForm`); returns an error or ''. */
export function saveVault(c: AdminCtx, x: Vault | null, v: FormValues): string {
  const P = c.get().pcfg;
  const ty: string = x ? x.ty : v.ty;
  const name = String(v.n ?? '').trim();
  const ep = String(v.ep ?? '').trim();
  if (!name) return 'Enter a name.';
  if (!/^https:\/\/[^\s/]+/.test(ep)) return 'Enter the HTTPS URL of the vault.';
  if (!(VTYPES[ty] ?? []).includes(v.auth)) return `${ty} supports: ${(VTYPES[ty] ?? []).join(', ')}.`;
  const id = x ? x.id : vaultId(name);
  if (!x && P.vaults.some((y) => y.id === id || y.n === name)) return 'A backend with this name exists.';
  const ns = String(v.ns ?? '').trim();
  const ev = evOf(c, 'platform');
  if (x) {
    c.set((d) => {
      const y = d.pcfg.vaults.find((z) => z.id === x.id);
      if (y) Object.assign(y, { n: name, ep, auth: v.auth, ns, st: 'Not tested', err: '' });
    });
    c.ui.toast(`${x.n} saved. Test the connection.`);
    ev('Changed vault backend', `${x.id} · ${ty} · ${ep} · ${v.auth}`, [], 'Secrets & Keys');
  } else {
    c.set((d) => {
      d.pcfg.vaults.push({ id, n: name, ty, ep, auth: v.auth, ns, caps: ['Secrets', 'Keys'], st: 'Not tested', chk: '—', by: `${c.actor} · just now` });
    });
    c.ui.toast(`${name} added. Test the connection before mapping tenants to it.`);
    ev('Added vault backend', `${id} · ${ty} · ${ep} · ${v.auth}`, [], 'Secrets & Keys');
  }
  return '';
}

/** Simulated connection test of a vault backend: hosts on .example or containing "invalid" fail. */
export function testVault(c: AdminCtx, x: Vault) {
  const ok = !/\.example|invalid/.test(x.ep);
  c.set((d) => {
    const y = d.pcfg.vaults.find((z) => z.id === x.id);
    if (!y) return;
    y.st = ok ? 'Connected' : 'Failed';
    y.chk = 'just now';
    y.err = ok ? '' : `Could not reach ${x.ep.replace(/^https:\/\//, '').split('/')[0]} (TLS handshake timed out).`;
  });
  c.ui.toast(`${x.n}: connection ${ok ? 'succeeded.' : 'failed.'}`);
  evOf(c, 'platform')('Tested vault backend', `${x.id} · ${ok ? 'succeeded' : 'failed'}`, [], 'Secrets & Keys');
}

/** Map a scope (platform or tenant) to a vault backend; returns an error or ''. */
export function saveMapping(c: AdminCtx, t: string, vname: string, mode: 'Shared' | 'Dedicated'): string {
  const P = c.get().pcfg;
  const y = P.vaults.find((z) => z.n === vname && z.st === 'Connected');
  if (!y) return 'Select a connected backend.';
  const err = mappingError(P, t, y.id, mode);
  if (err) return err;
  const m = mapOf(P, t);
  c.set((d) => {
    d.pcfg.vmap = { ...d.pcfg.vmap, [t]: { v: y.id, mode } };
  });
  const label = TN[t] || 'KAP platform';
  c.ui.toast(`${label} now uses ${y.n}. Existing secrets must be migrated before the old backend is removed.`);
  evOf(c, 'platform')('Changed tenant vault mapping', `${label} · ${m.v} (${m.mode}) → ${y.id} (${mode})`, t === 'platform' ? [] : [t as AdminTenant], 'Secrets & Keys');
  return '';
}

export function secretsScreen(c: AdminCtx, tab0: string | undefined, setTab: (t: string) => void): ScreenModel {
  const canM = c.canP('security:manage');
  const P = c.D.pcfg;
  const tab = pickTab(SECRETS_TABS, tab0);
  const head: PageHead = { title: 'Secrets & Keys', tabs: tabsOf(SECRETS_TABS), tab, setTab };
  let sections: Section[] = [];
  if (tab === 'keys') sections = [{ cols: ['Key', 'Purpose', 'Backend', 'Status', 'Last rotation', 'Rotation'], rows: P.keys.map((k) => keyRow(c, canM, k)) }];
  if (tab === 'creds')
    sections = [
      {
        sacts: canM
          ? [act('API credential policy', () => c.ui.form('API credential policy', [{ k: 'v', label: 'Maximum lifetime of tenant API credentials', type: 'select', opts: ['30 days', '60 days', '90 days', '180 days'], val: P.credPolicy.life, hint: 'Existing credentials keep their expiry.' }], 'Save', (v) => {
              const old = c.get().pcfg.credPolicy.life;
              if (v.v === old) return 'No change.';
              c.set((d) => {
                d.pcfg.credPolicy = { life: v.v, meta: [c.actor, 'just now'] };
              });
              c.ui.toast(`Maximum API credential lifetime set to ${v.v}.`);
              evOf(c, 'platform')('Changed API credential policy', `Maximum lifetime ${old} → ${v.v}`, [], 'Secrets & Keys');
              return '';
            }))]
          : [],
        tip: `Tenant API credentials expire within ${P.credPolicy.life} (changed by ${meta(P.credPolicy.meta)}).`,
        cols: ['Credential', 'Type', 'Used by', 'Secret reference', 'Status', 'Last change', 'Expiry'],
        rows: SECRETS.map((s) => credRow(c, canM, s)),
      },
    ];
  if (tab === 'vaults') {
    const vForm = (title: string, x: Vault | null) =>
      c.ui.form(title, [
        { k: 'n', label: 'Name', type: 'text', val: x ? x.n : '' },
        x ? { k: 'ty', label: 'Type', type: 'text', ro: true, val: x.ty } : { k: 'ty', label: 'Type', type: 'select', opts: Object.keys(VTYPES), val: 'Azure Key Vault' },
        { k: 'ep', label: 'Vault URL', type: 'text', val: x ? x.ep : '', ph: 'https://' },
        { k: 'auth', label: 'Authentication', type: 'select', opts: [...new Set(Object.values(VTYPES).flat())], val: x ? x.auth : 'Managed identity', hint: 'KAP authenticates with its workload identity. No secret is entered here.' },
        { k: 'ns', label: 'Namespace or mount (optional)', type: 'text', val: x ? x.ns : '' },
      ], x ? 'Save' : 'Add backend', (v) => saveVault(c, x, v));
    const remove = (x: Vault) => {
      const u = vaultUsedBy(c.get().pcfg, x.id);
      if (u.length) return c.ui.info(`Remove ${x.n}?`, `In use by ${u.join(', ')}. Map them to another backend first.`);
      c.ui.confirm(`Remove ${x.n}?`, 'KAP stops using this backend. Secrets stored in it are not deleted.', [], 'Remove', () => {
        c.set((d) => {
          d.pcfg.vaults = d.pcfg.vaults.filter((y) => y.id !== x.id);
        });
        c.ui.toast(`${x.n} removed.`);
        evOf(c, 'platform')('Removed vault backend', x.id, [], 'Secrets & Keys');
      });
    };
    const scopes = ['platform', 'sceai', 'econ', 'sandbox'];
    sections = [
      {
        title: 'Backends',
        sacts: canM ? [act('Add backend', () => vForm('Add vault backend', null))] : [],
        cols: ['Backend', 'Type', 'URL', 'Authentication', 'Used by', 'Status', 'Last check'],
        mode: 'inline',
        rows: P.vaults.map((x): Row => {
          const u = vaultUsedBy(P, x.id);
          return {
            key: `vb:${x.id}`,
            cells: [cell(x.n, { sub: x.id }), cell(x.ty), cell(x.ep, { m: true }), cell(x.auth), cell(u.join(', ') || 'Not used'), cell('', { p: x.st === 'Connected' ? ['approved', 'Connected'] : x.st === 'Failed' ? ['rejected', 'Failed'] : ['draft', x.st], tip: x.err || '' }), cell(x.chk)],
            acts: canM ? [act('Test', () => testVault(c, x)), act('Edit', () => vForm(`Edit ${x.n}`, x)), act('Remove', () => remove(x), 'ghost')] : [],
          };
        }),
      },
      {
        title: 'Tenant mapping',
        cols: ['Scope', 'Backend', 'Isolation', 'Secret path'],
        mode: 'inline',
        rows: scopes.map((t): Row => {
          const m = mapOf(P, t);
          const x = vOf(P, m.v);
          return {
            key: `vm:${t}`,
            cells: [cell(TN[t] || 'KAP platform'), cell(x.n), cell(m.mode === 'Dedicated' ? 'Dedicated vault' : t === 'platform' ? 'Platform namespace' : 'Shared · isolated namespace'), cell(refOf(P, t, 'example').replace(/example$/, '…'), { m: true })],
            acts: canM
              ? [act('Change', () => {
                  const ok = c.get().pcfg.vaults.filter((y) => y.st === 'Connected');
                  c.ui.form(`Vault for ${TN[t] || 'KAP platform'}`, [
                    { k: 'v', label: 'Backend', type: 'select', opts: ok.map((y) => y.n), val: x.n, hint: 'Only backends with a successful connection test are listed.' },
                    { k: 'mode', label: 'Isolation', type: 'select', opts: t === 'platform' ? ['Shared'] : ['Shared', 'Dedicated'], val: m.mode, hint: 'Dedicated vaults are used by one tenant only.' },
                  ], 'Save', (v) => saveMapping(c, t, v.v, v.mode));
                })]
              : [],
          };
        }),
      },
    ];
  }
  return { head, sections };
}

// ================================================================ LICENSE MANAGEMENT
export function activateLicense(c: AdminCtx, code: string): string {
  const x = code.trim().toUpperCase();
  if (!/^KAP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(x)) return 'Enter a code in the form KAP-XXXX-XXXX-XXXX.';
  c.set((d) => {
    d.pcfg.license.until = '31 Dec 2028';
    d.pcfg.license.daysLeft = 769;
    d.pcfg.license.code = x;
  });
  c.ui.toast('License activated · valid until 31 Dec 2028.');
  evOf(c, 'platform')('Activated license', x, [], 'License Management');
  return '';
}

export function licenseScreen(c: AdminCtx): ScreenModel {
  const canM = c.canP('license:manage');
  const L = c.D.pcfg.license;
  const pct = (u: number, t: number) => Math.round((u / t) * 100);
  const num = (n: number) => n.toLocaleString('en-US');
  const cap: [string, number, number][] = [['Tenants', L.tenants, 3], ['Named administrators', L.admins, c.adminCount], ['Agent runs per month', L.runs, L.runsUsed], ['GPU nodes for model serving', L.gpu, L.gpuUsed]];
  return {
    head: {
      title: 'License Management',
      add: canM
        ? act('Activate license', () => c.ui.form('Activate license', [{ k: 'code', label: 'Offline activation code', type: 'text', ph: 'KAP-XXXX-XXXX-XXXX', hint: `Issued for this installation ID: ${L.id}.` }], 'Activate', (v) => activateLicense(c, String(v.code ?? ''))), 'primary')
        : undefined,
    },
    sections: [
      { title: 'License', cols: ['Edition', 'Installation ID', 'Status', 'Valid until'], mode: 'inline', rows: [{ key: 'lic', cells: [cell(L.tier), cell(L.id, { m: true }), cell('', { p: L.daysLeft > 60 ? ['approved', 'Valid'] : ['hold', 'Expires soon'] }), cell(L.until, { sub: `${L.daysLeft} days left` })] }] },
      {
        title: 'Capacity and usage',
        cols: ['Limit', 'Licensed', 'In use', 'Usage'],
        mode: 'inline',
        rows: cap.map((r): Row => ({ key: `cap:${r[0]}`, cells: [cell(r[0]), cell(num(r[1])), cell(num(r[2])), cell('', { p: [pct(r[2], r[1]) >= 100 ? 'hold' : 'approved', `${pct(r[2], r[1])}%`] })] })),
      },
      {
        title: 'Licensed features and entitlements',
        cols: ['Feature', 'Entitlement'],
        mode: 'inline',
        rows: [...L.modules.map((m) => [m, 'Included']), ['Connector types', L.connectors.join(', ')], ['Offline activation', 'Supported · no connection to a license server needed']].map((r): Row => ({ key: `ft:${r[0]}`, cells: [cell(r[0]), cell(r[1])] })),
      },
    ],
  };
}

// ================================================================ TENANT CONFIGURATION
export const TCONFIG_TABS: [string, string][] = [['general', 'General'], ['lang', 'Language Preferences'], ['res', 'Resources & Scheduling'], ['life', 'Data Lifecycle'], ['history', 'Configuration History']];

const noTenant = (title: string): ScreenModel => ({ head: { title }, sections: [{ callout: 'This tenant has no administration settings. Select SCEAI, Economic Affairs or sandbox.' }] });

/** Change one tenant setting and record a version (prototype `tChange`); returns an error or ''. */
export function tChange(c: AdminCtx, key: string, nv: string, toast?: string): string {
  const T = c.T!;
  const ov = tGet(c.get().tcfg[T], key);
  if (String(ov) === String(nv)) return 'No change.';
  c.set((d) => {
    tSet(d.tcfg[T], key, nv);
    addHist(d.tcfg[T], tArea(key), key, ov, nv, c.actor);
  });
  c.ui.toast(toast || `${key} saved.`);
  evOf(c, 'tenant')('Changed tenant setting', `${key}: ${ov} → ${nv}`, [T], 'Tenant Configuration');
  return '';
}

export function tenantConfigScreen(c: AdminCtx, tab0: string | undefined, setTab: (t: string) => void): ScreenModel {
  const T = c.T;
  if (!T) return noTenant('Tenant Configuration');
  const canT = c.canT;
  const P = c.D.pcfg;
  const TC = c.D.tcfg[T];
  const tab = pickTab(TCONFIG_TABS, tab0);
  const head: PageHead = { title: 'Tenant Configuration', tabs: tabsOf(TCONFIG_TABS), tab, setTab };
  const f = (label: string, val: unknown, sub: string, edit: (() => void) | null, o?: { tip?: string; lock?: string }) => er(canT, label, val, sub, edit, o);
  const G = TC.general;
  const PL = P.general.langs;
  let sections: Section[] = [];
  if (tab === 'general')
    sections = [
      {
        form: true,
        rows: [
          f('Tenant ID', T, 'Set when the tenant was created', null, { lock: 'Set by the platform' }),
          f('Display name', G.display, '', () =>
            c.ui.form('Display name', [{ k: 'v', label: 'Display name', type: 'text', val: G.display }], 'Save', (v) => {
              const x = String(v.v ?? '').trim();
              if (x.length < 2 || x.length > 80) return 'Enter 2 to 80 characters.';
              return tChange(c, 'Display name', x);
            }),
          ),
          f('Administrative contact', G.contact, 'Receives platform notifications for this tenant', () =>
            c.ui.form('Administrative contact', [{ k: 'v', label: 'E-mail address', type: 'text', val: G.contact }], 'Save', (v) => {
              const x = String(v.v ?? '').trim();
              if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x)) return 'Enter a valid e-mail address.';
              return tChange(c, 'Contact address', x);
            }),
          ),
          f('Time zone', G.tz, 'Used for schedules and reports', () => c.ui.form('Time zone', [{ k: 'v', label: 'Time zone', type: 'select', opts: ['Asia/Qatar', 'Asia/Dubai', 'Asia/Riyadh', 'UTC'], val: G.tz }], 'Save', (v) => tChange(c, 'Time zone', v.v))),
          f('Identity provider', TC.idp, 'Configured by platform administrators', null, { lock: 'Managed by the platform' }),
          f('Connector types in use', G.conn.join(', ') || 'None', `From the types licensed for this installation: ${P.license.connectors.join(', ')}`, () =>
            c.ui.form('Connector types in use', [{ k: 'v', label: 'Connector types', type: 'chips', opts: P.license.connectors, val: G.conn.slice(), hint: 'Connectors of a type not selected here cannot be created.' }], 'Save', (v) =>
              tChange(c, 'Connector types in use', P.license.connectors.filter((x) => (v.v || []).includes(x)).join(', ') || '—'),
            ),
          ),
          f('Callback allowlist', G.callback, 'Hosts that may receive signed callbacks', () =>
            c.ui.form('Callback allowlist', [{ k: 'v', label: 'Host names, comma-separated', type: 'text', val: G.callback === '—' ? '' : G.callback, hint: "Callbacks are signed with this tenant's callback secret." }], 'Save', (v) => {
              const x = String(v.v ?? '').trim();
              if (x && !x.split(',').every((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h.trim()))) return 'Enter host names such as dashboards.example.gov.qa.';
              return tChange(c, 'Callback allowlist', x ? x.split(',').map((h) => h.trim()).join(', ') : '—');
            }),
          ),
        ],
      },
    ];
  if (tab === 'lang') {
    const L0 = TC.lang;
    sections = [
      {
        form: true,
        rows: [
          f('Enabled languages', langNames(L0.langs), `Chosen from the languages supported by the platform: ${langNames(PL)}`, () =>
            c.ui.form('Enabled languages', [{ k: 'v', label: 'Languages', type: 'chips', opts: PL.map((x) => LN[x]), val: L0.langs.filter((x) => PL.includes(x)).map((x) => LN[x]) }], 'Save', (v) => {
              const sel = PL.map((x) => LN[x]).filter((x) => (v.v || []).includes(x));
              if (!sel.length) return 'Select at least one language.';
              if (!sel.includes(LN[L0.def])) return `Keep the default language (${LN[L0.def]}) or change the default first.`;
              return tChange(c, 'Enabled languages', sel.join(', '));
            }),
          ),
          f('Default language', LN[L0.def], '', () => c.ui.form('Default language', [{ k: 'v', label: 'Default language', type: 'select', opts: L0.langs.map((x) => LN[x]), val: LN[L0.def] }], 'Save', (v) => tChange(c, 'Default language', v.v))),
          f('Answer language', L0.answer, 'Language agents use in their answers', () =>
            c.ui.form('Answer language', [{ k: 'v', label: 'Answer in', type: 'select', opts: ['Language of the question', 'Tenant default language'], val: L0.answer }], 'Save', (v) => tChange(c, 'Answer language', v.v)),
          ),
        ],
      },
    ];
  }
  if (tab === 'res') {
    const A = assignedOf(P, T);
    const lim = TC.lim;
    const U = TC.usage;
    const q = (name: string) => P.queues.find((x) => x[0] === name)?.[2];
    const durS = (s: string) => parseInt(s, 10);
    type Lim = keyof typeof lim;
    type RR = [string, Lim | null, string, string, string, string, { lo?: number; hi?: number; opts?: string[] }?];
    const RRs: RR[] = [
      ['kap.agent concurrency', 'agentConc', `${q('kap.agent')} in flight`, `${A.agentConc} in flight`, lim.agentConc, U.agentConc, { lo: 1, hi: +A.agentConc }],
      ['kap.pipeline concurrency', 'pipeConc', `${q('kap.pipeline')} in flight`, `${A.pipeConc} in flight`, lim.pipeConc, U.pipeConc, { lo: 1, hi: +A.pipeConc }],
      ['Requests per API credential', 'rpm', '60 / min', A.rpm, `${lim.rpm} / min`, U.rpm, { lo: 1, hi: 60 }],
      ['Max tool calls per run', 'tools', P.run.tools, 'Platform maximum', lim.tools, U.tools, { lo: 1, hi: +P.run.tools }],
      ['Max run duration', 'dur', P.run.dur, 'Platform maximum', lim.dur, U.dur, { opts: ['60 s', '120 s', '180 s', '300 s', '600 s'].filter((x) => durS(x) <= durS(P.run.dur)) }],
      ['Model tokens', null, '—', A.tokens, 'Not configurable', U.tokens],
      ['Storage', null, '—', A.storage, 'Not configurable', U.storage],
      ...(lim.oxford !== '—' ? [['Oxford Economics calls per month', 'oxford', '—', 'Set by the MCP subscription', lim.oxford, U.oxford, { lo: 1, hi: 5000 }] as RR] : []),
    ];
    const keyOf: Record<string, string> = { agentConc: 'kap.agent concurrency', pipeConc: 'kap.pipeline concurrency', rpm: 'Requests per API credential', tools: 'Max tool calls per run', dur: 'Max run duration', oxford: 'Oxford Economics calls per month' };
    sections = [
      {
        title: 'Resources and quotas',
        tip: 'Platform maximum and tenant allocation are set by platform administrators. The tenant limit applies within them.',
        cols: ['Resource', 'Platform maximum', 'Assigned to tenant', 'Tenant limit', 'Current usage'],
        mode: 'inline',
        rows: RRs.map((r): Row => {
          const [label, k, pm, as, tl, us, o] = r;
          return {
            key: `rs:${label}`,
            cells: [cell(label), cell(pm), cell(as), cell(tl), cell(us)],
            lockTip: k ? undefined : 'Set by the platform',
            acts:
              canT && k && o
                ? [act('Edit', () => c.ui.form(label, [o.opts ? { k: 'v', label: 'Tenant limit', type: 'select', opts: o.opts, val: lim[k] } : { k: 'v', label: 'Tenant limit', type: 'num', val: String(lim[k]).replace(/,/g, ''), hint: `Whole number from ${o.lo} to ${o.hi!.toLocaleString('en-US')}.` }], 'Save', (v) => {
                    if (!o.opts && !isInt(String(v.v ?? '').replace(/,/g, ''), o.lo!, o.hi!)) return `Enter a whole number from ${o.lo} to ${o.hi!.toLocaleString('en-US')}.`;
                    const nv = o.opts ? v.v : (+String(v.v).replace(/,/g, '')).toLocaleString('en-US');
                    return tChange(c, keyOf[k], nv);
                  }))]
                : [],
          };
        }),
      },
      {
        form: true,
        title: 'Scheduling',
        rows: [
          f('Bulk processing window', A.bulk, 'Assigned by the platform for scheduled pipeline runs', null, { lock: 'Set by the platform' }),
          f('Priority ceiling', A.prio, "Highest priority this tenant's kap.agent jobs can use", null, { lock: 'Set by the platform' }),
          f('Default job priority', lim.prio, 'Used when a job does not set a priority', () =>
            c.ui.form('Default job priority', [{ k: 'v', label: 'Priority', type: 'select', opts: Array.from({ length: +A.prio || 1 }, (_, i) => String(i + 1)), val: lim.prio, hint: `Up to the priority ceiling (${A.prio}).` }], 'Save', (v) => tChange(c, 'Default job priority', v.v)),
          ),
          f('Scheduled reports window', TC.sched.reports, 'When scheduled reports and agent runs are dispatched', () =>
            c.ui.form('Scheduled reports window', [{ k: 'v', label: 'Window', type: 'select', opts: ['Not restricted', 'Sunday 06:00–08:00 AST', 'Daily 05:00–07:00 AST'], val: TC.sched.reports }], 'Save', (v) => tChange(c, 'Scheduled reports window', v.v)),
          ),
        ],
      },
    ];
  }
  if (tab === 'life')
    sections = [
      {
        title: 'Retention rules',
        cols: ['Data', 'Retention', 'Then', 'Last run'],
        mode: 'inline',
        rows: TC.life.map((l): Row => ({
          key: `lf:${l[0]}`,
          cells: [cell(l[0]), cell(l[1]), cell(l[2]), cell(l[3])],
          lockTip: l[1] === 'Session close' ? 'Fixed: working memory is cleared when the session closes' : undefined,
          acts:
            canT && l[1] !== 'Session close'
              ? [act('Edit', () => c.ui.form(l[0], [
                  { k: 'r', label: 'Keep for', type: 'select', opts: ['30 days', '90 days', '180 days', '1 year', '3 years', '7 years'], val: l[1] },
                  { k: 't', label: 'Then', type: 'select', opts: ['Purge', 'Archive'], val: l[2] },
                ], 'Save', (v) => saveRetention(c, l[0], v.r, v.t)))]
              : [],
        })),
      },
      { title: 'Erasure requests', cols: ['Request', 'Scope', 'Status', 'Completed'], empty: 'No erasure requests.', mode: 'inline', rows: TC.erasure.map((e): Row => ({ key: `er:${e[0]}`, cells: [cell(e[0], { m: true }), cell(e[1]), cell(e[2]), cell(e[3])] })) },
    ];
  if (tab === 'history')
    sections = [
      histTable(c, TC.hist, (k) => tGet(TC, k), canT, (h) => {
        const err = tChange(c, h.key, h.old, `Rolled back ${h.key} to "${h.old}".`);
        if (err) c.ui.toast(err);
      }, 'th:'),
    ];
  return { head, sections };
}

/** Save a retention rule (two versioned keys); returns an error or ''. */
export function saveRetention(c: AdminCtx, data: string, keep: string, then: string): string {
  const T = c.T!;
  const l = c.get().tcfg[T].life.find((x) => x[0] === data);
  if (!l) return 'Unknown retention rule.';
  const ch = ([[`${data} · retention`, l[1], keep], [`${data} · then`, l[2], then]] as [string, string, string][]).filter((x) => x[1] !== x[2]);
  if (!ch.length) return 'No change.';
  c.set((d) => {
    ch.forEach(([k, o, nv]) => {
      tSet(d.tcfg[T], k, nv);
      addHist(d.tcfg[T], 'Data Lifecycle', k, o, nv, c.actor);
    });
  });
  c.ui.toast(`${data} retention saved.`);
  evOf(c, 'tenant')('Changed retention rule', `${data} · ${ch.map((x) => `${x[1]} → ${x[2]}`).join(', ')}`, [T], 'Tenant Configuration');
  return '';
}

// ================================================================ TENANT SECURITY & CREDENTIALS
function tenantCredRow(c: AdminCtx, T: AdminTenant, x: TenantCred): Row {
  const P = c.D.pcfg;
  const ev = evOf(c, 'tenant');
  const id = `t:${T}:${x.n}`;
  const r = c.D.rot[id];
  const dep = [x.use];
  const m = mapOf(P, T);
  const TV = vOf(P, m.v);
  const status: [DsStatus, string] = r?.stage === 'Requested' || r?.stage === 'Completed' ? ['draft', 'Not verified'] : r?.stage === 'Verification failed' ? ['rejected', 'Failing'] : r?.stage === 'Verified' ? ['approved', 'Verified'] : healthP(x.st);
  const outcome: Outcome = (tries) => ({
    [x.use]: x.n === 'sceai_dwh_reader'
      ? ['Failed', 'Cannot verify: sceai_dwh_mcp has not been used yet.']
      : x.mode === 'generate' && tries === 0
        ? ['Failed', 'Test callback rejected (401): the receiver still uses the previous secret. Update dashboards-svc, then verify again.']
        : ['Verified', x.mode === 'generate' ? 'Test callback accepted' : 'Connection check passed with the new value'],
  });
  const sched = r && r.stage && r.stage !== 'Verified' ? stagePill(r)! : rotState(r && r.done ? 0 : x.age, x.every, '');
  const acts: Action[] =
    !c.canT || r?.stage === 'Requested'
      ? []
      : r && (r.stage === 'Completed' || r.stage === 'Verification failed')
        ? [act('Verify', () => verify(c, ev, id, x.n, dep, outcome, 'Security & Credentials', [T]))]
        : x.mode === 'generate'
          ? [act('Rotate', () => c.ui.confirm(`Rotate ${x.n}?`, 'KAP generates a new secret in the tenant vault and signs callbacks with it. Receivers still using the old secret reject callbacks until they are updated; verify with a test callback afterwards.', [{ a: x.use, b: 'Will need verification', c: '' }], 'Request rotation', () => startRot(c, ev, id, x.n, dep, 'Security & Credentials', [T], 'new secret generated in the tenant vault')))]
          : [act('Replace value…', () => c.ui.form(`Replace ${x.n}`, [{ k: 'v', label: 'New value', type: 'text', ph: 'Paste the new value', hint: `Written to ${refOf(P, T, x.path)}. It is never shown again.` }], 'Replace', (v) => {
              if (String(v.v ?? '').trim().length < 12) return 'The value looks too short.';
              rotUpd(c, id, () => ({ stage: 'Completed', by: c.actor, req: 'just now', done: 'just now', doneNote: 'new version written to the tenant vault', deps: { [x.use]: 'Pending' }, tries: 0 }));
              c.ui.toast(`${x.n} replaced. Verify ${x.use} to confirm it uses the new value.`);
              ev('Replaced tenant secret', `${x.n} · value not recorded`, [T], 'Security & Credentials');
              return '';
            }))];
  return {
    key: `tc:${x.n}`,
    cells: [cell(x.n, { m: true, sub: x.pur }), cell(x.use), cell(refOf(P, T, x.path), { m: true }), cell('', { p: status, tip: r?.stage ? `Rotation: ${r.stage}` : x.chk }), cell(x.exp || '—'), cell(r && r.done ? r.done : x.rot), cell('', { p: sched, tip: x.every ? `Every ${x.every} days` : '' })],
    kv: kv([
      ['Vault', `${TV.n} · ${m.mode === 'Dedicated' ? 'dedicated' : 'shared, isolated namespace'}`],
      ['Last verification', r?.stage === 'Verified' ? `Verified ${r.ver}` : r?.stage ? 'Not yet for the new value' : x.chk],
      ['Rotation schedule', x.every ? `Every ${x.every} days` : 'Not scheduled'],
      ['How it is rotated', x.mode === 'generate' ? 'KAP generates a new secret. The receiving system must be updated; a test callback verifies it.' : 'Enter the new value issued by the provider. The consumer is checked; it is not assumed to work.'],
      ...rotKv(r),
    ]),
    lists: depList(dep, r, 'Pending verification'),
    acts,
  };
}

export function tenantSecurityScreen(c: AdminCtx): ScreenModel {
  const T = c.T;
  if (!T) return noTenant('Security & Credentials');
  const P = c.D.pcfg;
  const TC = c.D.tcfg[T];
  const kek = P.keys.find((k) => k.id === `tenant-${T}-kek`);
  const kr = kek ? c.D.rot[`key:${kek.id}`] : undefined;
  const kFlight = !!(kr && kr.stage && kr.stage !== 'Verified');
  return {
    head: { title: 'Security & Credentials' },
    sections: [
      { title: 'Credential references', cols: ['Credential', 'Used by', 'Secret reference', 'Verification', 'Expiry', 'Last change', 'Rotation'], empty: 'No credentials stored for this tenant.', rows: TC.creds.map((x) => tenantCredRow(c, T, x)) },
      {
        title: 'Tenant encryption',
        cols: ['Key', 'Purpose', 'Backend', 'Status', 'Last rotation', 'Rotation'],
        mode: 'inline',
        rows: kek
          ? [{
              key: 'kek',
              cells: [
                cell(kek.id, { m: true }), cell("Encrypts this tenant's data keys"), cell(kek.v === 'hsm' ? 'Hardware security module' : vOf(P, kek.v).n),
                cell('', { p: kFlight ? ['draft', 'Not verified'] : healthP(kek.health) }), cell(kr && kr.done ? kr.done : kek.rot),
                cell('', { p: kFlight ? stagePill(kr)! : rotState(kr && kr.done ? 0 : kek.age, kek.every, kek.mode) }),
              ],
              lockTip: 'Managed by platform administrators in Secrets & Keys',
            }]
          : [],
      },
    ],
  };
}
