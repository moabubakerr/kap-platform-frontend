/**
 * AI Agent Tools (Tools · MCP Connections) and Schedules & Events (Triggers ·
 * Scheduled Reports) as ScreenModels. Port of the prototype's `agentHub`
 * screens `tools`, `mcpconn`, `schedules` (design-ref-v35/app.js ~2650–3017),
 * the tenant part of `mcpScreen` (~4430–4500, incl. agent tool assignments
 * `tlt.assign`) and `reports()` (~135–179). Pure: data, filters, permissions
 * and callbacks in; model out.
 */
import { act, cell, kv } from '@/engine/build';
import type { Action, DsStatus, Filters, PageHead, Row, ScreenModel, Section } from '@/engine/types';
import type { FormField, FormValues } from '@/engine/dialogs';
import type { ResType } from '@/v35/iam';
import {
  NATIVE_TOOLS, draftOf, pubOf, wfUsing,
  type AfTenant, type AfTenantKey, type Agent, type AgentFactoryData, type Disablement, type McpServer, type ModelRegistry, type Schedule, type Workflow,
} from '@/v35/data/agentFactory';
import { REPORT_SECTIONS, type DeliveryRow, type Report } from '@/v35/data/toolsConfidence';

// ============================================================ context

export interface AfBase {
  t: AfTenantKey;
  /** tenant display name */
  tn: string;
  af: AgentFactoryData;
  D: AfTenant;
  actor: string;
  can: (perm: string, type: ResType, id?: string) => boolean;
}

export type ListFilters = Record<string, string>;

/** Module header with its view tabs (prototype `MODV` / `modHead`). */
export const TOOLS_TABS = [
  { value: 'tools', label: 'Tools' },
  { value: 'mcpconn', label: 'MCP Connections' },
];
export const SCHEDULE_TABS = [
  { value: 'schedules', label: 'Triggers' },
  { value: 'reports', label: 'Scheduled Reports' },
];
export const modHead = (title: string, tabs: { value: string; label: string }[], tab: string, setTab: (v: string) => void): PageHead => ({ title, tabs, tab, setTab });

const qOk = (q: string | undefined, hay: string) => !q || hay.toLowerCase().includes(q.toLowerCase());
const uniq = <T,>(a: T[]) => [...new Set(a)];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Filter bar: defs = [key, label, options (first = "any")]. */
export function filterBar(F: ListFilters, setF: (f: ListFilters) => void, defs: [string, string, string[]][], ph: string, count: string): Filters {
  const val = (k: string, opts: string[]) => (F[k] && opts.includes(F[k]) ? F[k] : opts[0]);
  const chips = [
    ...(F.q ? [{ l: `Search: ${F.q}`, x: () => setF({ ...F, q: '' }) }] : []),
    ...defs.filter(([k, , opts]) => val(k, opts) !== opts[0]).map(([k, label, opts]) => ({ l: `${label}: ${val(k, opts)}`, x: () => setF({ ...F, [k]: opts[0] }) })),
  ];
  return {
    q: F.q ?? '',
    qLabel: 'Search',
    qPlaceholder: ph,
    setQ: (q) => setF({ ...F, q }),
    main: defs.map(([k, label, opts]) => ({ label, value: val(k, opts), options: opts, onChange: (v: string) => setF({ ...F, [k]: v }) })),
    chips,
    clear: () => setF({}),
    count,
  };
}
const fv = (F: ListFilters, k: string, any: string) => F[k] || any;

/** Empty state for a tenant without this data (prototype `defEmpty`). */
export function emptyTenant(head: PageHead, label: string, tn: string, isDefault: boolean, act0?: Action): ScreenModel {
  return {
    head,
    sections: [{ empty: `No ${label} in ${tn}. ${isDefault ? 'The system tenant holds no business data or workloads.' : 'Nothing has been added yet.'}`, cols: [], rows: [], sacts: act0 ? [act0] : undefined }],
  };
}

// ============================================================ tool inventory (prototype toolInv)

const NAT_IO: Record<string, [string, string]> = {
  hybrid_search: ['query, collections?, k?', 'passages with citations'],
  document_get: ['document id, chunk?', 'text with citation'],
  knowledge_search: ['query, entity types?', 'entities with evidence'],
  entity_get: ['entity id', 'entity with attributes'],
  numeric_lookup: ['series, period, source?', 'value, unit, period'],
  compare: ['values or series', 'difference, ratio'],
  trend: ['series, from, to', 'trend statistics'],
  translate: ['text, target language', 'translated text'],
};
const CALLS: Record<string, number> = { hybrid_search: 142, numeric_lookup: 96, compare: 33, trend: 14, translate: 508, document_get: 37, knowledge_search: 4, EconomicData: 15, EconomicAnalysis: 4, find_indicator: 41, actual_vs_target: 27, get_status: 9, extract_tables: 6 };

