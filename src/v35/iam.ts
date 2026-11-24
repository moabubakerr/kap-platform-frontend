/**
 * v35 identity & access model (mock) and its evaluation, ported from the
 * prototype's iamInit / iamEval (design-ref-v35/app.js). The same model —
 * users, tenant groups, grants (role × scope), roles, access policies,
 * service accounts, platform administrators — is what the platform layer
 * stores in its own database.
 *
 * Evaluation order: account status → groups → grants → scope → action →
 * access policies; no applicable grant means deny.
 */
import { createStore } from '@/engine/store';

export type TenantKey = 'sceai' | 'econ' | 'sandbox' | 'default';
export type ResType = 'agent' | 'collection' | 'tenant';

export interface IamUser { id: string; name: string; email: string; idp: string; last: string; dis: Partial<Record<TenantKey, boolean>> }
export interface IamGroup { t: TenantKey; n: string; d: string; members: string[]; st?: 'Disabled' }
export interface IamGrant { id: string; t: TenantKey; g: string; r: string; scope: string }
export interface IamPolicy { t: TenantKey; n: string; kind: 'Classification' | 'Need-to-know'; res: string[]; cleared: string[] }
export interface PlatformAdmin { id: string; name: string; email: string; role: 'Platform Administrator' | 'Platform Viewer' | 'Security Officer'; st: 'Active' | 'Disabled'; last: string; src: string }

export const BUILTIN_ROLES: Record<string, string[]> = {
  'Tenant Administrator': ['agent:create', 'agent:read', 'agent:update', 'agent:execute', 'agent:oversee', 'agent:delete', 'tool:grant', 'collection:read', 'pipeline:execute', 'data:manage', 'tenant:configure', 'user:manage', 'grant:manage'],
  'Agent Developer': ['agent:create', 'agent:read', 'agent:update', 'agent:execute'],
  'Agent Reviewer': ['agent:read', 'agent:execute', 'agent:oversee'],
  Analyst: ['agent:read', 'agent:execute', 'collection:read'],
  'API Client': ['agent:read', 'agent:execute', 'collection:read'],
  'Pipeline Operator': ['pipeline:execute'],
};

const INITIAL_CUSTOM_ROLES: { t: TenantKey; n: string; perms: string[]; by: string }[] = [{ t: 'sceai' as TenantKey, n: 'Indicator Agent Builder', perms: ['agent:create', 'agent:read', 'agent:update'], by: 'sceai_admin · 96 d ago' }];

export const PLATFORM_ROLES: Record<PlatformAdmin['role'], string[]> = {
  'Platform Administrator': ['platform:read', 'platform:manage', 'config:read', 'config:manage', 'monitor:read', 'monitor:manage', 'audit:read', 'security:read', 'security:manage', 'license:read', 'license:manage'],
  'Platform Viewer': ['platform:read', 'config:read', 'monitor:read', 'audit:read', 'license:read'],
  'Security Officer': ['security:read', 'security:manage', 'audit:read'],
};

const INITIAL_USERS: IamUser[] = [
  { id: 'sceai_admin', name: 'SCEAI Administrator', email: 'kap.admin@sceai.gov.qa', idp: 'Microsoft Entra ID · SCEAI', last: '25 min ago', dis: {} },
  { id: 'r.haddad', name: 'Rami Haddad', email: 'rami.haddad@partner.qa', idp: 'Microsoft Entra ID · SCEAI', last: '2 h ago', dis: {} },
  { id: 'k.ibrahim', name: 'Khalid Ibrahim', email: 'k.ibrahim@partner.qa', idp: 'Microsoft Entra ID · SCEAI', last: '40 min ago', dis: {} },
  { id: 'n.saleh', name: 'Noura Saleh', email: 'n.saleh@sceai.gov.qa', idp: 'Microsoft Entra ID · SCEAI', last: '1 h ago', dis: {} },
  { id: 'm.alkuwari', name: 'Mariam Al-Kuwari', email: 'm.alkuwari@sceai.gov.qa', idp: 'Microsoft Entra ID · SCEAI', last: '8 min ago', dis: {} },
  { id: 'sceai_analyst', name: 'SCEAI Analyst', email: 'analyst@sceai.gov.qa', idp: 'Microsoft Entra ID · SCEAI', last: '3 min ago', dis: {} },
  { id: 'ea_admin', name: 'EA Administrator', email: 'kap.admin@ea.gov.qa', idp: 'Microsoft Entra ID · Economic Affairs', last: '1 d ago', dis: {} },
  { id: 'ea_analyst', name: 'EA Analyst', email: 'analyst@ea.gov.qa', idp: 'Microsoft Entra ID · Economic Affairs', last: '4 h ago', dis: {} },
  { id: 'sbx_analyst', name: 'Sandbox Analyst', email: 'sbx.analyst@kap.internal', idp: 'Keycloak · kap-admin realm', last: '2 d ago', dis: {} },
];

