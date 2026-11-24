/**
 * Platform hub logic (pure): Model Providers Registry (`regScreen`,
 * `regToggleTenant`, `mres`), MCP Registry (`mcpScreen` platform view and the
 * server form), Platform Overview and Tenants (`platformOps`, `telemetry`),
 * and the dashboard charts (`overview`). Pages render these values; every
 * mutation returns a new state plus the toast and audit events to record.
 */
import type { DsStatus } from '@/engine/types';
import {
  ACTIVITY_SERIES, CONN_TYPES, CONTRACTS, INSTALL, MCP_DISCOVERY, MODEL_CATALOG, MODEL_TYPES, OPS_ALERTS, PERIOD_JOBS, PERIOD_LABEL, PLATFORM_SECRETS, ROLE, ROLES, SIM_TESTS, TKEYS, TN,
  type Conn, type Dep, type McpRegistry, type McpServer, type McpTool, type ModelType, type Period, type Registry, type Role, type TenantRec, type TenantStatus, type TKey,
} from '@/v35/data/platform';

export interface Ev { action: string; res: string; tenants: TKey[]; lvl?: 'platform' | 'tenant' }
export interface Applied<S> { next: S; msg: string; evs: Ev[] }

const clone = <S,>(s: S): S => structuredClone(s);

// ====================================================================== model registry: derivations

export const HP: Record<string, DsStatus> = { Healthy: 'approved', Degraded: 'hold', Failing: 'rejected', 'Not checked': 'draft' };

export const typeOf = (d: Pick<Dep, 'type' | 'caps'>) => d.type || (d.caps.includes('Embeddings') ? 'Embedding' : 'LLM');
export const mtOf = (ty: string): ModelType => MODEL_TYPES[ty] || MODEL_TYPES.Other;
export const connOf = (R: Registry, id: string) => R.conns.find((c) => c.id === id);
export const usable = (R: Registry, d: Dep) => {
  const c = connOf(R, d.conn);
  return d.status === 'Active' && !!c && c.status === 'Enabled';
};
export const availTo = (d: Dep, t: TKey) => d.all || d.ten.includes(t);
export const tenOf = (d: Dep): TKey[] => (d.all ? TKEYS : d.ten);

export interface DepUse { t: string; k: string; n: string; tk: TKey }
/** Agents, collections, pipelines and tenant defaults that use a model. */
export function depsOf(R: Registry, d: Dep): DepUse[] {
  const direct = R.mref.filter((m) => m[3] === d.id).map(([t, k, n]) => ({ t: TN[t], k, n, tk: t }));
  const viaDef = R.mref
    .filter((m) => m[3].startsWith('default:') && R.tDef[m[0]][m[3].slice(8) as Role] === d.id)
    .map(([t, k, n, ref]) => ({ t: TN[t], k, n: `${n} (via ${ROLE[ref.slice(8) as Role][0].toLowerCase()})`, tk: t }));
  const defs = TKEYS.flatMap((t) => ROLES.filter((r) => R.tDef[t][r] === d.id).map((r) => ({ t: TN[t], k: 'Tenant default', n: ROLE[r][0], tk: t })));
  return [...direct, ...viaDef, ...defs];
}

/** Does tenant `t` use model `id` (directly, through a default, or as a default)? */
export const usedIn = (R: Registry, id: string, t: TKey) =>
  R.mref.some((m) => m[0] === t && (m[3] === id || (m[3].startsWith('default:') && R.tDef[t][m[3].slice(8) as Role] === id))) || Object.values(R.tDef[t]).includes(id);

export const credLabel = (v: string) =>
  v === 'managed' ? 'Managed identity' : v === 'none' ? 'None (internal network)' : v ? `${v.split('/').pop()} · ${PLATFORM_SECRETS.find((s) => s[0] === v)?.[1] || 'Secret'}` : '';
export const authOf = (v: string) => (v === 'managed' ? 'Microsoft Entra ID (managed identity)' : v === 'none' ? 'None (internal network)' : /cert/.test(v) ? 'mTLS client certificate' : /token/.test(v) ? 'Bearer token' : 'API key');
export const credOf = (c: Pick<Conn, 'auth' | 'secret'>) => (/managed identity/.test(c.auth) ? 'managed' : /^None/.test(c.auth) ? 'none' : c.secret);

/** Resolve the model an agent / collection / role uses in a tenant (prototype `mres`). */
export function mres(R: Registry, t: TKey, n: string) {
  const M = R.mref.find((x) => x[0] === t && x[2] === n);
  const role = M ? (M[3].startsWith('default:') ? M[3].slice(8) : null) : n;
  const id = M ? (role ? R.tDef[t][role as Role] : M[3]) : R.tDef[t][n as Role];
  const d = R.deps.find((x) => x.id === id);
  const c = d && connOf(R, d.conn);
  const ok = !!d && d.status === 'Active' && !!c && c.status === 'Enabled' && (d.all || d.ten.includes(t));
  return { id, role, model: d ? d.model : 'not registered', short: d ? d.model.replace('-Instruct', '') : id, ok, ref: (role ? `${role}_default → ` : '') + id, dims: d && d.dims ? `${d.dims}-d` : '' };
}

/** Simulated provider test (prototype `simOf`). */
export function simOf(model: string, ep: string): { ok: boolean; msg?: string; caps: string[]; lat: string } {
  if ((ep || '').includes('.example')) return { ok: false, msg: `TLS handshake timed out after 10 s at ${ep.replace(/^https:\/\//, '').split('/')[0]}.`, caps: [], lat: '' };
  const r = SIM_TESTS[model];
  return r ? { ok: true, caps: r[0], lat: r[1] } : { ok: true, caps: [], lat: '1.4 s' };
}
export const testMsg = (r: ReturnType<typeof simOf>, caps: string[]) =>
  !r.ok ? r.msg! : `Response in ${r.lat}${r.caps.length ? ` · verified: ${r.caps.filter((x) => caps.includes(x)).join(', ') || 'none of the selected'}` : ' · capabilities could not be verified'}`;

export interface DepRow {
  d: Dep;
  ty: string;
  prov: string;
  cn: string;
  on: boolean;
  status: [DsStatus, string];
  health: [DsStatus, string];
  availL: string;
  cfg: [string, string, boolean?][];
  ops: [string, string][];
  uses: DepUse[];
}

export function depRows(R: Registry, q: string): DepRow[] {
  const qq = q.trim().toLowerCase();
  return R.deps
    .filter((d) => !qq || `${d.id} ${d.model} ${typeOf(d)} ${connOf(R, d.conn)?.n ?? ''}`.toLowerCase().includes(qq))
    .map((d) => depRow(R, d));
}

