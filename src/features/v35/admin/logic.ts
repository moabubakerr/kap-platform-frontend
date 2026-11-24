/**
 * Platform & tenant administration logic (prototype `platAdmin` helpers):
 * versioned setting stores for platform and tenant configuration, rotation
 * states, vault references. Pure functions over the admin data.
 */
import type { DsStatus } from '@/engine/types';
import { LC, LN, langNames, TN, type AdminTenant, type HistEntry, type Pcfg, type PlatformKey, type RotState, type Tcfg, type Vault } from '@/v35/data/admin';

export const isInt = (v: unknown, lo: number, hi: number) => /^\d+$/.test(String(v ?? '').trim()) && +String(v).trim() >= lo && +String(v).trim() <= hi;
export const meta = (m?: [string, string]) => (m ? `${m[0]} · ${m[1]}` : '');

/** Append a configuration version (prototype `H`). */
export function addHist(n: { hist: HistEntry[] }, area: string, key: string, old: unknown, nw: unknown, by: string) {
  n.hist.unshift({ v: Math.max(0, ...n.hist.map((h) => h.v)) + 1, area, key, old: old == null || old === '' ? '—' : String(old), nw: String(nw), by, at: 'just now' });
}

// ------------------------------------------------------------------ platform settings (PCFG)
type Setting<T> = [area: string, get: (n: T) => string, set: (n: T, v: string, actor: string) => void];
const gm = (n: Pcfg, k: keyof Pcfg['gmeta'], a: string) => (n.gmeta[k] = [a, 'just now']);
const sm = (n: Pcfg, k: keyof Pcfg['smeta'], a: string) => (n.smeta[k] = [a, 'just now']);
const FIXED_GUARD = ['Prompt injection', 'Jailbreak'];

export const PCFG: Record<string, Setting<Pcfg>> = {
  'Installation name': ['General', (n) => n.general.name, (n, v, a) => { n.general.name = v; gm(n, 'name', a); }],
  'Admin session timeout': ['General', (n) => n.general.timeout, (n, v, a) => { n.general.timeout = v; gm(n, 'timeout', a); }],
  'Supported interface languages': ['General', (n) => langNames(n.general.langs), (n, v, a) => {
    n.general.langs = v.split(', ').map((x) => LC[x]).filter(Boolean);
    gm(n, 'langs', a);
    if (!n.general.langs.includes(n.general.defLang)) n.general.defLang = n.general.langs[0];
  }],
  'Default interface language': ['General', (n) => LN[n.general.defLang], (n, v, a) => { n.general.defLang = LC[v]; gm(n, 'defLang', a); }],
  'External AI · max classification': ['Security Defaults', (n) => n.security.cls, (n, v, a) => { n.security.cls = v; sm(n, 'cls', a); }],
  'Personal data to external services': ['Security Defaults', (n) => n.security.pii, (n, v, a) => { n.security.pii = v; sm(n, 'pii', a); }],
  'Outbound network access': ['Security Defaults', (n) => n.security.egress, (n, v, a) => { n.security.egress = v; sm(n, 'egress', a); }],
  'AI input guardrails': ['Security Defaults', (n) => [...FIXED_GUARD, ...n.security.guard].join(', '), (n, v, a) => { n.security.guard = v.split(', ').filter((x) => !FIXED_GUARD.includes(x)); sm(n, 'guard', a); }],
  'Dispatch order': ['Workloads & Scheduling', (n) => n.sched.dispatch, (n, v) => { n.sched.dispatch = v; }],
  'Retries · kap.agent': ['Workloads & Scheduling', (n) => n.sched['kap.agent'], (n, v) => { n.sched['kap.agent'] = v; }],
  'Retries · kap.pipeline': ['Workloads & Scheduling', (n) => n.sched['kap.pipeline'], (n, v) => { n.sched['kap.pipeline'] = v; }],
  'Max tool calls per run': ['Workloads & Scheduling', (n) => n.run.tools, (n, v) => { n.run.tools = v; }],
  'Max run duration': ['Workloads & Scheduling', (n) => n.run.dur, (n, v) => { n.run.dur = v; }],
};