const INITIAL_GROUPS: IamGroup[] = [
  { t: 'sceai', n: 'tenant_admins', d: 'SCEAI tenant administrators', members: ['sceai_admin'] },
  { t: 'sceai', n: 'agent_developers', d: 'Implementation partner developers', members: ['r.haddad', 'k.ibrahim'] },
  { t: 'sceai', n: 'indicator_builders', d: 'SCEAI indicators team', members: ['n.saleh'] },
  { t: 'sceai', n: 'agent_reviewers', d: 'Review answer quality, evaluations and incidents', members: ['m.alkuwari'] },
  { t: 'sceai', n: 'economic_analysts', d: 'Economic analysts', members: ['sceai_analyst'] },
  { t: 'econ', n: 'ea_admins', d: 'Economic Affairs administrators', members: ['ea_admin'] },
  { t: 'econ', n: 'ea_analysts', d: 'Economic Affairs analysts', members: ['ea_analyst'] },
  { t: 'sandbox', n: 'sbx_admins', d: 'AI team', members: ['r.haddad'] },
  { t: 'sandbox', n: 'sbx_testers', d: 'Sandbox test users', members: ['sbx_analyst'] },
];

const INITIAL_GRANTS: IamGrant[] = [
  { id: 'G-101', t: 'sceai', g: 'tenant_admins', r: 'Tenant Administrator', scope: 'tenant' },
  { id: 'G-102', t: 'sceai', g: 'agent_developers', r: 'Agent Developer', scope: 'agents:*' },
  { id: 'G-103', t: 'sceai', g: 'indicator_builders', r: 'Indicator Agent Builder', scope: 'agents:*' },
  { id: 'G-105', t: 'sceai', g: 'agent_reviewers', r: 'Agent Reviewer', scope: 'agents:*' },
  { id: 'G-104', t: 'sceai', g: 'economic_analysts', r: 'Analyst', scope: 'agent:sceai_indicators_agent' },
  { id: 'G-106', t: 'sceai', g: 'economic_analysts', r: 'Analyst', scope: 'agent:sceai_indicators_oxford' },
  { id: 'EA-01', t: 'econ', g: 'ea_admins', r: 'Tenant Administrator', scope: 'tenant' },
  { id: 'EA-02', t: 'econ', g: 'ea_analysts', r: 'Analyst', scope: 'agent:policy_brief_agent' },
  { id: 'EA-03', t: 'econ', g: 'ea_analysts', r: 'Analyst', scope: 'collection:budget_reports' },
  { id: 'EA-04', t: 'econ', g: 'ea_analysts', r: 'Analyst', scope: 'collection:econ_indicators' },
  { id: 'SB-01', t: 'sandbox', g: 'sbx_admins', r: 'Tenant Administrator', scope: 'tenant' },
  { id: 'SB-02', t: 'sandbox', g: 'sbx_testers', r: 'Analyst', scope: 'tenant' },
];

