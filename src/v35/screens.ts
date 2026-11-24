/**
 * v35 information architecture: navigation groups, screens, paths and the
 * permissions that open each screen (prototype: renderVals nav + SP map).
 * A screen opens when ANY listed permission holds on at least one resource.
 */
import {
  Activity, Award, Bot, FlaskConical, Building2, CalendarClock, Cable, Cpu, Database, FileText, Fingerprint, Gauge, History,
  Key, KeyRound, LayoutDashboard, ListChecks, LockKeyhole, Plug, ScrollText, Settings, Shapes, Shield, ShieldCheck,
  Table2, ThumbsDown, User, Users, Workflow, type LucideIcon,
} from 'lucide-react';
import { can, canPlatform, groupsOf, platformAdmin, type ResType, type TenantKey } from './iam';

export interface ScreenDef {
  key: string;
  label: string;
  icon: LucideIcon;
  /** path relative to /p/:tenant or /platform ('' = landing) */
  path: string;
  perms?: [string, ResType, string?][];
  /** platform permission required (platform screens) */
  pperm?: string;
}
export interface NavGroup { label: string; items: ScreenDef[] }

const S = (key: string, label: string, icon: LucideIcon, path: string, perms?: ScreenDef['perms']): ScreenDef => ({ key, label, icon, path, perms });

export const TENANT_NAV: NavGroup[] = [
  { label: 'Overview', items: [S('home', 'Dashboard', LayoutDashboard, '', [['agent:read', 'agent'], ['collection:read', 'collection']])] },
  {
    label: 'Data Ingestion Hub',
    items: [
      S('iSources', 'Data Sources', Cable, 'sources', [['data:manage', 'collection']]),
      S('iPipes', 'Ingestion Pipelines', Workflow, 'pipelines', [['data:manage', 'collection'], ['pipeline:execute', 'tenant']]),
      S('iRuns', 'Ingestion Runs', ListChecks, 'runs', [['data:manage', 'collection'], ['pipeline:execute', 'tenant']]),
    ],
  },
  {
    label: 'Business Data Hub',
    items: [
      S('collections', 'Collections', Database, 'collections', [['collection:read', 'collection'], ['data:manage', 'collection']]),
      S('sData', 'Structured Data', Table2, 'structured', [['collection:read', 'collection'], ['data:manage', 'collection']]),
      S('uData', 'Unstructured Data', FileText, 'unstructured', [['collection:read', 'collection'], ['data:manage', 'collection']]),
      S('entities', 'Business Entities', Shapes, 'entities', [['collection:read', 'collection']]),
    ],
  },
  {
    label: 'AI Agent Factory',
    items: [
      S('agents', 'Agents', Bot, 'agents', [['agent:read', 'agent']]),
      S('playground', 'Playground', FlaskConical, 'playground', [['agent:execute', 'agent']]),
      S('workflows', 'Agent Workflows', Workflow, 'workflows', [['agent:read', 'agent']]),
      S('tools', 'AI Agent Tools', Plug, 'tools', [['tool:grant', 'tenant'], ['agent:update', 'agent'], ['tenant:configure', 'tenant'], ['agent:oversee', 'agent']]),
      S('schedules', 'Schedules & Events', CalendarClock, 'schedules', [['agent:execute', 'agent'], ['tenant:configure', 'tenant']]),
      S('jobs', 'Monitoring & Insights', Activity, 'monitoring', [['agent:read', 'agent']]),
    ],
  },
  { label: 'AI Governance', items: [S('policies', 'Policy Library', ScrollText, 'policies', [['tenant:configure', 'tenant'], ['agent:oversee', 'agent']])] },
  {
    label: 'AI Confidence Hub',
    items: [
      S('confov', 'Overview', Gauge, 'confidence', [['agent:read', 'agent'], ['agent:oversee', 'agent']]),
      S('evidence', 'Answer Evidence', ShieldCheck, 'evidence', [['agent:read', 'agent'], ['agent:oversee', 'agent']]),
      S('feedback', 'Feedback', ThumbsDown, 'feedback', [['agent:update', 'agent'], ['agent:oversee', 'agent']]),
    ],
  },
  {
    label: 'User & Permission Management',
    items: [
      S('users', 'Users', User, 'users', [['user:manage', 'tenant']]),
      S('groups', 'Groups', Users, 'groups', [['user:manage', 'tenant'], ['grant:manage', 'tenant']]),
      S('roles', 'Roles & Permissions', Shield, 'roles', [['grant:manage', 'tenant']]),
      S('tokens', 'Service Accounts', Key, 'service-accounts', [['tenant:configure', 'tenant']]),
    ],
  },
  {
    label: 'Tenant Administration',
    items: [
      S('tConfig', 'Tenant Configuration', Settings, 'configuration', [['tenant:configure', 'tenant']]),
      S('audit', 'Unified Audit Log', History, 'audit', [['tenant:configure', 'tenant']]),
      S('tSec', 'Security & Credentials', LockKeyhole, 'security', [['tenant:configure', 'tenant']]),
    ],
  },
];