export function depRow(R: Registry, d: Dep): DepRow {
  const c = connOf(R, d.conn) ?? ({ n: '—', type: '', ep: '', auth: '', secret: '' } as unknown as Conn);
  const on = d.status === 'Active';
  const ty = typeOf(d);
  const M = mtOf(ty);
  const managed = c.type !== 'vLLM (self-hosted)';
  const shared = R.deps.filter((x) => x.conn === d.conn).length;
  const ver = (d.verified || []).filter((x) => d.caps.includes(x));
  const unver = d.caps.filter((x) => !ver.includes(x));
  const P = d.params || {};
  const dx = d as unknown as Record<string, string>;
  const cfg = ([
    ['Model', d.model],
    ['Model type', ty],
    d.vendor ? ['Vendor', d.vendor] : null,
    ['Connection', c.n + (shared > 1 ? ` · shared by ${shared} models` : '')],
    ['Connection type', c.type],
    ['Endpoint', c.ep, true],
    d.contract ? ['API contract', d.contract] : null,
    c.type === 'Azure OpenAI' ? ['Azure deployment', d.did, true] : null,
    ['Credential', credLabel(credOf(c))],
    M.fixed ? null : [`Verified ${M.capL.toLowerCase()}`, ver.join(', ') || 'None'],
    !M.fixed && unver.length ? ['Configured, not verified', unver.join(', ')] : null,
    M.fixed ? ['Verified', ver.length ? 'Yes' : 'No'] : null,
    M.langs && P.langs ? ['Languages', P.langs.join(', ')] : null,
    d.dims ? ['Dimensions', d.dims] : null,
    ...M.params.filter(([k]) => k !== 'dims' && (P[k] || dx[k])).map(([k, l]) => [l.replace(/ \(.*\)$/, ''), (P[k] || dx[k]) + (/tokens/.test(l) ? ' tokens' : '')]),
    d.tpm || d.conc || d.reserve ? ['Endpoint limits', [d.tpm ? `${d.tpm} tokens/min` : '', d.conc ? `${d.conc} concurrent` : '', d.reserve ? `${d.reserve}% interactive reserve` : ''].filter(Boolean).join(' · ')] : null,
    d.peak ? ['Peak use · 24 h', d.peak] : null,
    !managed && d.serving ? ['Serving', d.serving] : null,
  ] as ([string, string, boolean?] | null)[]).filter((x): x is [string, string, boolean?] => !!x);
  const ops: [string, string][] = [['Health', d.health], ['Last check', d.lastOk], ['Errors', d.errors], ['Requests', d.req], ['Latency', d.lat], [managed ? 'Quota' : 'GPU', d.util]];
  if (d.kill) ops.push(['Emergency disable', `${d.kill.by} · ${d.kill.at} · ${d.kill.reason} · audit ${d.kill.ref}`]);
  return {
    d, ty, cn: c.n, on, cfg, ops,
    prov: CONN_TYPES[c.type]?.s ?? c.type,
    status: on ? ['approved', 'Enabled'] : ['draft', 'Disabled'],
    health: [HP[d.health] || 'draft', d.health],
    availL: d.all ? 'All tenants' : d.ten.length ? d.ten.map((t) => TN[t]).join(', ') : 'None',
    uses: depsOf(R, d),
  };
}

// ====================================================================== model registry: changes

/** Apply a test result to a model (prototype `test`). */
export function applyTest(R: Registry, id: string): Applied<Registry> & { ok: boolean } {
  const next = clone(R);
  const x = next.deps.find((y) => y.id === id)!;
  const c = connOf(R, x.conn);
  const r = simOf(x.model, c?.ep ?? '');
  if (r.ok) {
    x.lastOk = 'just now';
    x.health = 'Healthy';
    x.verified = r.caps.filter((y) => x.caps.includes(y));
    x.lat = `p95 ${r.lat}`;
  } else {
    x.health = 'Failing';
    x.errors = 'Last test failed';
  }
  return { next, ok: r.ok, msg: testMsg(r, x.caps), evs: [] };
}

export function setDepStatus(R: Registry, id: string, on: boolean): Applied<Registry> {
  const next = clone(R);
  const x = next.deps.find((y) => y.id === id)!;
  x.status = on ? 'Active' : 'Disabled';
  if (on) {
    x.health = 'Not checked';
    x.lastOk = '—';
  }
  return { next, msg: `Model "${id}" ${on ? 'enabled' : 'disabled'}.`, evs: [{ action: on ? 'Enabled model' : 'Disabled model', res: id, tenants: tenOf(x) }] };
}

export function deleteDep(R: Registry, id: string): Applied<Registry> {
  const next = clone(R);
  const d = next.deps.find((x) => x.id === id)!;
  next.deps = next.deps.filter((x) => x.id !== id);
  if (!next.deps.some((x) => x.conn === d.conn)) next.conns = next.conns.filter((c) => c.id !== d.conn);
  return { next, msg: `Model "${id}" deleted.`, evs: [{ action: 'Deleted model', res: id, tenants: tenOf(d) }] };
}

export function revokeDep(R: Registry, id: string, t: TKey): Applied<Registry> {
  const next = clone(R);
  const x = next.deps.find((y) => y.id === id)!;
  if (x.all) {
    x.all = false;
    x.ten = TKEYS.filter((k) => k !== t);
  } else x.ten = x.ten.filter((k) => k !== t);
  return { next, msg: `"${id}" withdrawn from ${TN[t]}.`, evs: [{ action: 'Withdrew model from tenant', res: `${id} · ${TN[t]}`, tenants: [t] }] };
}

/**
 * Tenant availability toggle (prototype `regToggleTenant`). `k` = 'all' toggles
 * All tenants / Selected tenants. Withdrawing from a tenant that uses the model
 * needs a confirmation first.
 */
export function toggleTenant(R: Registry, id: string, k: TKey | 'all'): Applied<Registry> | { confirm: TKey } {
  const next = clone(R);
  const d = next.deps.find((x) => x.id === id)!;
  if (k === 'all') {
    if (d.all) {
      d.all = false;
      d.ten = TKEYS.filter((t) => usedIn(R, id, t));
      return { next, msg: `"${id}" ${d.ten.length ? `available to ${d.ten.map((t) => TN[t]).join(', ')} only.` : 'not available to any tenant.'}`, evs: [{ action: 'Restricted model to selected tenants', res: id, tenants: TKEYS }] };
    }
    d.all = true;
    d.ten = [];
    return { next, msg: `"${id}" available to all tenants.`, evs: [{ action: 'Made model available to all tenants', res: id, tenants: TKEYS }] };
  }
  const on = d.all || d.ten.includes(k);
  if (on) {
    if (usedIn(R, id, k)) return { confirm: k };
    if (d.all) {
      d.all = false;
      d.ten = TKEYS.filter((t) => t !== k);
    } else d.ten = d.ten.filter((t) => t !== k);
    return { next, msg: `"${id}" withdrawn from ${TN[k]}.`, evs: [{ action: 'Withdrew model from tenant', res: id, tenants: [k] }] };
  }
  d.ten.push(k);
  return { next, msg: `"${id}" made available to ${TN[k]}.`, evs: [{ action: 'Made model available to tenant', res: id, tenants: [k] }] };
}

export function validateKill(id: string, v: { reason?: string; ack?: string }) {
  if ((v.reason || '').trim().length < 8) return 'Enter the reason (at least 8 characters).';
  if (v.ack !== `Disable ${id} now`) return 'Confirm the emergency disable.';
  return '';
}

export function applyKill(R: Registry, id: string, reason: string, actor: string, ref: string): Applied<Registry> {
  const next = clone(R);
  const x = next.deps.find((y) => y.id === id)!;
  const k = { by: actor, at: 'just now', reason: reason.trim(), ref };
  x.status = 'Disabled';
  x.kill = k;
  return { next, msg: `${id} disabled immediately · audit ${ref}.`, evs: [{ action: 'Emergency disabled model', res: `${id} · ${k.reason} · ${ref}`, tenants: tenOf(x) }] };
}

// ====================================================================== model form

export interface ConnFields { ep: string; cred: string; region: string; apiver: string; tls: string; timeout: string }
export interface ModelValues {
  id: string;
  type: string;
  conn: string;
  connMode: 'existing' | 'new';
  ctype: string;
  editConn: boolean;
  c: ConnFields;
  contract: string;
  model: string;
  did: string;
  vendor: string;
  caps: string[];
  dims: string;
  params: Record<string, any>;
  limit: string;
  tpm: string;
  conc: string;
  reserve: string;
  all: boolean;
  ten: TKey[];
  adv: boolean;
  tested: { ok: boolean; lat: string } | null;
  verified: string[] | null;
}
export interface ModelForm { mode: 'add' | 'edit'; id?: string; v: ModelValues }