const INITIAL_POLICIES: IamPolicy[] = [
  { t: 'sceai', n: 'L0 · Public', kind: 'Classification', res: ['collection:sceai_articles'], cleared: ['*'] },
  { t: 'sceai', n: 'L1 · Internal', kind: 'Classification', res: ['collection:sceai_indicators', 'dataset:sceai_indicator_observations'], cleared: ['tenant_admins', 'economic_analysts', 'agent_developers', 'indicator_builders', 'agent_reviewers'] },
  { t: 'sceai', n: 'L2 · Restricted', kind: 'Classification', res: ['collection:nds_planning_docs'], cleared: ['tenant_admins'] },
  { t: 'sceai', n: 'Strategy planning', kind: 'Need-to-know', res: ['collection:nds_planning_docs'], cleared: ['tenant_admins', 'indicator_builders'] },
  { t: 'econ', n: 'L1 · Internal', kind: 'Classification', res: ['collection:budget_reports', 'collection:econ_indicators'], cleared: ['ea_admins', 'ea_analysts'] },
  { t: 'sandbox', n: 'L0 · Public', kind: 'Classification', res: ['collection:sandbox_indicators', 'collection:sandbox_public_docs'], cleared: ['*'] },
  { t: 'sandbox', n: 'L2 · Confidential', kind: 'Classification', res: ['collection:sandbox_confidential_docs'], cleared: ['sbx_admins'] },
  { t: 'sandbox', n: 'Customer data', kind: 'Need-to-know', res: ['collection:customer_c001', 'dataset:c001_transactions', 'document:C001_Service_Agreement.pdf', 'document:C001_Correspondence_2026.eml'], cleared: ['sbx_admins'] },
];

const INITIAL_PLATFORM_ADMINS: PlatformAdmin[] = [
  { id: 'kap.ops', name: 'KAP Platform Administrator', email: 'kap.ops@kap.internal', role: 'Platform Administrator', st: 'Active', last: 'Now', src: 'Keycloak · kap-admin realm' },
  { id: 'm.alkuwari', name: 'Mariam Al-Kuwari', email: 'm.alkuwari@sceai.gov.qa', role: 'Platform Administrator', st: 'Active', last: '8 min ago', src: 'Keycloak · kap-admin realm' },
  { id: 'r.haddad', name: 'Rami Haddad', email: 'rami.haddad@partner.qa', role: 'Platform Administrator', st: 'Active', last: '2 h ago', src: 'Keycloak · kap-admin realm' },
];

export interface IamData {
  users: IamUser[];
  groups: IamGroup[];
  grants: IamGrant[];
  policies: IamPolicy[];
  customRoles: { t: TenantKey; n: string; perms: string[]; by: string }[];
  padmins: PlatformAdmin[];
}

/**
 * The editable IAM state (session). Screens that create users, groups, grants,
 * roles or policies update it, and every access check reads it, so changes take
 * effect immediately — as in the prototype.
 */
export const iamStore = createStore<IamData>(() => ({
  users: structuredClone(INITIAL_USERS),
  groups: structuredClone(INITIAL_GROUPS),
  grants: structuredClone(INITIAL_GRANTS),
  policies: structuredClone(INITIAL_POLICIES),
  customRoles: structuredClone(INITIAL_CUSTOM_ROLES),
  padmins: structuredClone(INITIAL_PLATFORM_ADMINS),
}));
const D = () => iamStore.get();

/** Collections per tenant, for "any collection" checks (until the data hub is ported). */
export const COLLECTIONS: Record<TenantKey, string[]> = {
  sceai: ['sceai_indicators', 'sceai_articles', 'nds_planning_docs'],
  econ: ['budget_reports', 'econ_indicators'],
  sandbox: ['sandbox_indicators', 'sandbox_public_docs', 'sandbox_confidential_docs', 'customer_c001'],
  default: [],
};

export const TENANT_KEYS: TenantKey[] = ['sceai', 'econ', 'sandbox'];

// ------------------------------------------------------------------ evaluation
export const rolesIn = (t: TenantKey): Record<string, string[]> => ({ ...BUILTIN_ROLES, ...Object.fromEntries(D().customRoles.filter((r) => r.t === t).map((r) => [r.n, r.perms])) });
export const groupsOf = (uid: string, t: TenantKey) => D().groups.filter((g) => g.t === t && g.st !== 'Disabled' && g.members.includes(uid)).map((g) => g.n);
export const platformAdmin = (uid: string) => D().padmins.find((a) => a.id === uid && a.st === 'Active') ?? null;
export const canPlatform = (uid: string, perm: string) => {
  const pa = platformAdmin(uid);
  return !!pa && (PLATFORM_ROLES[pa.role] ?? []).includes(perm);
};