const ALLOC_COL: Record<string, number> = { 'fair share': 2, 'max in flight': 3, 'priority ceiling': 4, 'bulk window': 5 };
/** "SCEAI · kap.agent · max in flight" → [tenant, queue, column] */
export function allocKey(k: string): [AdminTenant, string, number] | null {
  const m = /^(.*) · (kap\.\w+) · (fair share|max in flight|priority ceiling|bulk window)$/.exec(k);
  if (!m) return null;
  const t = Object.keys(TN).find((x) => TN[x] === m[1]) as AdminTenant | undefined;
  return t ? [t, m[2], ALLOC_COL[m[3]]] : null;
}
export function pGet(n: Pcfg, k: string): string | undefined {
  if (PCFG[k]) return PCFG[k][1](n);
  const a = allocKey(k);
  if (a) return n.alloc.find((x) => x[0] === a[0] && x[1] === a[1])?.[a[2]] as string | undefined;
  return undefined;
}
export function pSet(n: Pcfg, k: string, v: string, actor: string) {
  if (PCFG[k]) return PCFG[k][2](n, v, actor);
  const a = allocKey(k);
  if (a) {
    const r = n.alloc.find((x) => x[0] === a[0] && x[1] === a[1]);
    if (r) (r as string[])[a[2]] = v;
  }
}
export const pArea = (k: string) => (PCFG[k] ?? ['Workloads & Scheduling'])[0];

// ------------------------------------------------------------------ tenant settings (TS)
export const TS: Record<string, Setting<Tcfg>> = {
  'Display name': ['General', (n) => n.general.display, (n, v) => { n.general.display = v; }],
  'Contact address': ['General', (n) => n.general.contact, (n, v) => { n.general.contact = v; }],
  'Time zone': ['General', (n) => n.general.tz, (n, v) => { n.general.tz = v; }],
  'Callback allowlist': ['General', (n) => n.general.callback, (n, v) => { n.general.callback = v; }],
  'Connector types in use': ['General', (n) => n.general.conn.join(', '), (n, v) => { n.general.conn = v === '—' || v === '' ? [] : v.split(', '); }],
  'Enabled languages': ['Language Preferences', (n) => langNames(n.lang.langs), (n, v) => {
    n.lang.langs = v.split(', ').map((x) => LC[x]).filter(Boolean);
    if (!n.lang.langs.includes(n.lang.def)) n.lang.def = n.lang.langs[0];
  }],
  'Default language': ['Language Preferences', (n) => LN[n.lang.def], (n, v) => { n.lang.def = LC[v]; }],
  'Answer language': ['Language Preferences', (n) => n.lang.answer, (n, v) => { n.lang.answer = v; }],
  'kap.agent concurrency': ['Resources & Scheduling', (n) => n.lim.agentConc, (n, v) => { n.lim.agentConc = v; }],
  'kap.pipeline concurrency': ['Resources & Scheduling', (n) => n.lim.pipeConc, (n, v) => { n.lim.pipeConc = v; }],
  'Requests per API credential': ['Resources & Scheduling', (n) => n.lim.rpm, (n, v) => { n.lim.rpm = v; }],
  'Max tool calls per run': ['Resources & Scheduling', (n) => n.lim.tools, (n, v) => { n.lim.tools = v; }],
  'Max run duration': ['Resources & Scheduling', (n) => n.lim.dur, (n, v) => { n.lim.dur = v; }],
  'Oxford Economics calls per month': ['Resources & Scheduling', (n) => n.lim.oxford, (n, v) => { n.lim.oxford = v; }],
  'Default job priority': ['Resources & Scheduling', (n) => n.lim.prio, (n, v) => { n.lim.prio = v; }],
  'Scheduled reports window': ['Resources & Scheduling', (n) => n.sched.reports, (n, v) => { n.sched.reports = v; }],
};
const lifeOf = (n: Tcfg, k: string) => n.life.find((x) => k === `${x[0]} · retention` || k === `${x[0]} · then`);
export function tGet(n: Tcfg, k: string): string | undefined {
  if (TS[k]) return TS[k][1](n);
  const l = lifeOf(n, k);
  return l ? (k.endsWith('retention') ? l[1] : l[2]) : undefined;
}
export function tSet(n: Tcfg, k: string, v: string) {
  if (TS[k]) return TS[k][2](n, v, '');
  const l = lifeOf(n, k);
  if (l) l[k.endsWith('retention') ? 1 : 2] = v;
}
export const tArea = (k: string) => (TS[k] ?? ['Data Lifecycle'])[0];

// ------------------------------------------------------------------ rotation and health
export const rotState = (age: number, every: number, mode: string): [DsStatus, string] =>
  mode === 'hsm' ? ['draft', 'Managed in HSM'] : !every ? ['draft', 'No schedule'] : age > every ? ['rejected', `Overdue ${age - every} d`] : every - age <= 14 ? ['hold', `Due in ${every - age} d`] : ['approved', `Due in ${every - age} d`];
