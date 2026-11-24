// Identity & access mocks: groups, roles, grants, tokens, per-user detail.
// Display names and numbers follow the design (design-ref/app.js `users`,
// `perms`, `signins`, `gcols`, `grows`, `roles`, `tokens`). The shape follows
// real KAP RBAC: groups → roles → grants (ALL in own tenant, or RESOURCE).
import { USERS } from './core';
import type { ConsoleUser } from '@/types';

export type RoleName = 'administrator' | 'analyst' | 'viewer';
export type ResourceKind = 'agent' | 'collection' | 'mcp_server';

export const PERMISSIONS = [
  'agents.read',
  'agents.run',
  'agents.write',
  'collections.read',
  'collections.write',
  'jobs.read',
  'jobs.cancel',
  'users.manage',
  'grants.manage',
  'tokens.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface Role {
  name: RoleName;
  grantsLabel: string;
  description: string;
  perms: Permission[];
}

export const ROLES: Role[] = [
  { name: 'administrator', grantsLabel: '3 grants', description: 'Full control of tenant resources, users, grants and tokens.', perms: [...PERMISSIONS] },
  { name: 'analyst', grantsLabel: '2 grants', description: 'Run agents, read jobs, traces and collections.', perms: ['agents.read', 'agents.run', 'collections.read', 'jobs.read'] },
  { name: 'viewer', grantsLabel: '1 grant', description: 'Read-only access to agents and job history.', perms: ['agents.read', 'collections.read', 'jobs.read'] },
];

export interface Group {
  name: string;
  description: string;
  membersLabel: string; // as shown in the grants matrix
  platform?: boolean;
  created: string;
}

export const GROUPS: Group[] = [
  { name: 'tenant_admins', description: 'SCEAI tenant administrators', membersLabel: '1 member', created: '58 d ago' },
  { name: 'catalog_readers', description: 'Analysts and services that read the catalogue and run indicator agents', membersLabel: '2 members', created: '58 d ago' },
  { name: 'ai_team', description: 'KAP AI team · platform operators with access to every project', membersLabel: '3 members · platform', platform: true, created: '61 d ago' },
];

export const groupMembers = (g: string): ConsoleUser[] => USERS.filter((u) => u.groups.includes(g));

/** Matrix columns (design `gcols`). */
export const GRANT_RESOURCES: { kind: ResourceKind; kindLabel: string; name: string }[] = [
  { kind: 'agent', kindLabel: 'Agent', name: 'sceai_indicators_agent' },
  { kind: 'agent', kindLabel: 'Agent', name: 'sceai_indicators_oxford' },
  { kind: 'collection', kindLabel: 'Collection', name: 'sceai_indicators' },
  { kind: 'mcp_server', kindLabel: 'MCP server', name: 'oxford_economics' },
];

/** Matrix rows (design `grows`): role per column, '' = no access. */
export const GRANT_MATRIX: { group: string; cells: (RoleName | '')[] }[] = [
  { group: 'tenant_admins', cells: ['administrator', 'administrator', 'administrator', 'administrator'] },
  { group: 'catalog_readers', cells: ['analyst', 'analyst', 'viewer', ''] },
  { group: 'ai_team', cells: ['administrator', 'administrator', 'administrator', 'administrator'] },
];

export interface Grant {
  id: string;
  group: string;
  role: RoleName;
  /** ALL = every resource of the granted types in the tenant; RESOURCE = one resource. */
  scope: 'ALL' | 'RESOURCE';
  kind?: ResourceKind;
  resource?: string;
  note: string;
}

export const GRANTS: Grant[] = [
  { id: 'G-101', group: 'tenant_admins', role: 'administrator', scope: 'ALL', note: 'All SCEAI resources · 15 resource types' },
  { id: 'G-102', group: 'ai_team', role: 'administrator', scope: 'ALL', note: 'All SCEAI resources · platform team' },
  { id: 'G-103', group: 'catalog_readers', role: 'analyst', scope: 'RESOURCE', kind: 'agent', resource: 'sceai_indicators_agent', note: 'Read and run' },
  { id: 'G-104', group: 'catalog_readers', role: 'analyst', scope: 'RESOURCE', kind: 'agent', resource: 'sceai_indicators_oxford', note: 'Read and run' },
  { id: 'G-105', group: 'catalog_readers', role: 'viewer', scope: 'RESOURCE', kind: 'collection', resource: 'sceai_indicators', note: 'Read' },
  { id: 'G-106', group: 'ai_team', role: 'administrator', scope: 'RESOURCE', kind: 'mcp_server', resource: 'oxford_economics', note: 'Manage the Oxford Economics connection' },
];