export const newConnFields = (ct: string): ConnFields => ({ ep: '', cred: '', region: '', apiver: ct === 'Azure OpenAI' ? '2024-10-21' : '', tls: ct === 'vLLM (self-hosted)' ? 'Internal CA · kap-ca' : 'Public CA', timeout: ct === 'Azure OpenAI' ? '60' : '30' });
export const connFieldsOf = (c: Conn): ConnFields => ({ ep: c.ep, cred: credOf(c), region: c.region, apiver: c.apiver, tls: c.tls, timeout: c.timeout });
export const compatConns = (R: Registry, ty: string) => R.conns.filter((c) => mtOf(ty).conns.includes(c.type));

export function blankModel(R: Registry, ty: string): ModelValues {
  const ex = compatConns(R, ty)[0];
  const M = mtOf(ty);
  return { id: '', type: ty, conn: ex ? ex.id : '', connMode: ex ? 'existing' : 'new', ctype: ex ? ex.type : M.conns[0], editConn: false, c: ex ? connFieldsOf(ex) : newConnFields(M.conns[0]), contract: '', model: '', did: '', vendor: '', caps: M.fixed ? M.caps.slice() : [], dims: '', params: {}, limit: '', tpm: '', conc: '', reserve: '', all: false, ten: [], adv: false, tested: null, verified: null };
}

export function editModel(R: Registry, d: Dep): ModelForm {
  const cc = connOf(R, d.conn);
  return {
    mode: 'edit',
    id: d.id,
    v: {
      id: d.id, type: typeOf(d), conn: d.conn, connMode: 'existing', ctype: cc?.type ?? '', editConn: false,
      c: cc ? connFieldsOf(cc) : newConnFields('REST API'),
      contract: d.contract || '', model: d.model, did: d.did, vendor: d.vendor || '', caps: d.caps.slice(), dims: d.dims, params: clone(d.params || {}),
      limit: d.limit, tpm: d.tpm || '', conc: d.conc || '', reserve: d.reserve || '', all: d.all, ten: d.ten.slice(), adv: false, tested: null, verified: null,
    },
  };
}

/** Form-level facts (prototype `rf`). */
export function formInfo(R: Registry, F: ModelForm) {
  const v = F.v;
  const M = mtOf(v.type);
  const isNew = v.connMode === 'new';
  const showConn = isNew || v.editConn;
  const ec = isNew ? undefined : connOf(R, v.conn);
  const ctype = isNew ? v.ctype : ec ? ec.type : '';
  const C = CONN_TYPES[ctype] || { key: 'rest', creds: [], s: ctype };
  const exist = compatConns(R, v.type);
  const others = ec ? R.deps.filter((d) => d.conn === ec.id && d.id !== F.id).length : 0;
  const known = MODEL_CATALOG[v.model.trim()];
  const needContract = ctype === 'REST API' || ctype === 'gRPC';
  const credVals = [...C.creds, ...PLATFORM_SECRETS.filter((s) => s[2] === C.key).map((s) => s[0])];
  const ver = v.tested && v.tested.ok ? v.verified || [] : null;
  const vs = ver ? v.caps.filter((x) => ver.includes(x)) : [];
  const nv = v.caps.filter((x) => !vs.includes(x));
  const capStatus = !v.caps.length ? '' : ver ? (vs.length ? `Verified: ${vs.join(', ')}` : '') + (vs.length && nv.length ? ' · ' : '') + (nv.length ? `Not verified: ${nv.join(', ')}` : '') : 'Not verified';
  const sharedWarn = v.editConn && others > 0 ? `Changes apply to ${others}${others === 1 ? ' other model' : ' other models'} on this connection. ${others === 1 ? 'It' : 'They'} will need to be tested again.` : '';
  return {
    M, isNew, showConn, ec, ctype, exist, others, known, needContract, credVals, capStatus, sharedWarn,
    isAzure: ctype === 'Azure OpenAI',
    connLabel: (c: Conn) => `${c.n} (${R.deps.filter((d) => d.conn === c.id).length})`,
    connSummary: ec && !v.editConn ? `${ec.type} · ${ec.ep} · ${credLabel(credOf(ec))}` : '',
    contracts: (CONTRACTS[v.type] || []).map((x) => x + (ctype === 'gRPC' ? ' · gRPC' : ' · REST')),
  };
}

function validateConn(R: Registry, F: ModelForm) {
  const { showConn, isNew, ctype } = formInfo(R, F);
  const v = F.v;
  if (!showConn) return '';
  if (!/^https:\/\/[^/]+/.test(v.c.ep || '')) return 'Enter an HTTPS endpoint.';
  if (isNew) {
    const dup = R.conns.find((c) => c.ep.replace(/\/$/, '') === v.c.ep.trim().replace(/\/$/, ''));
    if (dup) return `A connection to this endpoint already exists (${dup.n}). Select it under Use existing connection.`;
  }
  if (!v.c.cred) return 'Select a credential.';
  if (ctype === 'Azure OpenAI' && !(v.c.apiver || '').trim()) return 'Enter the Azure API version (Advanced settings).';
  if (!(+v.c.timeout > 0)) return 'Enter a timeout in seconds (Advanced settings).';
  return '';
}

export function validateModel(R: Registry, F: ModelForm): string {
  const v = F.v;
  const { M, isNew, ec, ctype, needContract, known } = formInfo(R, F);
  const P = v.params || {};
  const vx = v as unknown as Record<string, string>;
  if (!/^[a-z0-9][a-z0-9-]{2,}$/.test(v.id)) return 'Name: use lower-case letters, digits and hyphens.';
  if (R.deps.some((d) => d.id === v.id && d.id !== F.id)) return 'A model with this name already exists.';
  if (!isNew && !ec) return 'Select a connection.';
  const ce = validateConn(R, F);
  if (ce) return ce;
  if (needContract && !v.contract) return `Select the API contract for this ${ctype} connection.`;
  if (!v.model.trim()) return 'Enter the model.';
  if (known && !known.some((x) => M.caps.includes(x))) return `${v.model.trim()} is not a ${v.type} model.`;
  if (ctype === 'Azure OpenAI' && !v.did.trim()) return 'Enter the Azure deployment.';
  if (!v.caps.length) return `Select at least one ${M.capL.toLowerCase().replace(/s$/, '')}.`;
  if (known) {
    const bad = v.caps.filter((x) => !known.includes(x));
    if (bad.length) return `${v.model.trim()} does not support ${bad.join(', ')}.`;
  } else if (!(v.tested && v.tested.ok)) return `${v.model.trim()} is not in the model catalog. Run Test before saving.`;
  const miss = M.params.filter((x) => !x[3]).find(([k]) => !(P[k] || vx[k]));
  if (miss) return `Enter ${miss[1].toLowerCase()}.`;
  if (M.langs && !(P.langs || []).length) return 'Select at least one language.';
  if (v.conc && !(+v.conc > 0)) return 'Max concurrent requests must be a whole number (Advanced settings).';
  if (v.reserve && !(+v.reserve >= 0 && +v.reserve < 100)) return 'Interactive reserve must be between 0 and 99 % (Advanced settings).';
  if (!v.all && !v.ten.length) return 'Select at least one tenant, or choose All tenants.';
  return '';
}

/** Test from the form: an error message before testing, or the simulated result. */
export function testModelForm(R: Registry, F: ModelForm): { err: string } | { ok: boolean; msg: string; tested: { ok: boolean; lat: string }; verified: string[] | null } {
  const v = F.v;
  const { M, isNew, ec, needContract, showConn } = formInfo(R, F);
  if (!isNew && !ec) return { err: 'Select a connection.' };
  const ce = validateConn(R, F);
  if (ce) return { err: ce };
  if (needContract && !v.contract) return { err: 'Select the API contract before testing.' };
  const m = v.model.trim();
  if (!m) return { err: 'Enter the model before testing.' };
  const r = simOf(m, showConn ? v.c.ep : ec!.ep);
  if (r.ok) r.caps = r.caps.filter((x) => M.caps.includes(x));
  return { ok: r.ok, msg: r.ok ? testMsg(r, v.caps.length ? v.caps : r.caps) : r.msg!, tested: { ok: r.ok, lat: r.lat }, verified: r.ok ? r.caps : null };
}