export const healthP = (h: string): [DsStatus, string] => [h === 'Verified' ? 'approved' : h === 'Failing' ? 'rejected' : 'draft', h];
export const stagePill = (r?: RotState): [DsStatus, string] | null =>
  !r || !r.stage ? null : r.stage === 'Requested' ? ['submitted', 'Rotation requested'] : r.stage === 'Completed' ? ['hold', 'Completed · not verified'] : r.stage === 'Verified' ? ['approved', 'Verified'] : ['rejected', 'Verification failed'];
export const rotKv = (r?: RotState): [string, string][] =>
  r && r.stage
    ? [
        ['Rotation status', r.stage + (r.stage === 'Verification failed' ? ' · fix the dependent and verify again' : '')],
        ['Requested', `${r.by || ''} · ${r.req || ''}`],
        ['Completed', r.done ? r.done + (r.doneNote ? ` · ${r.doneNote}` : '') : 'Not yet'],
        ['Verified', r.stage === 'Verified' ? r.ver ?? '' : 'Not yet'],
      ]
    : [];
export const depList = (deps: string[], r: RotState | undefined, pend: string) => [
  { title: 'Dependent services', items: deps.map((d) => ({ a: d, b: r?.deps?.[d] ? (r.deps[d] === 'Pending' ? pend : r.deps[d]) : 'In use', c: r?.detail?.[d] ?? '' })), empty: 'No dependent services' },
];

// ------------------------------------------------------------------ vault backends
export const VTYPES: Record<string, string[]> = {
  'Azure Key Vault': ['Managed identity', 'Service principal'],
  OpenBao: ['Kubernetes service account', 'AppRole'],
  'HashiCorp Vault': ['Kubernetes service account', 'AppRole'],
  'AWS Secrets Manager': ['IAM role'],
  'Google Secret Manager': ['Workload identity'],
};
export const vOf = (P: Pcfg, id: string): Vault => P.vaults.find((x) => x.id === id) ?? { id, n: id, ty: '', ep: '', auth: '', ns: '', caps: [], st: 'Unknown', chk: '—', by: '' };
export const vName = (P: Pcfg, id: string) => (id === 'hsm' ? 'Hardware security module' : `${vOf(P, id).n} · ${vOf(P, id).ty}`);
export const mapOf = (P: Pcfg, t: string) => P.vmap[t] ?? { v: 'kap-vault', mode: 'Shared' as const };
/** Secret reference in the scope's vault (prototype `refOf`). */
export function refOf(P: Pcfg, t: string, path: string) {
  const m = mapOf(P, t);
  const x = vOf(P, m.v);
  const leaf = path.split('/').pop() ?? path;
  return `${x.id} · ${x.ty === 'Azure Key Vault' ? `secrets/${m.mode === 'Shared' ? `${t}-` : ''}${leaf.replace(/_/g, '-')}` : `${t === 'platform' ? 'platform/' : `tenants/${t}/`}${leaf}`}`;
}
export const rotHow = (P: Pcfg, k: PlatformKey) =>
  k.v === 'hsm' ? k.how : vOf(P, k.v).ty === 'Azure Key Vault' ? `Creates a new key version in ${vOf(P, k.v).n}. ${k.how.split('. ').slice(1).join('. ')}` : k.how;
export const vaultUsedBy = (P: Pcfg, id: string) => Object.entries(P.vmap).filter(([, m]) => m.v === id).map(([t]) => TN[t] || 'KAP platform');
export const vaultId = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

/** Error for a tenant vault mapping change, or '' (prototype tenant mapping form). */
export function mappingError(P: Pcfg, t: string, vid: string, mode: string): string {
  const m = mapOf(P, t);
  const y = P.vaults.find((z) => z.id === vid);
  if (!y || y.st !== 'Connected') return 'Select a connected backend.';
  if (y.id === m.v && mode === m.mode) return 'No change.';
  if (mode === 'Dedicated' && Object.entries(P.vmap).some(([t2, m2]) => t2 !== t && m2.v === y.id)) return `${y.n} is used by other scopes and cannot be dedicated.`;
  if (mode === 'Shared' && Object.entries(P.vmap).some(([t2, m2]) => t2 !== t && m2.v === y.id && m2.mode === 'Dedicated')) return `${y.n} is dedicated to another tenant.`;
  return '';
}
