/**
 * KAP identity & access records → the live sandbox screens of User & Permission
 * Management, and the request bodies for KAP writes. Pure; tested with
 * fixtures shaped from KAP's OpenAPI (UserSummary, UserDetails, GroupOut,
 * AccessGrantOut, RoleOut, PermissionOut) and the developer guide (OAuth
 * clients, scenario 5.1).
 *
 * What KAP has: users and service accounts (username, description, flags,
 * active), groups (name, description, active), memberships (only through
 * `UserDetails.groups`), roles with permissions, and group grants
 * (role × resource type × ALL/RESOURCE). What it has not: e-mail, display
 * name, sign-in times, a list of a group's grants (grants can be created and
 * revoked, not listed), access policies, platform administrators.
 */

// ------------------------------------------------------------------ KAP shapes
export type KapPrincipalType = 'user' | 'service_account';
export type KapGrantScope = 'ALL' | 'RESOURCE';

export interface KapUserSummary {
  id: string;
  username: string;
  account_type: KapPrincipalType;
  description: string | null;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface KapUserDetails extends KapUserSummary {
  groups?: { id: string; name: string; description?: string | null; is_active?: boolean }[];
  effective_roles?: Partial<KapRole>[];
  deactivated_at?: string | null;
}
export interface KapGroup { id: string; name: string; description: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface KapPermission { id: string; code: string; resource_type: string; action: string }
export interface KapRole { id: string; code: string; name: string; description: string | null; is_system: boolean; permissions: KapPermission[]; created_at: string; updated_at: string }
export interface KapGrant { id: string; group_id: string; role_id: string; resource_type: string; scope: KapGrantScope; resource_id: string | null; created_at: string; updated_at?: string }
/** OAuth client of a service account (developer guide 5.1 / 6.3; not in the published OpenAPI). */
export interface KapOauthClient { id: string; user_id: string; client_id: string; label?: string | null; status: string; expires_at?: string | null; client_secret?: string; created_at: string; last_used_at?: string | null }

// ------------------------------------------------------------------ screen types
export interface LiveUser {
  /** KAP uuid */
  id: string;
  /** username: the console's user id in routes */
  n: string;
  d: string;
  type: KapPrincipalType;
  active: boolean;
  staff: boolean;
  superuser: boolean;
  created: string;
  updated: string;
  deactivated: string;
  /** group uuids (from UserDetails; empty when details could not be read) */
  groups: string[];
  /** effective role codes */
  roles: string[];
  /** details were read (groups and roles are known) */
  detailed: boolean;
}
export interface LiveGroup { id: string; n: string; d: string; active: boolean; created: string; members: string[] }
export interface LiveRole { id: string; code: string; n: string; d: string; sys: boolean; perms: string[] }
export interface LivePerm { code: string; rt: string; action: string }
export interface LiveGrant { id: string; gid: string; roleId: string; rt: string; scope: KapGrantScope; rid: string | null; created: string }
export interface LiveCred { id: string; uid: string; clientId: string; label: string; st: string; exp: string; created: string; last: string }
export interface LiveRes { rt: string; id: string; n: string }

export interface LiveIam {
  users: LiveUser[];
  groups: LiveGroup[];
  roles: LiveRole[];
  perms: LivePerm[];
  /** grants made from this console (KAP has no list operation for grants) */
  grants: LiveGrant[];
  /** named resources for RESOURCE-scoped grants (agents, collections, pipelines, connectors) */
  res: LiveRes[];
  /** OAuth clients; null when KAP or the platform does not expose them */
  creds: LiveCred[] | null;
  credsWhy: string;
  /** KAP id of the account the platform calls KAP with (GET /api/users/me), '' when unknown */
  me: string;
}

export const emptyLive = (): LiveIam => ({ users: [], groups: [], roles: [], perms: [], grants: [], res: [], creds: null, credsWhy: '', me: '' });

// ------------------------------------------------------------------ time
/** "12 May 2026, 14:05" (UTC) for an ISO time; '—' when absent. */
export function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// ------------------------------------------------------------------ mapping
export function toUser(s: KapUserSummary, det?: KapUserDetails | null): LiveUser {
  return {
    id: s.id,
    n: s.username,
    d: s.description ?? '',
    type: s.account_type === 'service_account' ? 'service_account' : 'user',
    active: (det ?? s).is_active,
    staff: !!s.is_staff,
    superuser: !!s.is_superuser,
    created: when(s.created_at),
    updated: when(s.updated_at),
    deactivated: when(det?.deactivated_at),
    groups: (det?.groups ?? []).map((g) => g.id),
    roles: [...new Set((det?.effective_roles ?? []).map((r) => r.code ?? r.name ?? '').filter(Boolean))],
    detailed: !!det,
  };
}

export function toGroup(g: KapGroup, users: LiveUser[]): LiveGroup {
  return { id: g.id, n: g.name, d: g.description ?? '', active: g.is_active, created: when(g.created_at), members: users.filter((u) => u.groups.includes(g.id)).map((u) => u.id) };
}

export const toRole = (r: KapRole): LiveRole => ({ id: r.id, code: r.code, n: r.name || r.code, d: r.description ?? '', sys: r.is_system, perms: (r.permissions ?? []).map((p) => p.code) });
export const toPerm = (p: KapPermission): LivePerm => ({ code: p.code, rt: p.resource_type, action: p.action });
export const toGrant = (g: KapGrant): LiveGrant => ({ id: g.id, gid: g.group_id, roleId: g.role_id, rt: g.resource_type, scope: g.scope, rid: g.resource_id, created: when(g.created_at) });

export function toCred(o: KapOauthClient): LiveCred {
  const st = o.status ? o.status[0].toUpperCase() + o.status.slice(1) : '—';
  return { id: o.id, uid: o.user_id, clientId: o.client_id, label: o.label ?? '', st, exp: o.expires_at ? when(o.expires_at) : 'Never', created: when(o.created_at), last: when(o.last_used_at) };
}

/** Assemble the live state from KAP lists (grants made earlier in the session are kept). */
export function toLive(a: { users: KapUserSummary[]; details: Record<string, KapUserDetails | null>; groups: KapGroup[]; roles: KapRole[]; perms: KapPermission[]; res: LiveRes[]; creds: KapOauthClient[] | null; credsWhy?: string; me?: string }, prevGrants: LiveGrant[] = []): LiveIam {
  const users = a.users.map((u) => toUser(u, a.details[u.id]));
  const groups = a.groups.map((g) => toGroup(g, users));
  return {
    users,
    groups,
    roles: a.roles.map(toRole),
    perms: a.perms.map(toPerm),
    grants: prevGrants.filter((g) => groups.some((x) => x.id === g.gid)),
    res: a.res,
    creds: a.creds ? a.creds.map(toCred) : null,
    credsWhy: a.credsWhy ?? '',
    me: a.me ?? '',
  };
}

// ------------------------------------------------------------------ labels
export const roleName = (L: Pick<LiveIam, 'roles'>, id: string) => L.roles.find((r) => r.id === id)?.n ?? id;
export const groupName = (L: Pick<LiveIam, 'groups'>, id: string) => L.groups.find((g) => g.id === id)?.n ?? id;

/** Resource types KAP accepts only with scope ALL. */
export const META_TYPES = ['audit', 'rbac', 'user'];

/** "All agents" · "agent · Indicators agent" */
export function scopeLabel(L: Pick<LiveIam, 'res'>, g: Pick<LiveGrant, 'rt' | 'scope' | 'rid'>): string {
  if (g.scope === 'ALL' || !g.rid) return `All · ${g.rt}`;
  const r = L.res.find((x) => x.rt === g.rt && x.id === g.rid);
  return `${g.rt} · ${r ? r.n : g.rid}`;
}

/** Scope choices for a grant: every resource type (ALL), then each named resource (RESOURCE). */
export function scopeOptions(L: Pick<LiveIam, 'perms' | 'res'>): string[] {
  const types = [...new Set([...L.perms.map((p) => p.rt), ...L.res.map((r) => r.rt)])].sort();
  return [...types.map((t) => `All · ${t}`), ...L.res.filter((r) => !META_TYPES.includes(r.rt)).map((r) => `${r.rt} · ${r.n}`)];
}

/** Parse a scope choice back into KAP's (resource_type, scope, resource_id). */
export function parseScope(L: Pick<LiveIam, 'res'>, label: string): { rt: string; scope: KapGrantScope; rid: string | null } | null {
  const i = label.indexOf(' · ');
  if (i < 0) return null;
  const a = label.slice(0, i);
  const b = label.slice(i + 3);
  if (a === 'All') return { rt: b, scope: 'ALL', rid: null };
  const r = L.res.find((x) => x.rt === a && x.n === b);
  return r ? { rt: a, scope: 'RESOURCE', rid: r.id } : null;
}

// ------------------------------------------------------------------ bodies
export interface UserCreateIn { username: string; type: KapPrincipalType; description?: string; password?: string; groupIds?: string[] }

/** POST /api/users (UserCreate). Service accounts never carry a password. */
export function toKapUserCreate(v: UserCreateIn) {
  const body: Record<string, unknown> = { username: v.username.trim(), account_type: v.type, is_staff: false, is_superuser: false, group_ids: v.groupIds ?? [] };
  const d = v.description?.trim();
  if (d) body.description = d;
  if (v.type === 'user' && v.password) body.password = v.password;
  return body;
}

/** PATCH /api/users/{id} (UserUpdate): only the changed attributes. */
export function toKapUserPatch(u: Pick<LiveUser, 'd' | 'active'>, next: { description?: string; active?: boolean }) {
  const body: Record<string, unknown> = {};
  if (next.description !== undefined && next.description.trim() !== u.d) body.description = next.description.trim() || null;
  if (next.active !== undefined && next.active !== u.active) body.is_active = next.active;
  return body;
}

/** POST /api/groups (CreateGroupIn). */
export function toKapGroupCreate(name: string, description?: string) {
  const d = description?.trim();
  return d ? { name: name.trim(), description: d } : { name: name.trim() };
}

/** PATCH /api/groups/{id} (UpdateGroupIn): only the changed fields. */
export function toKapGroupPatch(g: Pick<LiveGroup, 'n' | 'd' | 'active'>, next: { name?: string; description?: string; active?: boolean }) {
  const body: Record<string, unknown> = {};
  if (next.name !== undefined && next.name.trim() !== g.n) body.name = next.name.trim();
  if (next.description !== undefined && next.description.trim() !== g.d) body.description = next.description.trim() || null;
  if (next.active !== undefined && next.active !== g.active) body.is_active = next.active;
  return body;
}

/** POST /api/groups/{id}/users (AddMemberIn). */
export const toKapMember = (userId: string) => ({ user_id: userId });

/** POST /api/groups/{id}/access-grants (CreateAccessGrantIn). RESOURCE needs a resource id; ALL must not carry one. */
export function toKapGrant(roleId: string, s: { rt: string; scope: KapGrantScope; rid: string | null }) {
  if (s.scope === 'RESOURCE') {
    if (!s.rid) throw new Error('A resource-scoped grant needs a resource.');
    if (META_TYPES.includes(s.rt)) throw new Error(`${s.rt} accepts only grants on all resources.`);
    return { role_id: roleId, resource_type: s.rt, scope: 'RESOURCE' as const, resource_id: s.rid };
  }
  return { role_id: roleId, resource_type: s.rt, scope: 'ALL' as const };
}

/** POST /api/oauth-clients (developer guide 5.1, step 2). `expires_at` optional. */
export function toKapOauthClient(userId: string, label: string, expiresAt?: string | null) {
  const body: Record<string, unknown> = { user_id: userId, label: label.trim() };
  if (expiresAt) body.expires_at = expiresAt;
  return body;
}

/** ISO time `days` from `now`. */
export const inDays = (days: number, now = Date.now()) => new Date(now + days * 86_400_000).toISOString();