const P = (key: string, label: string, icon: LucideIcon, path: string, pperm = 'platform:read'): ScreenDef => ({ key, label, icon, path, pperm });

export const PLATFORM_NAV: NavGroup[] = [
  { label: 'Overview & Tenancy', items: [P('pHome', 'Platform Overview', LayoutDashboard, ''), P('tenants', 'Tenants', Building2, 'tenants')] },
  { label: 'Data Processing Engines', items: [P('pModels', 'Model Providers Registry', Cpu, 'models')] },
  { label: 'AI Agent Factory', items: [P('pMcp', 'MCP Registry', Plug, 'mcp')] },
  { label: 'User & Permission Management', items: [P('pUsers', 'Platform Administrators', Shield, 'admins'), P('pIdp', 'Identity Provider Configuration', Fingerprint, 'identity')] },
  {
    label: 'Platform Administration',
    items: [
      P('pConfig', 'Platform Configuration', Settings, 'configuration', 'config:read'),
      P('pMon', 'Monitoring & Alerts', Activity, 'monitoring', 'monitor:read'),
      P('pAudit', 'Unified Audit Log', History, 'audit', 'audit:read'),
      P('pKeys', 'Secrets & Keys', KeyRound, 'secrets', 'security:read'),
      P('pLic', 'License Management', Award, 'licenses', 'license:read'),
    ],
  },
];

export const ALL_TENANT_SCREENS = TENANT_NAV.flatMap((g) => g.items);
export const ALL_PLATFORM_SCREENS = PLATFORM_NAV.flatMap((g) => g.items);

const MEMBER_ONLY = new Set(['tools', 'schedules']);

/** May `uid` open tenant screen `s` in tenant `t`? */
export function allowedTenant(uid: string, t: TenantKey, s: ScreenDef): boolean {
  // platform administrators configure a tenant, but its agent tooling and schedules are for its members
  if (MEMBER_ONLY.has(s.key) && platformAdmin(uid) && !groupsOf(uid, t).length) return false;
  if (t === 'default') return s.key === 'home' ? can(uid, t, 'tenant:configure', 'tenant') : (s.perms ?? [['tenant:configure', 'tenant']]).some(([p, ty, id]) => can(uid, t, p, ty, id));
  return (s.perms ?? [['tenant:configure', 'tenant']]).some(([p, ty, id]) => can(uid, t, p, ty, id));
}

export function allowedPlatform(uid: string, s: ScreenDef): boolean {
  return !!platformAdmin(uid) && canPlatform(uid, s.pperm ?? 'platform:read');
}

/** First screen the user may open in a tenant (prototype ORDER). */
const ORDER = ['home', 'agents', 'workflows', 'tools', 'jobs', 'schedules', 'collections', 'sData', 'uData', 'entities', 'iSources', 'iPipes', 'iRuns', 'policies', 'confov', 'evidence', 'feedback', 'users', 'groups', 'roles', 'tokens', 'tConfig', 'audit', 'tSec'];
export function landingFor(uid: string, t: TenantKey): ScreenDef | null {
  for (const k of ORDER) {
    const s = ALL_TENANT_SCREENS.find((x) => x.key === k);
    if (s && allowedTenant(uid, t, s)) return s;
  }
  return null;
}

/** Screen for a path segment (first segment after /p/:tenant/). */
export const tenantScreenByPath = (seg: string) => ALL_TENANT_SCREENS.find((s) => s.path === seg);
export const platformScreenByPath = (seg: string) => ALL_PLATFORM_SCREENS.find((s) => s.path === seg);
export const groupOf = (nav: NavGroup[], key: string) => nav.find((g) => g.items.some((i) => i.key === key))?.label;