/** Save the form (prototype `rf.save`): returns the new registry, toast and audit events. */
export function applyModel(R: Registry, F: ModelForm, actor: string, now = Date.now()): Applied<Registry> & { id: string } {
  const v = F.v;
  const isEdit = F.mode === 'edit';
  const { isNew, ec, ctype, needContract } = formInfo(R, F);
  const id = isEdit ? F.id! : v.id;
  let cid = v.conn;
  const host = (v.c.ep || '').replace(/^https:\/\//, '').split('/')[0];
  const cfields = { ep: v.c.ep.trim(), auth: authOf(v.c.cred), secret: /^secret\//.test(v.c.cred) ? v.c.cred : '', region: v.c.region || '', apiver: v.c.apiver || '', tls: v.c.tls, timeout: v.c.timeout };
  const T0 = v.tested;
  const prev = isEdit ? R.deps.find((d) => d.id === F.id) : undefined;
  const hv: Partial<Dep> = T0
    ? T0.ok
      ? { health: 'Healthy', lastOk: 'just now', errors: '0 in 24 h', lat: `p95 ${T0.lat}`, verified: (v.verified || []).filter((x) => v.caps.includes(x)) }
      : { health: 'Failing', errors: 'Last test failed', verified: [] }
    : prev && !v.editConn && prev.model === v.model.trim() && prev.conn === cid && (prev.contract || '') === (v.contract || '')
      ? { verified: (prev.verified || []).filter((x) => v.caps.includes(x)) }
      : { health: 'Not checked', lastOk: '—', verified: [] };
  const P = { ...(v.params || {}) };
  const dep: Partial<Dep> = {
    id, type: v.type,
    did: ctype === 'Azure OpenAI' ? v.did.trim() : isEdit && prev && prev.model === v.model.trim() ? prev.did : v.model.trim(),
    model: v.model.trim(), vendor: (v.vendor || '').trim(), contract: needContract ? v.contract : '', caps: v.caps, cat: v.type,
    dims: v.type === 'Embedding' ? P.dims || v.dims : '', ctx: P.ctx || '', maxOut: P.maxOut || '', params: P, limit: v.limit,
    tpm: (v.tpm || '').trim(), conc: (v.conc || '').trim(), reserve: (v.reserve || '').trim(), all: v.all, ten: v.all ? [] : v.ten,
  };
  const affected = v.editConn ? R.deps.filter((d) => d.conn === cid && d.id !== id) : [];
  const next = clone(R);
  if (isNew) {
    cid = `c${now}`;
    next.conns.push({ id: cid, n: `${CONN_TYPES[ctype]?.s ?? ctype} — ${host}`, type: ctype, ...cfields, status: 'Enabled', health: 'Not checked', lastOk: '—', errors: '—', req: '—', lat: '—', util: '—', by: `${actor} · just now` });
  } else if (v.editConn) {
    Object.assign(next.conns.find((c) => c.id === cid)!, cfields, { by: `${actor} · just now` });
    next.deps.filter((d) => d.conn === cid && d.id !== id).forEach((d) => Object.assign(d, { health: d.status === 'Active' ? 'Not checked' : d.health, lastOk: '—', verified: [] }));
  }
  if (isEdit) Object.assign(next.deps.find((d) => d.id === id)!, dep, hv, { conn: cid });
  else next.deps.push({ ...(dep as Dep), conn: cid, status: 'Active', health: 'Not checked', lastOk: '—', errors: '—', req: '—', lat: '—', util: '—', serving: ctype === 'vLLM (self-hosted)' ? 'Assigned by cluster scheduler' : '', ...hv });
  const msg = `Model "${id}" ${isEdit ? 'saved' : 'added'}${affected.length ? `. Connection updated for ${affected.length}${affected.length === 1 ? ' other model' : ' other models'}: ${affected.map((d) => d.id).join(', ')} (not checked).` : '.'}`;
  const evs: Ev[] = [{ action: isEdit ? 'Updated model' : 'Added model', res: `${id} · ${v.type}`, tenants: v.all ? TKEYS : v.ten }];
  if (v.editConn && ec) evs.push({ action: 'Updated connection', res: `${ec.n} · ${affected.length + 1} models`, tenants: [...new Set(R.deps.filter((d) => d.conn === ec.id).flatMap(tenOf))] });
  return { next, msg, evs, id };
}

// ====================================================================== tenant model defaults

export interface TenantModelRow { id: string; m: string; caps: string; used: string; status: [DsStatus, string] }
export function tenantModels(R: Registry, T: TKey, draft?: Record<Role, string>) {
  const mine = R.deps.filter((d) => availTo(d, T));
  const rows: TenantModelRow[] = mine.map((d) => {
    const ok = usable(R, d);
    const used = depsOf(R, d).filter((x) => x.tk === T);
    return { id: d.id, m: d.model, caps: d.caps.join(', '), used: used.length ? used.map((x) => x.n).join(', ') : '—', status: ok ? ['approved', 'Available'] : ['rejected', 'Disabled'] };
  });
  const DR = draft || R.tDef[T];
  const dirty = ROLES.some((r) => DR[r] !== R.tDef[T][r]);
  const defaults = ROLES.map((r) => {
    const cur = DR[r];
    const cd = R.deps.find((d) => d.id === cur);
    const curOk = !!cd && availTo(cd, T) && usable(R, cd) && cd.caps.includes(ROLE[r][1]);
    const opts = mine.filter((d) => usable(R, d) && d.caps.includes(ROLE[r][1])).map((d) => `${d.id} · ${d.model}`);
    const curLabel = cd ? `${cd.id} · ${cd.model}` : cur;
    if (!curOk) opts.unshift(`${curLabel} (unavailable)`);
    const why = cd ? (cd.status !== 'Active' ? 'disabled by platform' : !availTo(cd, T) ? 'withdrawn from this tenant' : !cd.caps.includes(ROLE[r][1]) ? `lacks ${ROLE[r][1]}` : 'provider connection disabled') : '';
    return { r, k: ROLE[r][0], cap: ROLE[r][1], opts, cur: curOk ? curLabel : `${curLabel} (unavailable)`, warn: !curOk, warnMsg: cd ? `${cd.id} is unavailable (${why}). Select another model.` : `${cur} no longer exists. Select another model.` };
  });
  return { rows, defaults, dirty, warn: defaults.some((x) => x.warn) };
}

export function saveDefaults(R: Registry, T: TKey, DR: Record<Role, string>): { err: string } | Applied<Registry> {
  const errs = ROLES.map((r) => {
    const id = DR[r];
    const d = R.deps.find((x) => x.id === id);
    if (!d) return `${ROLE[r][0]}: ${id} no longer exists.`;
    if (!availTo(d, T)) return `${ROLE[r][0]}: ${id} is not available to ${TN[T]}.`;
    if (!usable(R, d)) return `${ROLE[r][0]}: ${id} is currently unavailable.`;
    if (!d.caps.includes(ROLE[r][1])) return `${ROLE[r][0]}: ${id} does not support ${ROLE[r][1]}.`;
    return '';
  }).filter(Boolean);
  if (errs.length) return { err: `Not saved. ${errs.join(' ')}` };
  const changed = ROLES.filter((r) => DR[r] !== R.tDef[T][r]);
  const next = clone(R);
  next.tDef[T] = { ...DR };
  return { next, msg: 'Model defaults saved.', evs: changed.map((r) => ({ action: `Changed ${ROLE[r][0].toLowerCase()}`, res: `${R.tDef[T][r]} → ${DR[r]}`, tenants: [T], lvl: 'tenant' as const })) };
}

// ====================================================================== MCP registry

export const isExternal = (u: string) => {
  const h = (u || '').replace(/^https?:\/\//, '').split(/[/:]/)[0];
  return !!h && !/\.(svc|internal|local)$/.test(h);
};
export const hostOf = (u: string) => (u || '').replace(/^https?:\/\//, '').split('/')[0];
export const toolOn = (M: McpRegistry, s: McpServer, t: TKey, tool: string) => ((M.tenTools[t] || {})[s.n] || []).includes(tool);
export const optedOut = (M: McpRegistry, t: TKey, n: string) => !!(M.optOut[t] || {})[n];
/** Agents in tenant `t` granted server `n` (or one of its tools). */
export const mcpUsersOf = (M: McpRegistry, t: TKey, n: string, tool?: string) =>
  Object.entries(M.grants[t] || {}).filter(([, gs]) => gs.some((g) => (tool ? g === `${n}:${tool}` : g.startsWith(`${n}:`)))).map(([a]) => a);
export const mcpUsersAll = (M: McpRegistry, n: string) => TKEYS.flatMap((t) => mcpUsersOf(M, t, n).map((a) => ({ t: TN[t], a, tk: t })));

export function mcpAdv(s: McpServer): [string, string, boolean?][] {
  return [['Route via MCP Proxy', `mcp-hub.kap.internal/${s.n}`, true], ['Transport', 'Streamable HTTP'], ['Egress allowlist', s.dest, true], ['Timeout', `${s.timeout} s`], ['Retries', s.retries], ['Rate limit', s.rate], ['Tool discovery', s.disc], ['Last change', s.by]];
}

export function sharedRow(M: McpRegistry, s: McpServer) {
  const on = s.status === 'Enabled';
  return {
    s, on,
    k: s.vendor || 'MCP server',
    tc: String(s.tools.length),
    tenL: s.ten.length ? s.ten.map((t) => TN[t] + (optedOut(M, t, s.n) ? ' (opted out)' : '')).join(', ') : 'None',
    status: (on ? ['approved', 'Enabled'] : ['draft', 'Disabled']) as [DsStatus, string],
    health: (on ? [HP[s.health], s.health] : ['draft', '—']) as [DsStatus, string],
    cfg: [['MCP Server URL', s.up, true], ['Authentication', s.auth + (s.secret ? ` · ${s.secret.split('/').pop()}` : '')], ['Classification ceiling', s.cls], ['Personal data', s.pii], ['Side effects', s.fx], ['Health', on ? `${s.health} · ${s.lastOk}` : 'Disabled']] as [string, string, boolean?][],
    tenChips: s.ten.map((x) => TN[x] + (optedOut(M, x, s.n) ? ' · opted out' : '')),
    toolRows: s.tools.map((t) => {
      const ts = s.ten.filter((x) => toolOn(M, s, x, t.n) && !optedOut(M, x, s.n));
      return { tn: t.n, td: t.d, tt: ts.length ? ts.map((x) => TN[x]).join(', ') : '—' };
    }),
  };
}

export function tenantRow(M: McpRegistry, s: McpServer) {
  const own = s.own as TKey;
  const users = mcpUsersOf(M, own, s.n);
  const l = s.susp ? 'Suspended' : s.status === 'Disabled' ? 'Disabled by tenant' : 'Enabled';
  return {
    s, users,
    o: TN[own],
    k: isExternal(s.up) ? 'External' : 'Inside perimeter',
    status: [s.susp ? 'rejected' : s.status === 'Disabled' ? 'draft' : 'approved', l] as [DsStatus, string],
    health: [HP[s.health] || 'draft', s.health] as [DsStatus, string],
    cfg: [['Owner tenant', TN[own]], ['MCP Server URL', s.up, true], ['Authentication', s.auth], ['Classification ceiling', s.cls], ['Personal data', s.pii], ['Side effects', s.fx], ['Tools', s.tools.map((t) => t.n).join(', '), true], ['Used by', users.length ? users.join(', ') : 'Not granted']] as [string, string, boolean?][],
  };
}

/** Connection check from the details panel (prototype `check`). */
export function checkServer(M: McpRegistry, n: string): { ok: boolean; msg: string; next: McpRegistry } {
  const s = M.servers.find((x) => x.n === n)!;
  if (s.status !== 'Enabled' || s.susp) return { ok: false, msg: `Not checked · the server is ${s.susp ? 'suspended by the platform.' : 'disabled.'}`, next: M };
  let r: { ok: boolean; h?: McpServer['health']; m: string };
  if (/\.example/.test(s.up)) r = { ok: false, m: `could not reach ${hostOf(s.up)} through the egress gateway.` };
  else if (s.n === 'oxford_economics') r = { ok: true, h: 'Degraded', m: `connected via MCP Proxy · handshake 640 ms · ${s.tools.length} tools listed · 1 of 10 probe calls returned 502` };
  else r = { ok: true, h: 'Healthy', m: `connected via MCP Proxy · handshake 210 ms · ${s.tools.length} tools listed` };
  const next = clone(M);
  const x = next.servers.find((y) => y.n === n)!;
  x.health = r.ok ? r.h! : 'Failing';
  if (r.ok) x.lastOk = 'just now';
  return { ok: r.ok, msg: r.m, next };
}

export function setSharedStatus(M: McpRegistry, n: string, on: boolean): Applied<McpRegistry> {
  const next = clone(M);
  const x = next.servers.find((y) => y.n === n)!;
  x.status = on ? 'Enabled' : 'Disabled';
  if (on) {
    x.health = 'Not checked';
    x.lastOk = '—';
  }
  return { next, msg: `${n} ${on ? 'enabled' : 'disabled'}.`, evs: [{ action: on ? 'Enabled shared MCP server' : 'Disabled shared MCP server', res: n, tenants: x.ten }] };
}

export function deleteShared(M: McpRegistry, n: string): Applied<McpRegistry> {
  const next = clone(M);
  const s = next.servers.find((x) => x.n === n)!;
  next.servers = next.servers.filter((x) => x.n !== n);
  Object.values(next.tenTools).forEach((m) => m && delete m[n]);
  return { next, msg: `${n} deleted.`, evs: [{ action: 'Deleted shared MCP server', res: n, tenants: s.ten }] };
}

/** Change which tenants a shared server is available to; `hit` lists agents that lose its tools. */
export function availChange(M: McpRegistry, n: string, ten: TKey[]) {
  const s = M.servers.find((x) => x.n === n)!;
  const lost = s.ten.filter((t) => !ten.includes(t));
  const added = ten.filter((t) => !s.ten.includes(t));
  const hit = lost.flatMap((t) => mcpUsersOf(M, t, n).map((a) => ({ t: TN[t], k: 'Agent', n: a })));
  const next = clone(M);
  next.servers.find((x) => x.n === n)!.ten = ten.slice();
  added.forEach((t) => {
    next.tenTools[t] = next.tenTools[t] || {};
    if (!next.tenTools[t]![n]) next.tenTools[t]![n] = [];
  });
  const res = n + (added.length ? ` · +${added.map((t) => TN[t]).join(', ')}` : '') + (lost.length ? ` · −${lost.map((t) => TN[t]).join(', ')}` : '');
  return { lost, added, hit, changed: !!(lost.length || added.length), next, msg: `Tenant availability of ${n} updated.`, evs: [{ action: 'Changed tenant availability', res, tenants: [...added, ...lost] }] as Ev[] };
}

export function setSuspended(M: McpRegistry, n: string, susp: boolean): Applied<McpRegistry> {
  const next = clone(M);
  const x = next.servers.find((y) => y.n === n)!;
  x.susp = susp;
  if (!susp) x.health = 'Not checked';
  const own = x.own as TKey;
  return { next, msg: `${n} ${susp ? 'suspended' : 'resumed'}.`, evs: [{ action: susp ? 'Suspended tenant MCP server' : 'Resumed tenant MCP server', res: `${n} · ${TN[own]}`, tenants: [own] }] };
}

// ---- shared server form (platform scope)

export interface McpValues { n: string; vendor: string; up: string; dest: string; auth: string; secret: string; cls: string; pii: string; fx: string; timeout: string; rate: string; retries: string; disc: string; ten: TKey[]; tools: McpTool[] }
export interface McpForm { mode: 'add' | 'edit'; id?: string; v: McpValues; adv: boolean; tested: McpTool[] | null }

export const blankMcp = (): McpValues => ({ n: '', vendor: '', up: '', dest: '', auth: 'mTLS', secret: '', cls: 'L1 · Internal', pii: 'Not allowed', fx: 'Read-only', timeout: '30', rate: '60 / min', retries: '1', disc: 'Automatic', ten: [], tools: [] });
export const mcpValuesOf = (s: McpServer): McpValues => ({ n: s.n, vendor: s.vendor, up: s.up, dest: s.dest, auth: s.auth, secret: s.secret, cls: s.cls, pii: s.pii, fx: s.fx, timeout: s.timeout, rate: s.rate, retries: s.retries, disc: s.disc, ten: s.ten.slice(), tools: clone(s.tools) });

export function validateMcp(M: McpRegistry, F: McpForm): string {
  const v = F.v;
  if (!/^[a-z][a-z0-9_]{2,}$/.test(v.n)) return 'Name: lower-case letters, digits and underscores.';
  if (F.mode === 'add' && M.servers.some((s) => s.n === v.n)) return 'A server with this name already exists.';
  if (!/^https?:\/\/[^/]+/.test(v.up)) return 'Enter the MCP server URL.';
  if (isExternal(v.up)) {
    if (!/^https:/.test(v.up)) return 'External servers must use HTTPS.';
    if (v.cls !== 'L0 · Public') return 'External servers can receive L0 · Public data only.';
    if (v.pii !== 'Not allowed') return 'External servers can’t receive personal data.';
    const h = hostOf(v.up).split(':')[0];
    if (!(v.dest || '').includes(h)) return `Add ${h} to the egress allowlist (Advanced settings).`;
  }
  if (v.auth !== 'None' && !v.secret) return 'Select a credential.';
  if (!(+v.timeout > 0)) return 'Enter a timeout in seconds (Advanced settings).';
  return '';
}

/** Test Connection & Discover Tools (prototype `mf.test`). */
export function discoverMcp(M: McpRegistry, F: McpForm): { err: string } | { ok: boolean; msg: string; tools: McpTool[] | null } {
  const e = validateMcp(M, F);
  if (e) return { err: e };
  const v = F.v;
  const prev = F.mode === 'edit' ? M.servers.find((s) => s.n === F.id) : undefined;
  const epChanged = !prev || prev.up !== v.up;
  const notMcp = !/\/(mcp|sse)\/?$/.test(v.up.trim());
  const fail = /\.example/.test(v.up) || notMcp;
  const tools = epChanged ? (MCP_DISCOVERY[v.up] || [['search', 'Search records'], ['get_record', 'Read one record by ID']]).map(([n, d]) => ({ n, d, fx: v.fx === 'Read-only' ? 'Read-only' : 'Changes state' })) : prev!.tools;
  const msg = notMcp
    ? `${hostOf(v.up)} did not answer the MCP initialize handshake. Register the endpoint of an MCP-compatible server (…/mcp or …/sse).`
    : fail
      ? `could not reach ${hostOf(v.up)}.`
      : `connected via MCP Proxy · ${epChanged ? 'discovered ' : 'listed '}${tools.length} tools: ${tools.map((t) => t.n).join(', ')}`;
  return { ok: !fail, msg, tools: fail ? null : tools };
}

const MCP_CONN: (keyof McpValues)[] = ['up', 'auth', 'secret', 'dest'];
const MCP_SEC: (keyof McpValues)[] = ['up', 'auth', 'secret', 'dest', 'cls', 'pii', 'fx'];
const MCP_IMM: (keyof McpValues)[] = ['vendor', 'timeout', 'rate', 'retries', 'disc'];

/** Save a shared server (prototype `mf.save`, platform scope). */
export function applyMcp(M: McpRegistry, F: McpForm, actor: string): { err: string } | Applied<McpRegistry> {
  const e = validateMcp(M, F);
  if (e) return { err: e };
  const v = F.v;
  const isEdit = F.mode === 'edit';
  const prev = isEdit ? M.servers.find((s) => s.n === F.id) : undefined;
  const connChanged = !!prev && MCP_CONN.some((k) => JSON.stringify(prev[k as keyof McpServer]) !== JSON.stringify(v[k]));
  if ((!isEdit || connChanged) && !F.tested) return { err: 'Run Test Connection & Discover Tools before saving.' };
  const tested = F.tested ? { health: 'Healthy' as const, lastOk: 'just now' } : {};
  const epChanged = !prev || prev.up !== v.up;
  const newTools = F.tested && epChanged ? F.tested : null;
  const next = clone(M);
  if (isEdit) {
    const x = next.servers.find((y) => y.n === F.id)! as unknown as Record<string, unknown>;
    [...MCP_IMM, ...MCP_SEC, 'ten' as const].forEach((k) => {
      x[k] = clone(v[k]);
    });
    const xs = x as unknown as McpServer;
    if (newTools) {
      xs.tools = newTools;
      Object.values(next.tenTools).forEach((m) => {
        if (m && m[xs.n]) m[xs.n] = m[xs.n].filter((n) => newTools.some((y) => y.n === n));
      });
    }
    Object.assign(xs, tested, { by: `${actor} · just now` });
    return { next, msg: `${v.n} saved.`, evs: [{ action: 'Updated shared MCP server', res: v.n + (connChanged ? ' · connection changed' : ''), tenants: v.ten }] };
  }
  next.servers.push({ ...clone(v), own: 'platform', status: 'Enabled', health: 'Not checked', lastOk: '—', ...tested, p95: '—', by: `${actor} · just now`, tools: F.tested! });
  v.ten.forEach((t) => {
    next.tenTools[t] = next.tenTools[t] || {};
    next.tenTools[t]![v.n] = [];
  });
  return { next, msg: `${v.n} registered.`, evs: [{ action: 'Registered shared MCP server', res: v.n, tenants: v.ten }] };
}

// ====================================================================== telemetry and platform overview

const ageMin = (s: string | null | undefined): number | null => {
  let m: RegExpExecArray | null;
  if (!s || s === '—') return null;
  if (s === 'just now') return 0;
  if ((m = /^(\d+) s ago$/.exec(s))) return +m[1] / 60;
  if ((m = /^(\d+) min ago$/.exec(s))) return +m[1];
  if ((m = /^(\d+) h ago$/.exec(s))) return +m[1] * 60;
  if ((m = /^(\d+) d ago$/.exec(s))) return +m[1] * 1440;
  return null;
};

export const PST: Record<string, DsStatus> = { Healthy: 'approved', 'At limit': 'hold', Degraded: 'hold', Internal: 'draft', Busy: 'hold', Unavailable: 'rejected', Stale: 'hold', Unknown: 'draft', Failing: 'rejected', Provisioning: 'submitted' };

export interface Service { n: string; status: string; pill: DsStatus; shown: string; last: string; go: string }
/** Platform service health; stale or missing telemetry is never shown as healthy (prototype `telemetry`). */
export function telemetry(R: Registry, M: McpRegistry): Service[] {
  const judge = (rep: string, last: string | null): [string, DsStatus, string] => {
    const a = ageMin(last);
    if (a == null) return ['Unknown', 'draft', 'No telemetry received'];
    if (a > 30) return ['Unknown', 'draft', `No telemetry for ${Math.round(a)} min`];
    if (a > 5) return ['Stale', 'hold', `Last report ${Math.round(a)} min ago`];
    return [rep, ({ Healthy: 'approved', Busy: 'hold', Degraded: 'hold', Failing: 'rejected' } as Record<string, DsStatus>)[rep] || 'draft', ''];
  };
  const dOn = R.deps.filter((d) => d.status === 'Active');
  const dOk = dOn.filter((d) => d.health === 'Healthy' && ageMin(d.lastOk) != null && ageMin(d.lastOk)! <= 5);
  const dFail = dOn.filter((d) => d.health === 'Failing');
  const dUnv = dOn.filter((d) => !dOk.includes(d) && !dFail.includes(d));
  const mOn = M.servers.filter((s) => s.status === 'Enabled' && !s.susp);
  const mOk = mOn.filter((s) => s.health === 'Healthy');
  const mBad = mOn.filter((s) => s.health !== 'Healthy');
  const newest = dOn.map((x) => x.lastOk).filter((x) => ageMin(x) != null).sort((x, y) => ageMin(x)! - ageMin(y)!)[0] || null;
  const raw: [string, string, string, string | null, string?][] = [
    ['KAP API and console', 'Healthy', '3 of 3 replicas ready', '20 s ago'],
    ['Data Bus', 'Busy', '1 task waiting · 7 active', '15 s ago'],
    ['Model endpoints', dFail.length || dUnv.length ? 'Degraded' : 'Healthy', `${dOk.length} of ${dOn.length} enabled verified healthy${dFail.length ? ` · failing: ${dFail.map((d) => d.id).join(', ')}` : ''}${dUnv.length ? ` · not verified: ${dUnv.map((d) => d.id).join(', ')}` : ''}`, newest, 'pModels'],
    ['MCP proxy and servers', mBad.length ? 'Degraded' : 'Healthy', `${mOk.length} of ${mOn.length} healthy${mBad.length ? ` · ${mBad.map((s) => `${s.n} ${s.health.toLowerCase()}`).join(', ')}` : ''}`, '1 min ago', 'pMcp'],
    ['Ingestion and processing', 'Degraded', '1 run above expected duration (sandbox re-index, 41 min)', '1 min ago'],
    ['Identity providers', 'Healthy', 'Microsoft Entra ID and Keycloak OIDC discovery reachable', '2 min ago'],
    ['Secret store', 'Healthy', '2 of 2 vault backends reachable', '1 min ago'],
    ['Unified Audit Log', 'Healthy', 'Records written and signed', '40 s ago'],
    ['SIEM forwarding', 'Healthy', 'Forwarding to SIEM', '47 min ago'],
    ['License service', 'Healthy', `Valid until ${INSTALL.licenseUntil}`, '12 min ago'],
  ];
  return raw.map(([n, rep, detail, last, link]) => {
    const [s, pill, why] = judge(rep, last);
    return { n, status: s, pill, shown: why ? `${why} · last reported: ${detail}` : detail, last: last || 'Never', go: link || 'pMon' };
  });
}

export const openAlerts = () => OPS_ALERTS.filter((x) => x.st === 'Open' || x.st === 'Acknowledged');

export function platformSummary(TEN: TenantRec[], P: Period, services: Service[]) {
  const ACTIVE = TEN.filter((t) => t.st !== 'Internal');
  const reqTot = ACTIVE.reduce((s, t) => s + t.r[P], 0);
  const failTot = ACTIVE.reduce((s, t) => s + t.f[P], 0);
  const { pfail } = PERIOD_JOBS[P];
  const running = TEN.reduce((s, t) => s + t.inf, 0) + 1;
  const AL = openAlerts();
  const healthy = services.filter((s) => s.status === 'Healthy').length;
  return ([
    ['Active tenants', String(ACTIVE.length), `${ACTIVE.filter((t) => t.st !== 'Healthy').length} need attention`, 'tenants'],
    ['Service health', `${healthy} / ${services.length}`, `${AL.length} open alerts`, 'pMon'],
    ['Running jobs', String(running), `kap.agent ${running - 1} · kap.pipeline 1`, 'pQueues'],
    ['Failed jobs', String(failTot + pfail), `in ${PERIOD_LABEL[P]}`, 'pMon'],
    ['Agent requests', reqTot.toLocaleString('en-US'), `in ${PERIOD_LABEL[P]}`, 'pMon'],
  ] as [string, string, string, string][]).map(([k, v, d, g]) => ({ k, v, d, g }));
}

/** "Processing and agent activity" card: chart, metrics and per-tenant table. */
export function activity(TEN: TenantRec[], P: Period, tf: string) {
  const ACTIVE = TEN.filter((t) => t.st !== 'Internal');
  const reqTot = ACTIVE.reduce((s, t) => s + t.r[P], 0);
  const failTot = ACTIVE.reduce((s, t) => s + t.f[P], 0);
  const { jobs, pjobs, pfail } = PERIOD_JOBS[P];
  const S = ACTIVITY_SERIES[P];
  const share = tf === 'all' ? 1 : (ACTIVE.find((t) => t.k === tf)?.r[P] ?? 0) / Math.max(1, reqTot);
  const sumS = S.v.reduce((x, y) => x + y, 0);
  const vals = S.v.map((v) => Math.round((v * reqTot * share) / sumS));
  const mx = Math.max(...vals, 1);
  const W = 700;
  const H = 150;
  const n = vals.length;
  const X = (i: number) => 20 + (i * (W - 40)) / (n - 1);
  const Y = (v: number) => H - 10 - (v / mx) * (H - 30);
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  return {
    line: pts.join(' '),
    area: `M${X(0).toFixed(1)},${H - 10} L${pts.join(' L')} L${X(n - 1).toFixed(1)},${H - 10} Z`,
    labels: S.l.map((l, i) => ({ l, x: `${((X(i) / W) * 100).toFixed(2)}%` })).filter((x) => x.l),
    grid: [0.25, 0.5, 0.75, 1].map((f) => ({ y: Y(mx * f).toFixed(1), t: `${((Y(mx * f) / H) * 100).toFixed(2)}%`, l: String(Math.round(mx * f)) })),
    metrics: [
      ['Agent requests', Math.round(reqTot * share).toLocaleString('en-US')],
      ['Agent jobs', Math.round(jobs * share).toLocaleString('en-US')],
      ['Processing jobs', Math.round(pjobs * share).toLocaleString('en-US')],
      ['Job failure rate', `${(((failTot + pfail) / (jobs + pjobs)) * 100).toFixed(1)}%`],
      ['Queued now', '1'],
      ['Avg queue wait', '0.8 s'],
    ] as [string, string][],
    tenants: ACTIVE.slice()
      .sort((x, y) => y.r[P] - x.r[P])
      .map((t) => ({ k: t.k, n: t.n, r: t.r[P].toLocaleString('en-US'), w: `${((t.r[P] / Math.max(1, reqTot)) * 100).toFixed(1)}%`, f: t.f[P] })),
    tenOpts: ['All tenants', ...ACTIVE.map((t) => t.n)],
    vals,
  };
}

export function tenantOverview(TEN: TenantRec[]) {
  const ACTIVE = TEN.filter((t) => t.st !== 'Internal');
  return {
    sum: [['Active', ACTIVE.length], ['Healthy', ACTIVE.filter((t) => t.st === 'Healthy').length], ['Need attention', ACTIVE.filter((t) => t.st !== 'Healthy').length], ['Internal', TEN.length - ACTIVE.length]].map(([k, v]) => ({ k: String(k), v: String(v) })),
    attn: ACTIVE.filter((t) => t.issue).map((t) => ({ k: t.k, n: t.n, st: t.st, p: PST[t.st], issue: t.issue, go: t.go })),
  };
}

export interface InvQuery { q: string; fs: string; sk: keyof TenantRec; sd: 1 | -1; ps: number; pg: number }
export const INV_DEFAULT: InvQuery = { q: '', fs: 'All statuses', sk: 'n', sd: 1, ps: 10, pg: 1 };
export const INV_COLS: [keyof TenantRec, string, boolean][] = [['n', 'Tenant', false], ['st', 'Status', false], ['u', 'Users', true], ['a', 'Agents', true], ['c', 'Collections', true], ['j', 'Jobs today', true], ['inf', 'kap.agent in flight', true], ['created', 'Created', false]];

/** Tenant inventory: search, status filter, sort, paginate (prototype `tInv`). */
export function tenantInventory(TEN: TenantRec[], Q: InvQuery) {
  const q = Q.q.toLowerCase();
  const rows = TEN.filter((t) => (!q || `${t.n} ${t.d}`.toLowerCase().includes(q)) && (Q.fs === 'All statuses' || t.st === Q.fs));
  rows.sort((x, y) => {
    const a = Q.sk === 'n' ? x.n.toLowerCase() : (x[Q.sk] as string | number);
    const b = Q.sk === 'n' ? y.n.toLowerCase() : (y[Q.sk] as string | number);
    return (a > b ? 1 : a < b ? -1 : 0) * Q.sd;
  });
  const pages = Math.max(1, Math.ceil(rows.length / Q.ps));
  const cur = Math.min(Q.pg, pages);
  const view = rows.slice((cur - 1) * Q.ps, cur * Q.ps);
  return {
    rows: view.map((t) => ({ t, u: t.k === 'default' ? '3 service' : String(t.u), q: t.max ? `${t.inf} / ${t.max}` : '—', p: PST[t.st] })),
    info: rows.length ? `${(cur - 1) * Q.ps + 1}–${Math.min(cur * Q.ps, rows.length)} of ${rows.length}` : '0 results',
    page: `Page ${cur} of ${pages}`,
    cur,
    pages,
    empty: !rows.length,
  };
}

// ---- create tenant

export interface TenantDraft { k: string; n: string; d: string; agent: string; pipe: string; models: string; admin: string; email: string; idp: string }
export const TENANT_IDPS = ['Microsoft Entra ID · OIDC', 'Keycloak · kap-admin realm'];

export function validateTenant(TEN: TenantRec[], step: number, v: Partial<TenantDraft>): string {
  if (step === 0) {
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(v.k || '')) return 'Tenant key: 3–20 lower-case letters, digits and underscores, starting with a letter.';
    if (TEN.some((t) => t.k === v.k)) return 'A tenant with this key already exists.';
    if (!(v.n || '').trim()) return 'Enter the display name.';
    if (TEN.some((t) => t.n.toLowerCase() === (v.n || '').trim().toLowerCase())) return 'A tenant with this name already exists.';
  }
  if (step === 1) {
    if (!(+(v.agent || '') >= 1 && +(v.agent || '') <= 8)) return 'kap.agent max in-flight must be between 1 and 8.';
    if (!(+(v.pipe || '') >= 1 && +(v.pipe || '') <= 2)) return 'kap.pipeline max in-flight must be between 1 and 2.';
  }
  if (step === 2) {
    if (!/^[a-z][a-z0-9_.]{2,}$/.test(v.admin || '')) return 'Administrator user name: lower-case letters, digits, dots and underscores.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || '')) return 'Enter the administrator e-mail address.';
  }
  return '';
}

/** Provisioning checklist (prototype `provision`). */
export const provisionSteps = (v: TenantDraft) => [
  `Tenant record ${v.k} created`,
  `Queue policy kap.agent · max in-flight ${v.agent}`,
  `Queue policy kap.pipeline · max in-flight ${v.pipe}`,
  v.models === 'None' ? 'No default model providers linked' : 'Default model providers linked',
  'Groups tenant_admins and catalog_readers created',
  `Admin user ${v.admin} created`,
];

export function tenantRecord(v: TenantDraft): TenantRec {
  return { k: v.k, n: v.n.trim(), d: (v.d || '').trim() || 'New tenant', st: 'Provisioning' as TenantStatus, u: 1, a: 0, c: 0, j: 0, inf: 0, max: +v.agent, r: { '24h': 0, '7d': 0, '30d': 0 }, f: { '24h': 0, '7d': 0, '30d': 0 }, created: 'just now', issue: '', go: '', prov: provisionSteps(v) };
}

// ====================================================================== dashboard charts

/** "Questions per day" chart (prototype `ovQ`). */
export function questionsChart(cur: number[], prev: number[], days: string[]) {
  const X = (i: number) => 24 + (i * 512) / (cur.length - 1);
  const Y = (v: number) => 128 - (v / 100) * 110;
  const pl = (a: number[]) => a.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return {
    cur: pl(cur),
    prev: pl(prev),
    area: `M24,140 L${cur.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')} L536,140 Z`,
    grid: [25, 50, 75].map((v) => Y(v).toFixed(1)),
    pts: cur.map((v, i) => ({ v, l: days[i], last: i === cur.length - 1, x: ((X(i) / 560) * 100).toFixed(2), y: (Y(v) - 6).toFixed(1) })),
  };
}

/** "Answer time" band chart (prototype `ovTime`). */
export function timeChart(p50: number[], p95: number[]) {
  const X = (i: number) => ((i * 200) / (p50.length - 1)).toFixed(1);
  const Y = (v: number) => (64 - (v / 6.6) * 58).toFixed(1);
  return {
    p50: p50.map((v, i) => `${X(i)},${Y(v)}`).join(' '),
    p95: p95.map((v, i) => `${X(i)},${Y(v)}`).join(' '),
    band: `M${p95.map((v, i) => `${X(i)},${Y(v)}`).join(' L')} L${p50.map((v, i) => [X(i), Y(v)]).reverse().map((p) => p.join(',')).join(' L')} Z`,
  };
}

/** Sparkline points in a 100×24 box. */
export function spark(arr: number[]) {
  const mx = Math.max(...arr);
  const mn = Math.min(...arr);
  return arr.map((v, i) => `${((i * 100) / (arr.length - 1)).toFixed(1)},${(22 - ((v - mn) / (mx - mn || 1)) * 20).toFixed(1)}`).join(' ');
}

/** Platform screen key → route (prototype `go` + REMAP). */
export const PLATFORM_ROUTE: Record<string, string> = {
  pHome: '/platform', tenants: '/platform/tenants', pModels: '/platform/models', pMcp: '/platform/mcp', pUsers: '/platform/admins', pIdp: '/platform/identity',
  pConfig: '/platform/configuration', pSched: '/platform/configuration/work', pMon: '/platform/monitoring', pQueues: '/platform/monitoring', pAudit: '/platform/audit', pKeys: '/platform/secrets', pLic: '/platform/licenses',
};

/** Tenant screen key → path below /p/:tenant (prototype `go` + REMAP). */
export const TENANT_ROUTE: Record<string, string> = {
  home: '', convs: 'conversations', conv: 'conversations', map: 'workflows/map', feedback: 'feedback', agents: 'agents', wizard: 'agents', sData: 'structured', uData: 'unstructured',
  collections: 'collections', pipelines: 'pipelines', iPipes: 'pipelines', mcp: 'tools/mcp', users: 'users', reports: 'schedules/reports', trace: 'monitoring/traces', entities: 'entities', jobs: 'monitoring',
};