export const toolKey = (t: string) => (t.includes(':') ? t : `kap:${t}`);
/** Is the URL outside the tenant perimeter? */
export const isExternal = (u: string) => {
  const h = (u || '').replace(/^https?:\/\//, '').split(/[/:]/)[0];
  return !!h && !/\.(svc|internal|local)$/.test(h);
};
export const hostOf = (u: string) => (u || '').replace(/^https?:\/\//, '').split('/')[0];

/** No active model for a model task in tenant t (prototype `noModel`). */
export function noModel(R: ModelRegistry, t: string, req?: [string, string]): boolean {
  if (!req) return false;
  return !R.deps.some((d) => d.cat === req[0] && d.status === 'Active' && (!req[1] || d.caps.includes(req[1])) && (d.all || d.ten.includes(t)) && R.conns.find((c) => c.id === d.conn)?.status === 'Enabled');
}

export const pubTools = (c: AfBase, a: string) => ((c.af.mcp.grants[c.t] || {})[a] || []).map(toolKey);
export const draftTools = (c: AfBase, a: string): string[] | null => {
  const o = c.D.agents.find((x) => x.id === a);
  const dv = o && draftOf(o);
  return dv && dv.cfg && dv.cfg.tset ? dv.cfg.tset.map(toolKey) : null;
};
export const workTools = (c: AfBase, a: string) => draftTools(c, a) || pubTools(c, a);

/** Is a platform server available to the tenant, or a tenant server owned by it? */
const srvAvail = (c: AfBase, s: McpServer) => (s.own === 'platform' ? (s.ten || []).includes(c.t) && !(c.af.mcp.optOut[c.t] || {})[s.n] : s.own === c.t);

export interface ToolItem {
  key: string;
  n: string;
  d: string;
  src: 'Native' | 'Shared MCP' | 'Tenant MCP';
  srcL: string;
  mgr: string;
  cap: string;
  fx: string;
  st: string;
  why: string;
  cred: string;
  io: [string, string];
  srv: McpServer | null;
  cls: string;
  pii: string;
  en: boolean;
  off?: Disablement;
  /** agents with the tool in their published version */
  pub: string[];
  /** agents that add it in their draft */
  dIn: string[];
  /** agents that remove it in their draft */
  dOut: string[];
  wfs: Workflow[];
  /** status including emergency disablement */
  stF: string;
  calls: number;
  err: string;
}

export function toolInv(c: AfBase): ToolItem[] {
  const L: Omit<ToolItem, 'off' | 'pub' | 'dIn' | 'dOut' | 'wfs' | 'stF' | 'calls' | 'err'>[] = [];
  const MC = c.af.mcp;
  NATIVE_TOOLS.forEach(([g, svc, rows]) =>
    rows.forEach(([n, d, req]) => {
      const nm = noModel(c.af.models, c.t, req);
      const io = NAT_IO[n] || ['As declared by the tool', 'Structured result'];
      L.push({ key: `kap:${n}`, n, d, src: 'Native', srcL: `Native · ${svc}`, mgr: 'Platform-managed', cap: g === 'Model tasks' ? 'Model task' : g, fx: 'Read-only', st: nm ? 'Unavailable' : 'Available', why: nm ? 'No active model for this task in the Model Registry' : '', cred: 'Platform service identity', io, srv: null, cls: 'Caller permissions apply', pii: 'Caller permissions apply', en: true });
    }),
  );
  MC.servers.filter((s) => srvAvail(c, s)).forEach((s) => {
    const en = (MC.tenTools[c.t] || {})[s.n] || [];
    const plat = s.own === 'platform';
    s.tools.forEach((t) => {
      const st = s.status !== 'Enabled' ? (plat ? 'Server disabled by platform' : 'Server disabled') : s.susp ? 'Server suspended' : !en.includes(t.n) ? 'Not enabled' : s.health === 'Degraded' ? 'Degraded' : s.health === 'Failing' ? 'Failing' : 'Available';
      const fx = t.fx || s.fx;
      L.push({ key: `${s.n}:${t.n}`, n: t.n, d: t.d, src: plat ? 'Shared MCP' : 'Tenant MCP', srcL: `${plat ? 'Shared MCP · ' : 'Tenant MCP · '}${s.n}`, mgr: plat ? 'Platform-managed' : `${c.tn}-managed`, cap: fx === 'Changes state' ? 'Actions' : isExternal(s.up) ? 'External data' : 'Internal data', fx, st, why: '', cred: s.auth + (s.secret ? ` · ${s.secret.split('/').pop()}` : ''), io: ['As declared by the MCP server', 'JSON result'], srv: s, cls: s.cls, pii: s.pii, en: en.includes(t.n) });
    });
  });
  return L.map((t) => {
    const off = c.D.toolDis[t.key];
    const pub = c.D.agents.filter((a) => pubTools(c, a.id).includes(t.key)).map((a) => a.id);
    const dIn = c.D.agents.filter((a) => { const x = draftTools(c, a.id); return !!x && x.includes(t.key) && !pub.includes(a.id); }).map((a) => a.id);
    const dOut = c.D.agents.filter((a) => { const x = draftTools(c, a.id); return !!x && !x.includes(t.key) && pub.includes(a.id); }).map((a) => a.id);
    const wfs = c.D.workflows.filter((w) => pub.concat(dIn).some((a) => wfUsing(c.D, a).some((x) => x.id === w.id)));
    return { ...t, off, pub, dIn, dOut, wfs, stF: off ? 'Disabled (emergency)' : t.st, calls: CALLS[t.n] || 0, err: t.n === 'EconomicData' ? '20%' : '0%' };
  });
}

export const toolStP = (s: string): [DsStatus, string] => (s === 'Available' ? ['approved', s] : /emergency|rejected|Failing/i.test(s) ? ['rejected', s] : /Degraded|pending/i.test(s) ? ['hold', s] : ['draft', s]);

// ============================================================ TOOLS

export interface ToolsActs {
  assign: (t: ToolItem) => void;
  disable: (t: ToolItem) => void;
  reenable: (t: ToolItem) => void;
}
export interface ToolsNav {
  tab: (v: string) => void;
  agent: (id: string, tab?: string) => void;
  workflow: (id: string, tab?: string) => void;
  mcp: (server?: string) => void;
  audit: () => void;
}
export interface ToolsCtx extends AfBase {
  go: ToolsNav;
  a: ToolsActs;
}

export const canUpd = (c: AfBase, a: string) => c.can('agent:update', 'agent', a);
export const canOps = (c: AfBase, a: string) => c.can('agent:oversee', 'agent', a) || c.can('tenant:configure', 'tenant', '*');

export function toolsScreen(c: ToolsCtx, F: ListFilters, setF: (f: ListFilters) => void, openKey?: string): ScreenModel {
  const L = toolInv(c);
  const SRC = ['All sources', 'Native', 'Shared MCP', 'Tenant MCP'];
  const ST = ['Any status', ...uniq(L.map((t) => t.stF))];
  const CAP = ['Any capability', ...uniq(L.map((t) => t.cap))];
  const AV = ['Any assignment', 'Assigned to agents', 'Not assigned', 'Ready to assign'];
  const src = fv(F, 'src', SRC[0]), st = fv(F, 'st', ST[0]), cap = fv(F, 'cap', CAP[0]), av = fv(F, 'av', AV[0]);
  const vis = L.filter((t) => {
    const n = t.pub.length + t.dIn.length;
    return (
      qOk(F.q, `${t.n} ${t.d} ${t.srcL}`) &&
      (src === SRC[0] || t.src === src) &&
      (st === ST[0] || t.stF === st) &&
      (cap === CAP[0] || t.cap === cap) &&
      (av === AV[0] || (av === 'Assigned to agents' ? n > 0 : av === 'Not assigned' ? n === 0 : t.stF === 'Available'))
    );
  });
  const anyUpd = c.D.agents.some((a) => canUpd(c, a.id));
  const ops = canOps(c, '*');
  return {
    head: modHead('AI Agent Tools', TOOLS_TABS, 'tools', c.go.tab),
    filters: filterBar(F, setF, [['src', 'Source', SRC], ['st', 'Status', ST], ['cap', 'Capability', CAP], ['av', 'Availability', AV]], 'Tool name, purpose or server', `${vis.length} of ${L.length} tools`),
    sections: [
      {
        empty: 'No tools match the filters.',
        cols: ['Tool', 'Source', 'Capability', 'Effect', 'Status', 'Used by'],
        openKey,
        rows: vis.map((t): Row => {
          const off = t.off;
          const nU = t.pub.length + t.dIn.length;
          const agentById = (a: string) => c.D.agents.find((x) => x.id === a);
          return {
            key: `tl:${t.key}`,
            keepKv: true,
            cells: [
              cell(t.n, { m: true, sub: t.d }),
              cell(t.src, { sub: t.srv ? t.srv.n : '' }),
              cell(t.cap),
              cell(t.fx),
              cell('', { p: toolStP(t.stF) }),
              cell(nU ? `${plural(nU, 'agent')} · ${plural(t.wfs.length, 'workflow')}` : 'Not assigned', { sub: t.dIn.length ? `${t.dIn.length} in draft` : '' }),
            ],
            kv: kv([
              ['Purpose', t.d], ['Capability', t.cap], ['Source', t.srcL], ['Managed by', t.mgr], ['Authentication', t.cred],
              ['Input contract', t.io[0], true], ['Output contract', t.io[1], true],
              ['Permitted operations', t.fx === 'Read-only' ? 'Read only · no changes in any system' : 'Takes actions · each call is confirmed by the user'],
              ['Status', t.stF + (t.why ? ` · ${t.why}` : '')], ['Classification ceiling', t.cls], ['Personal data', t.pii], ['Usage · 7 days', `${t.calls} calls · ${t.err} errors`],
              off ? ['Emergency disable', `${off.by} · ${off.at} · ${off.reason} · ${off.ref}`] : null,
            ]),
            lists: [
              {
                title: 'Assigned agents',
                items: [
                  ...t.pub.map((a) => ({ a, b: `Published ${pubOf(agentById(a) || { vers: [] })?.v || ''}${t.dOut.includes(a) ? ' · removed in draft' : ''}`, c: agentById(a)?.dis ? 'Disabled' : '', x: () => c.go.agent(a, 'knowledge'), xl: 'Open agent' })),
                  ...t.dIn.map((a) => ({ a, b: `Added in draft ${draftOf(agentById(a) || { vers: [] })?.v || ''}`, c: 'Not published', x: () => c.go.agent(a, 'knowledge'), xl: 'Open agent' })),
                ],
                empty: 'Not assigned to any agent',
              },
              {
                title: 'Dependent workflows',
                items: t.wfs.map((w) => ({ a: w.n, b: `through ${t.pub.concat(t.dIn).filter((a) => wfUsing(c.D, a).some((x) => x.id === w.id)).join(', ')}`, c: '', x: () => c.go.workflow(w.id, 'designer'), xl: 'Open designer' })),
                empty: 'No workflow uses this tool',
              },
            ],
            acts: [
              ...(anyUpd && t.stF !== 'Disabled (emergency)' ? [act('Assign to agent', () => c.a.assign(t))] : []),
              ...(ops ? [off ? act('Re-enable', () => c.a.reenable(t)) : act('Emergency disable', () => c.a.disable(t), 'ghost')] : []),
              ...(t.srv ? [act('Open MCP connection', () => c.go.mcp(t.srv!.n))] : []),
              ...(off ? [act('View audit record', c.go.audit)] : []),
            ],
          };
        }),
      },
    ],
  };
}

/** Everything an emergency tool disable may affect: [kind, name] (prototype killForm `aff`). */
export function toolImpact(c: AfBase, t: ToolItem): [string, string][] {
  return [
    ...t.pub.concat(t.dIn).map((a): [string, string] => ['Agent', a + (t.dIn.includes(a) ? ' · draft' : '')]),
    ...t.wfs.map((w): [string, string] => ['Workflow', w.n]),
    ...c.D.scheds.filter((x) => x.on && (t.pub.includes(x.target.split(':')[1]) || t.wfs.some((w) => `workflow:${w.id}` === x.target))).map((x): [string, string] => ['Trigger', x.n]),
    ...(t.pub.length + t.dIn.length ? [] : [['Agents', 'None assigned'] as [string, string]]),
  ];
}

/** Next version label (prototype nextV). */
export const nextV = (o: { vers: { v: string }[] }) => `v${Math.max(...o.vers.map((v) => +v.v.slice(1) || 0)) + 1}`;

/** Add or remove a tool in the agent's draft; creates the draft from the published version if needed (prototype assignTool). */
export function assignInDraft(D: AfTenant, published: string[], aId: string, tkey: string, add: boolean, actor: string): { v: string; created: boolean } | null {
  const o = D.agents.find((a) => a.id === aId);
  if (!o) return null;
  let dv = draftOf(o);
  const created = !dv;
  if (!dv) {
    const base = pubOf(o) || o.vers[0];
    dv = { v: nextV(o), st: 'Draft', at: 'just now', by: actor, note: `${add ? 'Add tool ' : 'Remove tool '}${tkey.split(':').pop()}`, cfg: structuredClone(base.cfg) };
    o.vers.unshift(dv);
  }
  if (dv.cfg) {
    const cur = (dv.cfg.tset || published).map(toolKey);
    dv.cfg.tset = add ? uniq(cur.concat([tkey])) : cur.filter((x) => x !== tkey);
  }
  return { v: dv.v, created };
}

// ============================================================ MCP CONNECTIONS

export const HEALTH_P: Record<string, DsStatus> = { Healthy: 'approved', Degraded: 'hold', Failing: 'rejected', 'Not checked': 'draft' };

export interface ConnTest {
  s: 'busy' | 'ok' | 'fail';
  m: string;
}

export interface McpRow {
  s: McpServer;
  n: string;
  vendor: string;
  isPlatS: boolean;
  kind: 'External' | 'Inside perimeter';
  status: string;
  p: DsStatus;
  hl: string;
  /** agents granted any of its tools */
  users: string[];
  wfs: Workflow[];
  enabled: string[];
}

/** Is a server usable by agents in tenant t (prototype `avail`)? */
export const mcpAvail = (af: AgentFactoryData, s: McpServer, t: string) =>
  s.own === 'platform' ? s.status === 'Enabled' && (s.ten || []).includes(t) && !(af.mcp.optOut[t] || {})[s.n] : s.own === t && s.status === 'Enabled' && !s.susp;

/** Agents granted tools of server n (optionally one tool) in tenant t. */
export const usersOfServer = (af: AgentFactoryData, t: string, n: string, tool?: string) =>
  Object.entries(af.mcp.grants[t] || {}).filter(([, gs]) => gs.some((g) => (tool ? g === `${n}:${tool}` : g.startsWith(`${n}:`)))).map(([a]) => a);

export function mcpRows(c: AfBase): McpRow[] {
  const R = c.af.mcp;
  const mine = R.servers.filter((s) => s.own === c.t);
  const shared = R.servers.filter((s) => s.own === 'platform' && (s.ten || []).includes(c.t) && !(R.optOut[c.t] || {})[s.n]);
  return shared.concat(mine).map((s) => {
    const plat = s.own === 'platform';
    const [status, p]: [string, DsStatus] = plat
      ? s.status !== 'Enabled' ? ['Disabled by platform', 'rejected'] : ['Available', 'approved']
      : s.susp ? ['Suspended by platform', 'rejected'] : s.status === 'Disabled' ? ['Disabled', 'draft'] : ['Enabled', 'approved'];
    const users = usersOfServer(c.af, c.t, s.n);
    const ok = mcpAvail(c.af, s, c.t);
    return {
      s, n: s.n, vendor: s.vendor, isPlatS: plat, kind: isExternal(s.up) ? 'External' : 'Inside perimeter', status, p, hl: ok ? s.health : '—', users,
      wfs: c.D.workflows.filter((w) => users.some((a) => wfUsing(c.D, a).some((x) => x.id === w.id))),
      enabled: (R.tenTools[c.t] || {})[s.n] || [],
    };
  });
}

export interface McpActs {
  register: () => void;
  test: (n: string) => void;
  enableTools: (n: string) => void;
  configure: (n: string) => void;
  toggle: (r: McpRow) => void;
  remove: (r: McpRow) => void;
  grant: (agent?: string) => void;
}
export interface McpCtx extends AfBase {
  go: ToolsNav & { tool: (key: string) => void };
  a: McpActs;
  tests: Record<string, ConnTest>;
}

/** Chip label of an assigned tool key (prototype `label`). */
export const grantLabel = (g: string) => {
  const [sv, tl] = g.split(':');
  return sv === 'kap' ? tl : `${sv}: ${tl}`;
};
/** native · shared · tenant */
export const grantKind = (af: AgentFactoryData, g: string): 'nat' | 'sh' | 'tn' => (g.startsWith('kap:') ? 'nat' : af.mcp.servers.find((s) => s.n === g.split(':')[0])?.own === 'platform' ? 'sh' : 'tn');
/** Can agents in tenant t call this tool right now? */
export function grantAvail(af: AgentFactoryData, t: string, g: string): boolean {
  const [sv, tl] = g.split(':');
  if (sv === 'kap') {
    const row = NATIVE_TOOLS.flatMap((x) => x[2]).find((x) => x[0] === tl);
    return !!row && !noModel(af.models, t, row[2]);
  }
  const s = af.mcp.servers.find((x) => x.n === sv);
  return !!s && mcpAvail(af, s, t) && ((af.mcp.tenTools[t] || {})[s.n] || []).includes(tl);
}
/** Tools that can be granted in tenant t (native + enabled tools of available servers). */
export function grantCandidates(af: AgentFactoryData, t: string): string[] {
  return NATIVE_TOOLS.flatMap((x) => x[2]).map((r) => `kap:${r[0]}`)
    .concat(af.mcp.servers.filter((s) => mcpAvail(af, s, t)).flatMap((s) => s.tools.filter((x) => ((af.mcp.tenTools[t] || {})[s.n] || []).includes(x.n)).map((x) => `${s.n}:${x.n}`)))
    .filter((g) => grantAvail(af, t, g));
}

const advKv = (s: McpServer) => kv([
  ['Route via MCP Proxy', `mcp-hub.kap.internal/${s.n}`, true], ['Transport', 'Streamable HTTP'], ['Egress allowlist', s.dest, true], ['Timeout', `${s.timeout} s`],
  ['Retries', s.retries], ['Rate limit', s.rate], ['Tool discovery', s.disc], ['Last change', s.by],
]);

export function mcpScreen(c: McpCtx, F: ListFilters, setF: (f: ListFilters) => void, openKey?: string): ScreenModel {
  const canAdmin = c.can('tenant:configure', 'tenant', '*');
  const canGrant = c.can('tool:grant', 'tenant', '*');
  const RW = mcpRows(c);
  const stL = (r: McpRow) => (r.status === 'Available' ? 'Enabled' : r.status);
  const OWN = ['All connections', 'Platform-managed', `${c.tn}-managed`];
  const ST = ['Any status', ...uniq(RW.map(stL))];
  const NET = ['Any network', 'Inside perimeter', 'External'];
  const own = fv(F, 'own', OWN[0]), st = fv(F, 'st', ST[0]), net = fv(F, 'net', NET[0]);
  const vis = RW.filter((r) => qOk(F.q, `${r.n} ${r.vendor || ''}`) && (own === OWN[0] || (own === 'Platform-managed' ? r.isPlatS : !r.isPlatS)) && (st === ST[0] || stL(r) === st) && (net === NET[0] || r.kind === net));

  const rows = vis.map((r): Row => {
    const s = r.s;
    const test = c.tests[r.n];
    return {
      key: `mc:${r.n}`,
      cells: [
        cell(r.n, { m: true, sub: r.vendor || '' }),
        cell(r.isPlatS ? 'Platform' : c.tn),
        cell(r.kind),
        cell(`${r.enabled.length} of ${s.tools.length}`),
        cell(r.users.length ? plural(r.users.length, 'agent') : 'Not used'),
        cell('', { p: [r.p, stL(r)] }),
        cell(r.hl || '—'),
      ],
      kv: [
        ...kv([
          ['Description', s.vendor || 'MCP server'], ['MCP Server URL', s.up, true], ['Authentication', s.auth + (s.secret ? ` · ${s.secret.split('/').pop()}` : '')],
          ['Classification ceiling', s.cls], ['Personal data', s.pii], ['Side effects', s.fx], r.isPlatS ? ['Managed by', 'Platform · read-only'] : null,
          ['Health', r.hl === '—' ? '—' : `${s.health} · last OK ${s.lastOk}${s.note ? ` · ${s.note}` : ''}`],
          test ? ['Connection test', test.s === 'busy' ? 'Checking connection…' : test.m] : null,
        ]),
        ...advKv(s),
      ],
      keepKv: true,
      lists: [
        {
          title: 'Discovered tools',
          items: s.tools.map((t) => {
            const u = usersOfServer(c.af, c.t, s.n, t.n);
            return { a: t.n, b: `${t.d}${t.fx ? ` · ${t.fx}` : ''}${u.length ? ` · granted to ${u.join(', ')}` : ''}`, c: r.enabled.includes(t.n) ? 'Enabled' : 'Not enabled', x: () => c.go.tool(`${s.n}:${t.n}`), xl: 'Open in Tools' };
          }),
          empty: 'No tools discovered',
        },
        {
          title: 'Used by',
          items: [
            ...r.users.map((a) => ({ a, b: 'Agent', c: '', x: () => c.go.agent(a, 'knowledge'), xl: 'Open agent' })),
            ...r.wfs.map((w) => ({ a: w.n, b: 'Workflow', c: '', x: () => c.go.workflow(w.id, 'designer'), xl: 'Open designer' })),
          ],
          empty: 'Not used by agents or workflows',
        },
      ],
      acts: [
        act('Test connection', () => c.a.test(r.n)),
        ...(canAdmin ? [act('Enable tools', () => c.a.enableTools(r.n))] : []),
        ...(canAdmin && !r.isPlatS ? [act('Configure', () => c.a.configure(r.n)), s.status === 'Disabled' ? act('Enable', () => c.a.toggle(r)) : act('Disable', () => c.a.toggle(r), 'ghost')] : []),
        ...(canAdmin && (!r.isPlatS || s.status === 'Enabled') ? [act(r.isPlatS ? 'Remove' : 'Delete', () => c.a.remove(r), 'ghost')] : []),
      ],
    };
  });

  // agent tool assignments (prototype mcpScreen `tlt.assign`)
  const chips = (gs: string[], k: 'nat' | 'sh' | 'tn') => gs.filter((g) => grantKind(c.af, g) === k).map((g) => grantLabel(g) + (grantAvail(c.af, c.t, g) ? '' : ' (unavailable)')).join(', ') || '—';
  const agents = c.D.agents.filter((a) => a.st !== 'Archived');
  const assign: Section = {
    title: 'Agent tool assignments',
    note: 'Published tool grants per agent: native tools, shared MCP servers and tenant MCP servers. Unavailable tools are marked; agents cannot call them.',
    sacts: canGrant ? [act('Grant tools', () => c.a.grant())] : [],
    empty: 'No agents in this tenant.',
    cols: [`${c.tn} agent`, 'Native tools', 'Shared MCP', 'Tenant MCP servers'],
    mode: 'inline',
    rows: agents.map((a): Row => {
      const gs = (c.af.mcp.grants[c.t] || {})[a.id] || [];
      return {
        key: `as:${a.id}`,
        cells: [cell(a.id, { m: true, sub: wfUsing(c.D, a.id).map((w) => w.n).join(', ') ? `AI Agent · ${wfUsing(c.D, a.id).map((w) => w.n).join(', ')}` : 'AI Agent' }), cell(chips(gs, 'nat')), cell(chips(gs, 'sh')), cell(chips(gs, 'tn'))],
        acts: canGrant ? [act('Edit', () => c.a.grant(a.id))] : [],
      };
    }),
  };

  return {
    head: { ...modHead('AI Agent Tools', TOOLS_TABS, 'mcpconn', c.go.tab), add: canAdmin ? act('Register MCP server', c.a.register, 'primary') : undefined },
    filters: filterBar(F, setF, [['own', 'Managed by', OWN], ['st', 'Status', ST], ['net', 'Network', NET]], 'Server name or description', `${vis.length} of ${RW.length} connections`),
    sections: [{ empty: RW.length ? 'No connections match the filters.' : 'No MCP connections yet.', cols: ['Connection', 'Managed by', 'Network', 'Tools enabled', 'Used by', 'Status', 'Health'], rows, openKey }, assign],
  };
}

/** Simulated connection check (prototype `sim`). */
export function simCheck(s: McpServer): { ok: boolean; h?: string; m: string } {
  if (s.status !== 'Enabled' || s.susp) return { ok: false, m: `Not checked · the server is ${s.susp ? 'suspended by the platform.' : 'disabled.'}` };
  if (/\.example/.test(s.up)) return { ok: false, m: `could not reach ${hostOf(s.up)} through the egress gateway.` };
  if (s.n === 'oxford_economics') return { ok: true, h: 'Degraded', m: `connected via MCP Proxy · handshake 640 ms · ${s.tools.length} tools listed · 1 of 10 probe calls returned 502` };
  return { ok: true, h: 'Healthy', m: `connected via MCP Proxy · handshake 210 ms · ${s.tools.length} tools listed` };
}

// ---- register / configure a tenant MCP server (prototype mcpF)

export const SERVER_SECRETS: Record<string, string[]> = {
  sceai: ['secret/tenants/sceai/kap/oxford_api_key', 'secret/tenants/sceai/kap/sceai_tools_client', 'secret/tenants/sceai/kap/dwh_mcp_cert', 'secret/tenants/sceai/kap/hr_directory_token'],
};
const DISC: Record<string, [string, string][]> = {
  'http://hr-mcp.hr.svc:8000/mcp': [['lookup_employee', 'Employee record by ID (masked)'], ['org_unit', 'Organisation unit and reporting line']],
  'https://api.worldbank.org/mcp': [['wb_indicator', 'World Bank indicator series'], ['wb_country', 'Country metadata']],
};

export const newServerValues = (t: string): FormValues => ({ n: '', own: t, vendor: '', up: '', dest: '', auth: 'OAuth2 client credentials', secret: 'Select credential', cls: 'L1 · Internal', pii: 'Not allowed', fx: 'Read-only', timeout: '30', rate: '60 / min', retries: '2', disc: 'Automatic' });
export const serverValues = (s: McpServer): FormValues => ({ ...s, secret: s.secret ? s.secret.split('/').pop() : 'Select credential' });

/** Validation of the server form (prototype mcpF `validate`). */
export function validateServer(v: FormValues, servers: McpServer[], isEdit: boolean, step = 9): string {
  if (!/^[a-z][a-z0-9_]{2,}$/.test(v.n || '')) return 'Name: lower-case letters, digits and underscores.';
  if (!isEdit && servers.some((s) => s.n === v.n)) return 'A server with this name already exists.';
  if (!/^https?:\/\/[^/]+/.test(v.up || '')) return 'Enter the MCP server URL.';
  if (v.auth !== 'None' && (!v.secret || v.secret === 'Select credential')) return 'Select a credential.';
  if (step < 1) return '';
  if (isExternal(v.up)) {
    if (!/^https:/.test(v.up)) return 'External servers must use HTTPS.';
    if (v.cls !== 'L0 · Public') return 'External servers can receive L0 · Public data only.';
    if (v.pii !== 'Not allowed') return 'External servers can’t receive personal data.';
    const h = hostOf(v.up).split(':')[0];
    if (!(v.dest || '').includes(h)) return `Add ${h} to the egress allowlist.`;
  }
  if (!(+v.timeout > 0)) return 'Enter a timeout in seconds.';
  return '';
}

/** Test Connection & Discover Tools (prototype mf.test). */
export function discover(v: FormValues, prev: McpServer | null): { ok: boolean; m: string; tools: McpServer['tools'] } {
  const up = String(v.up || '').trim();
  const notMcp = !/\/(mcp|sse)\/?$/.test(up);
  const fail = /\.example/.test(up) || notMcp;
  const epChanged = !prev || prev.up !== up;
  const tools = epChanged ? (DISC[up] || [['search', 'Search records'], ['get_record', 'Read one record by ID']]).map(([n, d]) => ({ n, d, fx: v.fx === 'Read-only' ? 'Read-only' : 'Changes state' })) : prev!.tools;
  if (notMcp) return { ok: false, tools: [], m: `${hostOf(up)} did not answer the MCP initialize handshake. Register the endpoint of an MCP-compatible server (…/mcp or …/sse).` };
  if (fail) return { ok: false, tools: [], m: `could not reach ${hostOf(up)}.` };
  return { ok: true, tools, m: `connected via MCP Proxy · ${epChanged ? 'discovered ' : 'listed '}${tools.length} tools: ${tools.map((t) => t.n).join(', ')}` };
}

export function serverFields(t: string, step: number, v: FormValues, isEdit: boolean, prev: McpServer | null): FormField[] {
  const secs = ['Select credential', ...(SERVER_SECRETS[t] || []).map((x) => x.split('/').pop()!)];
  if (step === 0)
    return [
      isEdit ? { type: 'text', k: 'n', label: 'Name', ro: true, hint: 'Names can’t be changed after creation.' } : { type: 'text', k: 'n', label: 'Name', ph: 'e.g. hr_directory' },
      { type: 'text', k: 'vendor', label: 'Description', ph: 'e.g. HR directory MCP server · read-only' },
      { type: 'text', k: 'up', label: 'MCP Server URL', ph: 'https://…/mcp', hint: 'Endpoint of an MCP-compatible server (Streamable HTTP).' },
      { type: 'select', k: 'auth', label: 'Authentication', opts: ['OAuth2 client credentials', 'API key', 'mTLS', 'None'] },
      ...(v.auth !== 'None' ? [{ type: 'select', k: 'secret', label: 'Credential', opts: secs, hint: 'Managed in Security & Credentials.' } as FormField] : []),
    ];
  if (step === 1)
    return [
      { type: 'select', k: 'cls', label: 'Classification ceiling', opts: ['L0 · Public', 'L1 · Internal', 'L2 · Restricted'] },
      { type: 'select', k: 'pii', label: 'Personal data', opts: ['Not allowed', 'Masked', 'Allowed'] },
      { type: 'select', k: 'fx', label: 'Side effects', opts: ['Read-only', 'Changes state'] },
      { type: 'text', k: 'dest', label: 'Egress allowlist', ph: 'host:port', hint: isExternal(v.up) ? `External server: add ${hostOf(v.up).split(':')[0]}.` : undefined },
      { type: 'num', k: 'timeout', label: 'Timeout (s)' },
      { type: 'text', k: 'rate', label: 'Rate limit' },
      { type: 'select', k: 'retries', label: 'Retries', opts: ['0', '1', '2', '3'] },
      { type: 'select', k: 'disc', label: 'Tool discovery', opts: ['Automatic', 'Manual'] },
    ];
  const r = discover(v, prev);
  return [
    { type: 'note', label: 'Test Connection & Discover Tools', tone: r.ok ? 'ok' : 'bad', text: r.m },
    ...(r.ok ? [{ type: 'kv', label: 'Discovered tools', rows: r.tools.map((x) => [x.n, `${x.d} · ${x.fx}`]) } as FormField] : []),
    { type: 'note', text: isEdit ? 'Changes apply at once. Tools no longer offered by the server are removed from the tenant.' : 'After registering, enable its tools to make them available to agents.' },
  ];
}

// ============================================================ SCHEDULES & EVENTS · triggers

export const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const TIMES = ['00:00', '03:00', '06:00', '07:00', '08:00', '12:00', '18:00', '22:00'];
export const isEv = (v: FormValues) => v.kind === 'Event-driven trigger';

/** Human schedule / event text (prototype trigOf). */
export const trigOf = (v: FormValues) =>
  isEv(v) ? `${v.ev} · ${v.obj}`
    : v.rec === 'Once' ? `Once · ${v.date || 'date not set'} ${v.time} AST`
      : v.rec === 'Hourly' ? `Hourly · at minute ${v.min}`
        : v.rec === 'Daily' ? `Daily ${v.time} AST`
          : v.rec === 'Weekly' ? `Weekly · ${v.dow} ${v.time} AST`
            : `Monthly · ${v.dom} at ${v.time} AST`;

export function nextOf(s: Schedule): string {
  const c = s.cfg || {};
  if (s.kind !== 'Schedule' || !s.on) return '—';
  if (c.rec === 'Hourly') return 'Within the hour';
  if (c.rec === 'Daily') return `Tomorrow ${c.time}`;
  if (c.rec === 'Weekly') return `${c.dow} ${c.time}`;
  if (c.rec === 'Monthly') return `${c.dom} of next month ${c.time}`;
  if (c.rec === 'Once') return `${c.date || '—'} ${c.time}`;
  return '—';
}

export const nameOf = (D: AfTenant, key: string) => {
  const [k, id] = key.split(':');
  return k === 'workflow' ? D.workflows.find((w) => w.id === id)?.n ?? id : id;
};
export const objOf = (D: AfTenant, key: string): Agent | Workflow | undefined => {
  const [k, id] = key.split(':');
  return k === 'agent' ? D.agents.find((a) => a.id === id) : D.workflows.find((w) => w.id === id);
};
/** Published version of an agent or workflow. */
export const pubVer = (o: Agent | Workflow): { v: string } | undefined => (o.vers as { v: string; st: string }[]).find((x) => x.st === 'Published');
/** Trigger targets: non-archived agents and workflows. */
export const targetsOf = (D: AfTenant) => D.agents.filter((a) => a.st !== 'Archived').map((a) => `agent:${a.id}`).concat(D.workflows.map((w) => `workflow:${w.id}`));

/** Events a trigger can listen to: [event, object label, objects]. */
export function eventsOf(D: AfTenant, pipes: string[], colls: string[]): [string, string, string[]][] {
  const TG = targetsOf(D).map((k) => nameOf(D, k));
  return [
    ['Ingestion run completed', 'Pipeline', pipes.length ? pipes : ['indicators_csv_ingest']],
    ['Document added to a collection', 'Collection', colls.length ? colls : ['—']],
    ['Knowledge gap recorded', 'Agent', D.agents.map((a) => a.id)],
    ['Evaluation gate failed', 'Agent or workflow', TG],
    ['Agent or workflow disabled', 'Agent or workflow', TG],
  ];
}

/** Wizard values of a trigger (prototype toV). */
export function schedValues(D: AfTenant, EVS: [string, string, string[]][], s: Schedule | null, kind0?: string): FormValues {
  const c = (s && s.cfg) || {};
  const TG = targetsOf(D);
  return {
    kind: kind0 || (s ? (s.kind === 'Event' ? 'Event-driven trigger' : 'Time-based trigger') : 'Time-based trigger'),
    n: s ? s.n : '', rec: c.rec || 'Weekly', time: c.time || '06:00', min: c.min || '00', dow: c.dow || 'Sunday', dom: c.dom || '1st', date: c.date || '',
    overlap: c.overlap || 'Skip if the previous run is still running', ev: c.ev || EVS[0][0], obj: c.obj || EVS[0][2][0], filt: c.filt || '',
    rate: c.rate || 'Run for every event', pass: c.pass || 'Pass the event details as input',
    t: s ? nameOf(D, s.target) : TG[0] ? nameOf(D, TG[0]) : '', ver: s && s.ver.startsWith('Pinned') ? 'Pinned to current published version' : 'Published version', inputs: s ? s.inputs : '',
  };
}

export const SCHED_STEPS = ['Trigger type', 'When it runs', 'Target and inputs', 'Review'];

export function schedFields(D: AfTenant, tn: string, EVS: [string, string, string[]][], step: number, v: FormValues): FormField[] {
  const TG = targetsOf(D);
  const ev = isEv(v);
  if (step === 0)
    return [
      { type: 'select', k: 'kind', label: 'Trigger type', opts: ['Time-based trigger', 'Event-driven trigger'] },
      { type: 'note', label: ev ? 'Event-driven trigger' : 'Time-based trigger', text: ev ? `Runs when something happens in ${tn}, for example when an ingestion run completes or a document is added.` : 'Runs at set times or at a regular interval, for example every Sunday at 06:00.' },
      { type: 'text', k: 'n', label: 'Name', ph: ev ? 'e.g. Refresh answers after data load' : 'e.g. Weekly briefing' },
    ];
  if (step === 1 && !ev)
    return [
      { type: 'select', k: 'rec', label: 'Repeats', opts: ['Once', 'Hourly', 'Daily', 'Weekly', 'Monthly'] },
      ...(v.rec === 'Once' ? [{ type: 'text', k: 'date', label: 'Date', ph: 'YYYY-MM-DD' } as FormField] : []),
      ...(v.rec === 'Weekly' ? [{ type: 'select', k: 'dow', label: 'Day of the week', opts: DOW } as FormField] : []),
      ...(v.rec === 'Monthly' ? [{ type: 'select', k: 'dom', label: 'Day of the month', opts: ['1st', '15th', 'Last day'] } as FormField] : []),
      v.rec === 'Hourly' ? { type: 'select', k: 'min', label: 'Minute past the hour', opts: ['00', '15', '30', '45'] } : { type: 'select', k: 'time', label: 'Time (Asia/Qatar)', opts: TIMES },
      { type: 'select', k: 'overlap', label: 'If the previous run is still running', opts: ['Skip if the previous run is still running', 'Queue the new run'] },
      { type: 'kv', label: 'Schedule', rows: [['Runs', trigOf(v)]] },
    ];
  if (step === 1) {
    const e0 = EVS.find((x) => x[0] === v.ev) || EVS[0];
    return [
      { type: 'select', k: 'ev', label: 'Event', opts: EVS.map((x) => x[0]) },
      { type: 'select', k: 'obj', label: e0[1], opts: e0[2] },
      { type: 'text', k: 'filt', label: 'Only when (optional)', ph: v.ev === 'Ingestion run completed' ? 'e.g. status is Succeeded' : 'e.g. language is Arabic' },
      { type: 'select', k: 'rate', label: 'Frequency limit', opts: ['Run for every event', 'At most once per hour', 'At most once per day'] },
      { type: 'kv', label: 'Trigger', rows: [['Runs when', trigOf(v) + (v.filt ? ` · only when ${v.filt}` : '')]] },
    ];
  }
  if (step === 2)
    return [
      { type: 'select', k: 't', label: 'Agent or workflow', opts: TG.map((k) => nameOf(D, k)) },
      { type: 'select', k: 'ver', label: 'Version', opts: ['Published version', 'Pinned to current published version'] },
      { type: 'text', k: 'inputs', label: 'Execution inputs', ph: ev ? 'e.g. Question set: top movers summary' : 'e.g. Period: previous week · language: English' },
      ...(ev ? [{ type: 'select', k: 'pass', label: 'Event details', opts: ['Pass the event details as input', 'Do not pass event details'] } as FormField] : []),
    ];
  const tk = TG.find((x) => nameOf(D, x) === v.t);
  return [
    {
      type: 'kv',
      label: v.n || 'New trigger',
      rows: [
        ['Type', v.kind],
        [ev ? 'Runs when' : 'Runs', trigOf(v) + (ev && v.filt ? ` · only when ${v.filt}` : '')],
        ev ? ['Frequency limit', v.rate] : ['Overlapping runs', v.overlap],
        ['Target', (tk ? `${tk.split(':')[0]} ` : '') + v.t],
        ['Version', v.ver],
        ['Inputs', (v.inputs || '—') + (ev ? ` · ${String(v.pass).toLowerCase()}` : '')],
      ],
    },
  ];
}

export function validateSched(D: AfTenant, step: number, v: FormValues, set?: (k: string, val: unknown) => void, EVS?: [string, string, string[]][]): string {
  if (step === 0 && !(v.n || '').trim()) return 'Enter a name.';
  if (step === 1 && isEv(v) && EVS && set) {
    const e0 = EVS.find((x) => x[0] === v.ev) || EVS[0];
    if (!e0[2].includes(v.obj)) set('obj', e0[2][0]);
  }
  if (step === 1 && !isEv(v) && v.rec === 'Once' && !/^\d{4}-\d{2}-\d{2}$/.test((v.date || '').trim())) return 'Enter the date as YYYY-MM-DD.';
  if (step === 2) {
    const tk = targetsOf(D).find((x) => nameOf(D, x) === v.t);
    const o = tk && objOf(D, tk);
    if (!o || !pubVer(o)) return `${v.t} has no published version yet.`;
  }
  return '';
}

/** Trigger record from wizard values (prototype finish). */
export function schedRecord(D: AfTenant, v: FormValues): Omit<Schedule, 'id' | 'on' | 'by' | 'hist'> {
  const tk = targetsOf(D).find((x) => nameOf(D, x) === v.t) || '';
  const o = objOf(D, tk);
  const pv = o ? pubVer(o) || o.vers[0] : null;
  const pin = String(v.ver).startsWith('Pinned') ? `Pinned ${pv?.v ?? ''}` : 'Published version';
  const ev = isEv(v);
  return {
    n: String(v.n).trim(),
    kind: ev ? 'Event' : 'Schedule',
    target: tk,
    ver: pin,
    trig: trigOf(v) + (ev && v.filt ? ` · only when ${String(v.filt).trim()}` : ''),
    inputs: String(v.inputs || '').trim(),
    cfg: ev ? { ev: v.ev, obj: v.obj, filt: String(v.filt || '').trim(), rate: v.rate, pass: v.pass } : { rec: v.rec, time: v.time, min: v.min, dow: v.dow, dom: v.dom, date: String(v.date || '').trim(), overlap: v.overlap },
  };
}

export interface SchedActs {
  create: (kind: 'Time-based trigger' | 'Event-driven trigger') => void;
  edit: (s: Schedule) => void;
  runNow: (s: Schedule) => void;
  toggle: (s: Schedule) => void;
  remove: (s: Schedule) => void;
}
export interface SchedCtx extends AfBase {
  go: { tab: (v: string) => void; agent: (id: string, tab?: string) => void; workflow: (id: string, tab?: string) => void; run: (id: string) => void };
  a: SchedActs;
}

export const canSched = (c: AfBase) => c.can('agent:execute', 'agent', '*') || c.can('tenant:configure', 'tenant', '*');

export function schedulesScreen(c: SchedCtx, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  const { D } = c;
  const ed = canSched(c);
  const ON = ['Any state', 'Enabled', 'Disabled'];
  const TK = ['Any target', 'Agents', 'Workflows'];
  const on = fv(F, 'on', ON[0]), tk = fv(F, 'tk', TK[0]);
  const okS = (s: Schedule) => qOk(F.q, `${s.n} ${s.trig} ${nameOf(D, s.target)}`) && (on === ON[0] || (on === 'Enabled') === !!s.on) && (tk === TK[0] || (tk === 'Agents') === s.target.startsWith('agent:'));
  const nVis = D.scheds.filter(okS).length;
  const tgtC = (s: Schedule) => cell(nameOf(D, s.target), { sub: `${s.target.split(':')[0]} · ${s.ver}` });
  const rowOf = (s: Schedule, cells: Row['cells']): Row => {
    const o = objOf(D, s.target);
    const [k, id] = s.target.split(':');
    return {
      key: `sc:${s.id}`,
      cells: [...cells, cell('', { p: o?.dis ? ['rejected', 'Target disabled'] : s.on ? ['approved', 'Enabled'] : ['draft', 'Disabled'] }), cell(s.hist[0] ? `${s.hist[0][2]} · ${s.hist[0][1]}` : 'Never')],
      kv: kv([
        ['Type', s.kind === 'Event' ? 'Event-driven trigger' : 'Time-based trigger'],
        [s.kind === 'Event' ? 'Runs when' : 'Runs', s.trig],
        s.kind === 'Event' ? ['Frequency limit', s.cfg?.rate || 'Run for every event'] : ['Overlapping runs', s.cfg?.overlap || 'Skip if the previous run is still running'],
        ['Version', s.ver], ['Execution inputs', s.inputs], ['Created by', s.by],
      ]),
      lists: [{ title: 'Recent executions', items: s.hist.map(([rid, at, st]) => ({ a: rid, b: st, c: at, x: () => c.go.run(rid), xl: 'Open job' })), empty: 'No runs yet' }],
      acts: [
        act('Open target', () => (k === 'workflow' ? c.go.workflow(id) : c.go.agent(id))),
        ...(ed ? [act('Run now', () => c.a.runNow(s)), act('Edit', () => c.a.edit(s)), act(s.on ? 'Disable' : 'Enable', () => c.a.toggle(s)), act('Delete', () => c.a.remove(s), 'ghost')] : []),
      ],
    };
  };
  return {
    head: modHead('Schedules & Events', SCHEDULE_TABS, 'schedules', c.go.tab),
    filters: filterBar(F, setF, [['on', 'State', ON], ['tk', 'Target', TK]], 'Trigger name, schedule, event or target', `${nVis} of ${D.scheds.length} triggers`),
    sections: [
      {
        title: 'Time-based triggers',
        sacts: ed ? [act('Create time-based trigger', () => c.a.create('Time-based trigger'))] : [],
        empty: 'No time-based triggers yet.',
        cols: ['Trigger', 'Runs', 'Next run', 'Target', 'State', 'Last run'],
        rows: D.scheds.filter((s) => s.kind !== 'Event' && okS(s)).map((s) => rowOf(s, [cell(s.n, { sub: s.id }), cell(s.trig), cell(nextOf(s)), tgtC(s)])),
      },
      {
        title: 'Event-driven triggers',
        sacts: ed ? [act('Create event-driven trigger', () => c.a.create('Event-driven trigger'))] : [],
        empty: 'No event triggers yet.',
        cols: ['Trigger', 'Event', 'Source', 'Target', 'State', 'Last run'],
        rows: D.scheds.filter((s) => s.kind === 'Event' && okS(s)).map((s) =>
          rowOf(s, [cell(s.n, { sub: s.id }), cell(s.cfg?.ev || s.trig.split(' · ')[0], { sub: s.cfg?.filt ? `Only when ${s.cfg.filt}` : '' }), cell(s.cfg?.obj || s.trig.split(' · ')[1] || '—'), tgtC(s)]),
        ),
      },
    ],
  };
}

// ============================================================ SCHEDULES & EVENTS · scheduled reports

const FQ: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const DL: Record<string, string> = { email: 'Email', teams: 'Teams', both: 'Email + Teams' };
export const freqL = (r: Pick<Report, 'freq' | 'day' | 'time'>) => `${FQ[r.freq]}${r.freq !== 'daily' ? ` · ${r.day}` : ''} ${r.time} AST`;
export const destL = (r: Pick<Report, 'del' | 'rcp'>) => `${DL[r.del]} · ${r.rcp.length === 1 ? r.rcp[0] : `${r.rcp.length} recipients`}`;
export const delL = (r: Pick<Report, 'del'>) => DL[r.del];
export const secL = (r: Pick<Report, 'sec'>) => r.sec.map((k) => (REPORT_SECTIONS.find((x) => x[0] === k) || [k, k])[1]).join(', ') || 'No sections';
export const fmtL = (r: Pick<Report, 'fmt'>) => (r.fmt === 'both' ? 'PDF + XLSX' : r.fmt.toUpperCase());

/** Validation on save (prototype repSave). */
export function validateReport(E: Pick<Report, 'n' | 'sec' | 'rcp'>): string {
  if (!E.n.trim()) return 'Enter the report name.';
  if (!E.sec.length) return 'Select at least one section.';
  if (!E.rcp.length) return 'Add at least one recipient.';
  return '';
}

export interface ReportsCtx {
  tn: string;
  reports: Report[];
  history: DeliveryRow[];
  /** tenant:configure */
  canEdit: boolean;
  selId: string;
  go: { tab: (v: string) => void };
  a: { create: () => void; select: (id: string) => void; runNow: (r: Report) => void };
}

/** Report list, filters and delivery history; the editor and PDF preview are a custom section the page supplies. */
export function reportsScreen(c: ReportsCtx, F: ListFilters, setF: (f: ListFilters) => void, editor?: Section): ScreenModel {
  const pl = (r: Report) => (r.on ? r.pl : 'Paused');
  const ST = ['Any status', ...uniq(c.reports.map(pl))];
  const st = fv(F, 'st', ST[0]);
  const vis = c.reports.filter((r) => qOk(F.q, `${r.n} ${secL(r)} ${destL(r)}`) && (st === ST[0] || pl(r) === st));
  const head: PageHead = { ...modHead('Schedules & Events', SCHEDULE_TABS, 'reports', c.go.tab), add: c.canEdit ? act('Create report', c.a.create, 'primary') : undefined };
  const list: Section = {
    empty: c.reports.length ? 'No reports match the filters.' : `No scheduled reports in ${c.tn} yet.`,
    cols: ['Report', 'Content', 'Delivery schedule', 'Destination', 'Format', 'Next run', 'Last delivery'],
    mode: 'inline',
    rows: vis.map((r): Row => ({
      key: `rp:${r.id}`,
      cells: [
        cell(r.n, { sub: `Owner ${r.owner}${r.id === c.selId ? ' · editing below' : ''}` }),
        cell(secL(r)),
        cell(freqL(r)),
        cell(destL(r)),
        cell(fmtL(r), { m: true }),
        cell(r.on ? r.next : '—'),
        cell('', { p: r.on ? [r.p, r.pl] : ['draft', 'Paused'] }),
      ],
      acts: [act(r.id === c.selId ? 'Selected' : 'Open', () => c.a.select(r.id), r.id === c.selId ? 'secondary' : 'outline'), ...(c.canEdit ? [act('Run now', () => c.a.runNow(r))] : [])],
      onClick: () => c.a.select(r.id),
    })),
  };
  const hist: Section = {
    title: 'Delivery history',
    badge: 'Last 30 days',
    empty: 'No deliveries yet.',
    cols: ['Sent', 'Report', 'Period', 'Recipients', 'Delivery', 'Status', 'Action'],
    mode: 'inline',
    rows: c.history.map((x, i): Row => ({ key: `dh:${i}`, cells: [cell(x[0]), cell(x[1]), cell(x[2]), cell(x[3]), cell(x[4]), cell('', { p: [x[5], x[6]], tip: x[7] }), cell(x[8], { sub: x[7] })] })),
  };
  return {
    head,
    filters: filterBar(F, setF, [['st', 'Last delivery', ST]], 'Report name, content or destination', `${vis.length} of ${c.reports.length} reports`),
    sections: [list, ...(editor ? [editor] : []), hist],
  };
}