const blockedBy = (t: TenantKey, key: string, gs: string[]) => D().policies.filter((p) => p.t === t && p.res.includes(key)).filter((p) => !(p.cleared.includes('*') || p.cleared.some((x) => gs.includes(x))));

export interface Decision { ok: boolean; why: string; grant?: IamGrant }

export function evaluate(uid: string, t: TenantKey, perm: string, type: ResType, id = '*'): Decision {
  const u = D().users.find((x) => x.id === uid);
  if (!u) return { ok: false, why: 'Not a user of this tenant' };
  if (u.dis[t]) return { ok: false, why: 'Account disabled in this tenant' };
  const gs = groupsOf(uid, t);
  if (!gs.length) return { ok: false, why: 'Not a member of an active group' };
  const gr = D().grants.filter((g) => g.t === t && gs.includes(g.g));
  if (!gr.length) return { ok: false, why: 'No access grant' };
  const RP = rolesIn(t);
  const withPerm = (s: IamGrant[]) => s.filter((g) => (RP[g.r] ?? []).includes(perm));
  const ok = (g: IamGrant): Decision => ({ ok: true, why: `${g.r} through ${g.g}`, grant: g });
  if (type === 'tenant') {
    const s = gr.filter((g) => g.scope === 'tenant');
    if (!s.length) return { ok: false, why: 'No tenant-wide grant' };
    const a = withPerm(s);
    return a.length ? ok(a[0]) : { ok: false, why: `Role does not include ${perm}` };
  }
  if (type === 'collection') {
    const ids = id === '*' ? COLLECTIONS[t] : [id];
    let last: Decision = { ok: false, why: 'No grant covers this collection' };
    for (const c of ids) {
      const s = gr.filter((g) => g.scope === 'tenant' || g.scope === `collection:${c}`);
      if (!s.length) continue;
      const a = withPerm(s);
      if (!a.length) { last = { ok: false, why: `Role does not include ${perm}` }; continue; }
      const b = blockedBy(t, `collection:${c}`, gs);
      if (b.length) { last = { ok: false, why: `Restricted by ${b.map((p) => p.n).join(', ')}` }; continue; }
      return ok(a[0]);
    }
    return last;
  }
  const s = gr.filter((g) => g.scope === 'tenant' || (g.scope === 'agents:*' && type === 'agent') || g.scope === `${type}:${id}` || (id === '*' && g.scope.startsWith(`${type}:`)));
  if (!s.length) return { ok: false, why: 'No grant covers this resource' };
  const a = withPerm(s);
  return a.length ? ok(a[0]) : { ok: false, why: `Role does not include ${perm}` };
}

const PLAT_CFG = ['tenant:configure', 'user:manage', 'grant:manage'];
const permType = (p: string): ResType => (p.startsWith('agent:') ? 'agent' : p.startsWith('collection:') || p === 'data:manage' ? 'collection' : 'tenant');

/** Can `uid` do `perm` on (type, id) in tenant `t`? Platform administrators may always configure tenants. */
export function can(uid: string, t: TenantKey, perm: string, type: ResType, id = '*'): boolean {
  const pa = platformAdmin(uid);
  if (pa?.role === 'Platform Administrator' && type === 'tenant' && PLAT_CFG.includes(perm)) return true;
  if (permType(perm) !== type && type !== 'tenant') return false;
  return evaluate(uid, t, perm, type, id).ok;
}

/** Comma-separated roles a user holds in a tenant (for the account menu). */
export function roleNamesIn(uid: string, t: TenantKey): string {
  const gs = groupsOf(uid, t);
  const rs = [...new Set(D().grants.filter((g) => g.t === t && gs.includes(g.g)).map((g) => g.r))];
  return rs.length ? rs.join(', ') : 'No access';
}

/** Everyone who can sign in: tenant users plus platform-only administrators. */
export const accounts = () => [...D().users.map((u) => ({ id: u.id, name: u.name })), ...D().padmins.filter((a) => !D().users.some((u) => u.id === a.id)).map((a) => ({ id: a.id, name: a.name }))];
export const tenantsOf = (uid: string): TenantKey[] => TENANT_KEYS.filter((t) => groupsOf(uid, t).length > 0);