export interface ApiToken {
  name: string;
  owner: string;
  prefix: string;
  expires: string;
  lastUsed: string;
  status: 'approved' | 'hold' | 'rejected';
  statusLabel: string;
}

export const TOKENS: ApiToken[] = [
  { name: 'dashboards-svc', owner: 'api:dashboards-svc', prefix: 'kap_live_7Hq2…', expires: 'in 82 days', lastUsed: '1 min ago', status: 'approved', statusLabel: 'Active' },
  { name: 'powerbi-prod', owner: 'sceai_admin', prefix: 'kap_live_Rk8v…', expires: 'in 92 days', lastUsed: 'Never', status: 'approved', statusLabel: 'Active' },
  { name: 'etl-nightly', owner: 'sceai_admin', prefix: 'kap_live_c91X…', expires: 'in 9 days', lastUsed: '6 h ago', status: 'hold', statusLabel: 'Expires soon' },
  { name: 'powerbi-test', owner: 'sceai_admin', prefix: 'kap_live_Qe04…', expires: 'Expired 3 d ago', lastUsed: '12 d ago', status: 'rejected', statusLabel: 'Expired' },
];

/** The token just created (show-once card). Deliberately fake: this demo never holds a real secret. */
export const NEW_TOKEN = {
  name: 'powerbi-prod',
  owner: 'sceai_admin',
  expires: '19 Feb 2027 (92 days)',
  value: 'kap_pat_demo_••••••••••••••••••••••••',
};

// ---- Per-user detail -------------------------------------------------------

export interface EffectivePerm {
  perm: Permission;
  resource: string; // display
  /** Resource names this permission covers, or 'all' for an ALL grant. */
  covers: string[] | 'all';
  group: string;
  role: RoleName;
  grant: string; // grant id or a label
}

export interface SignIn {
  when: string;
  method: string;
  ip: string;
  status: 'approved' | 'rejected';
  label: string;
}

export interface UserDetail {
  user: ConsoleUser;
  id: string;
  created: string;
  memberships: { group: string; added: string }[];
  perms: EffectivePerm[];
  signins: SignIn[];
  tokens: ApiToken[];
}

const USER_IDS: Record<string, string> = {
  sceai_admin: '4e1c7a92-3b5d-4f08-9c2e-71a6d0b3f5e8',
  sceai_analyst: 'b72d0e41-9c3f-4e8b-a1d6-0e5c7f2b9d84',
  'm.alkuwari': 'c5a8e2f0-6d14-4b93-8e7a-2f9c0d1b4a63',
  'r.haddad': 'd9f3b6a1-0e27-4c58-b4d9-5a8e1c7f2b30',
  'j.thomas': 'e2b7c4d8-1f39-4a6e-9c05-8d3a6f0e1b97',
  'api:dashboards-svc': 'f8d1a3c6-7b42-4e90-a5f1-3c6e9b2d0a74',
};

const CREATED: Record<string, string> = {
  sceai_admin: '58 d ago by local_operator',
  sceai_analyst: '58 d ago by sceai_admin',
  'm.alkuwari': '61 d ago by platform setup',
  'r.haddad': '61 d ago by platform setup',
  'j.thomas': '44 d ago by m.alkuwari',
  'api:dashboards-svc': '9 d ago by sceai_admin',
};

const ADDED: Record<string, string> = {
  'sceai_admin/tenant_admins': 'Added 58 d ago by local_operator',
  'sceai_admin/catalog_readers': 'Added 52 d ago by sceai_admin',
  'sceai_analyst/catalog_readers': 'Added 40 d ago by sceai_admin',
  'api:dashboards-svc/catalog_readers': 'Added 9 d ago by sceai_admin',
  'm.alkuwari/ai_team': 'Added 61 d ago by platform setup',
  'r.haddad/ai_team': 'Added 61 d ago by platform setup',
  'j.thomas/ai_team': 'Added 44 d ago by m.alkuwari',
};

/** Analyst permissions exactly as the design lists them (`perms`). */
const analystPerms = (): EffectivePerm[] => [
  { perm: 'agents.run', resource: 'sceai_indicators_agent', covers: ['sceai_indicators_agent'], group: 'catalog_readers', role: 'analyst', grant: 'G-103' },
  { perm: 'agents.run', resource: 'sceai_indicators_oxford', covers: ['sceai_indicators_oxford'], group: 'catalog_readers', role: 'analyst', grant: 'G-104' },
  { perm: 'jobs.read', resource: 'Own jobs and traces', covers: ['sceai_indicators_agent', 'sceai_indicators_oxford'], group: 'catalog_readers', role: 'analyst', grant: 'G-104' },
  { perm: 'collections.read', resource: 'sceai_indicators', covers: ['sceai_indicators'], group: 'catalog_readers', role: 'viewer', grant: 'G-105' },
];

const ADMIN_SCOPE: [Permission, string][] = [
  ['agents.read', 'All agents'],
  ['agents.run', 'All agents'],
  ['agents.write', 'All agents'],
  ['collections.read', 'All collections'],
  ['collections.write', 'All collections'],
  ['jobs.read', 'All jobs and traces'],
  ['jobs.cancel', 'All jobs'],
  ['users.manage', 'Users and groups'],
  ['grants.manage', 'Access grants'],
  ['tokens.manage', 'API tokens'],
];

const adminPerms = (group: string, grant: string): EffectivePerm[] => ADMIN_SCOPE.map(([perm, resource]) => ({ perm, resource, covers: 'all', group, role: 'administrator', grant }));

const viewerPerms = (group: string): EffectivePerm[] => [
  { perm: 'agents.read', resource: 'All agents', covers: 'all', group, role: 'viewer', grant: 'platform role' },
  { perm: 'collections.read', resource: 'All collections', covers: 'all', group, role: 'viewer', grant: 'platform role' },
  { perm: 'jobs.read', resource: 'Job history', covers: 'all', group, role: 'viewer', grant: 'platform role' },
];

export function permsFor(u: ConsoleUser): EffectivePerm[] {
  if (u.role === 'administrator') {
    const g = u.groups.includes('tenant_admins') ? 'tenant_admins' : u.groups[0];
    return adminPerms(g, g === 'tenant_admins' ? 'G-101' : 'G-102');
  }
  if (u.role === 'analyst') return analystPerms();
  return viewerPerms(u.groups[0]);
}

const ANALYST_SIGNINS: SignIn[] = [
  { when: '19 Nov 2026 · 10:38', method: 'QDI', ip: '10.12.4.21 · Doha', status: 'approved', label: 'Success' },
  { when: '18 Nov 2026 · 08:02', method: 'QDI', ip: '10.12.4.21 · Doha', status: 'approved', label: 'Success' },
  { when: '17 Nov 2026 · 17:45', method: 'QDI', ip: '10.12.7.3 · Doha', status: 'rejected', label: 'Denied' },
];

function signinsFor(u: ConsoleUser): SignIn[] {
  if (u.username === 'sceai_analyst') return ANALYST_SIGNINS;
  const method = u.kind === 'service' ? 'Token' : u.auth.startsWith('QDI') ? 'QDI' : 'SSO';
  const ip = u.kind === 'service' ? '10.12.9.40 · dashboards' : u.auth.startsWith('QDI') ? '10.12.4.18 · Doha' : '10.40.2.11 · KAP VPN';
  const times: Record<string, string[]> = {
    sceai_admin: ['19 Nov 2026 · 13:55', '18 Nov 2026 · 09:12', '17 Nov 2026 · 08:40'],
    'm.alkuwari': ['19 Nov 2026 · 14:12', '19 Nov 2026 · 08:05', '18 Nov 2026 · 08:31'],
    'r.haddad': ['19 Nov 2026 · 12:20', '18 Nov 2026 · 10:47', '17 Nov 2026 · 09:03'],
    'j.thomas': ['16 Nov 2026 · 11:26', '13 Nov 2026 · 15:09', '12 Nov 2026 · 09:44'],
    'api:dashboards-svc': ['19 Nov 2026 · 14:19', '19 Nov 2026 · 14:04', '19 Nov 2026 · 13:49'],
  };
  return (times[u.username] ?? []).map((when) => ({ when, method, ip, status: 'approved', label: 'Success' }));
}

export function userDetail(u: ConsoleUser): UserDetail {
  return {
    user: u,
    id: USER_IDS[u.username] ?? '00000000-0000-4000-8000-000000000000',
    created: CREATED[u.username] ?? '—',
    memberships: u.groups.map((g) => ({ group: g, added: ADDED[`${u.username}/${g}`] ?? 'Added by sceai_admin' })),
    perms: permsFor(u),
    signins: signinsFor(u),
    tokens: TOKENS.filter((t) => t.owner === u.username),
  };
}

export const roleTone = (r: string) => (r === 'administrator' ? 'brand' : r === 'analyst' ? 'info' : 'neutral') as 'brand' | 'info' | 'neutral';
