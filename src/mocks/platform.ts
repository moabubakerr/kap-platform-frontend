// KAP platform scope (AI team): overview, projects, shared services.
// Numbers and copy follow design-ref/app.js `more()` (plProj, plSvc, plMulti,
// tenants, provision) and the generic tables (pModels, pMcp, pQueues, pUsers, pAudit).
import type { Status } from '@/components/ui/status-pill';

export type PlatformRoute = 'models' | 'queues' | 'mcp' | 'users' | 'audit';
export type PlatformIcon = 'cpu' | 'layers' | 'plug' | 'shield' | 'history';

export interface PlatformProjectCard {
  initials: string;
  name: string;
  desc: string;
  health: string;
  healthFg: string;
  healthBg: string;
  metrics: { v: string; k: string }[];
  queue: string;
  queuePct: number;
  iconBg: string;
  iconFg: string;
  accent: string;
  projectKey?: string;
}

export interface PlatformService {
  name: string;
  metric: string;
  metricLabel: string;
  status: 'Healthy' | 'Busy' | 'Degraded';
  detail: string;
  icon: PlatformIcon;
  go: PlatformRoute;
}

export interface PlatformRequestSeries {
  name: string;
  color: string;
  values: number[];
  delta: string;
  deltaFg: string;
  deltaBg: string;
  share: string;
  projectKey?: string;
}

export interface PlatformOverviewData {
  subtitle: string;
  projects: PlatformProjectCard[];
  services: PlatformService[];
  requests: { total: string; delta: string; range: string; days: string[]; series: PlatformRequestSeries[] };
}

export const PLATFORM_OVERVIEW: PlatformOverviewData = {
  subtitle: '4 projects on shared infrastructure · 2 services need attention',
  projects: [
    { initials: 'SC', name: 'SCEAI', desc: 'Economic Affairs and Investment', health: 'Busy', healthFg: 'var(--warning)', healthBg: 'var(--warning-bg)', metrics: [{ v: '8', k: 'agents' }, { v: '558', k: 'requests' }, { v: '84.8%', k: 'success' }], queue: '3 / 3', queuePct: 100, iconBg: '#F6E8EC', iconFg: '#8A1538', accent: '#8A1538', projectKey: 'sceai' },
    { initials: 'EA', name: 'Economic Affairs', desc: 'Directorate analytics', health: 'Healthy', healthFg: 'var(--success-fg)', healthBg: 'var(--success-bg)', metrics: [{ v: '2', k: 'agents' }, { v: '412', k: 'requests' }, { v: '91.0%', k: 'success' }], queue: '1 / 3', queuePct: 33, iconBg: 'var(--sand-tint)', iconFg: 'var(--sand-ink)', accent: '#C8B49A' },
    { initials: 'SB', name: 'sandbox', desc: 'AI team experiments', health: 'Degraded', healthFg: 'var(--warning-fg)', healthBg: 'var(--warning-bg)', metrics: [{ v: '4', k: 'agents' }, { v: '270', k: 'requests' }, { v: '78.4%', k: 'success' }], queue: '2 / 4', queuePct: 50, iconBg: 'var(--teal-tint)', iconFg: '#0F766E', accent: '#0F766E' },
    { initials: 'DF', name: 'Default', desc: 'System project · defaults', health: 'Healthy', healthFg: 'var(--success-fg)', healthBg: 'var(--success-bg)', metrics: [{ v: '0', k: 'agents' }, { v: '0', k: 'requests' }, { v: '—', k: 'success' }], queue: '0 / 0', queuePct: 0, iconBg: 'var(--surface-sunken)', iconFg: 'var(--text-body)', accent: '#A8A0A3', projectKey: 'default' },
  ],
  services: [
    { name: 'Model serving', metric: '62%', metricLabel: 'capacity', status: 'Healthy', detail: '6 models · 4 GPUs', icon: 'cpu', go: 'models' },
    { name: 'Queues & workers', metric: '8/10', metricLabel: 'workers busy', status: 'Busy', detail: 'SCEAI at limit', icon: 'layers', go: 'queues' },
    { name: 'MCP registry', metric: '16%', metricLabel: 'Oxford errors', status: 'Degraded', detail: 'p95 2.6 s', icon: 'plug', go: 'mcp' },
    { name: 'Identity', metric: '23', metricLabel: 'active users', status: 'Healthy', detail: 'QDI sign-in', icon: 'shield', go: 'users' },
    { name: 'Audit', metric: '1,982', metricLabel: 'events · 7 d', status: 'Healthy', detail: 'retention 1 y', icon: 'history', go: 'audit' },
  ],
  requests: {
    total: '1,240',
    delta: '+14% on last week',
    range: '13 – 19 Nov 2026 · dashed line is the daily average',
    days: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'],
    series: [
      { name: 'SCEAI', color: '#8A1538', values: [64, 67, 50, 75, 82, 88, 82], delta: '+21%', deltaFg: 'var(--success-fg)', deltaBg: 'var(--success-bg)', share: '45%', projectKey: 'sceai' },
      { name: 'Economic Affairs', color: '#C8B49A', values: [55, 61, 48, 60, 63, 66, 59], delta: '+6%', deltaFg: 'var(--success-fg)', deltaBg: 'var(--success-bg)', share: '36%' },
      { name: 'sandbox', color: '#0F766E', values: [30, 42, 26, 38, 44, 51, 39], delta: '−4%', deltaFg: 'var(--text-muted)', deltaBg: 'var(--surface-sunken)', share: '19%' },
    ],
  },
};

export interface ProjectsPageData {
  projects: { name: string; desc: string; users: string; agents: string; collections: string; jobsToday: string; status: Status; statusLabel: string; projectKey?: string; current?: boolean }[];
  lastProvisioned: { project: string; note: string; steps: string[] };
}

export const PROJECTS_PAGE: ProjectsPageData = {
  projects: [
    { name: 'SCEAI', desc: 'Supreme Council for Economic Affairs and Investment', users: '14', agents: '8', collections: '1', jobsToday: '14', status: 'healthy', statusLabel: 'Healthy', projectKey: 'sceai', current: true },
    { name: 'Economic Affairs', desc: 'Economic Affairs directorate', users: '9', agents: '2', collections: '2', jobsToday: '31', status: 'healthy', statusLabel: 'Healthy' },
    { name: 'sandbox', desc: 'AI team sandbox · public + confidential', users: '6', agents: '4', collections: '3', jobsToday: '12', status: 'degraded', statusLabel: 'Degraded' },
    { name: 'Default', desc: 'System project', users: '3', agents: '0', collections: '0', jobsToday: '0', status: 'healthy', statusLabel: 'Healthy', projectKey: 'default' },
  ],
  lastProvisioned: {
    project: 'sandbox',
    note: 'Create project wizard · completed 31 d ago',
    steps: [
      'Tenant record sandbox created',
      'Queue policy kap.agent · max in-flight 4',
      'Queue policy kap.pipeline · max in-flight 2',
      'Default model providers linked',
      'Groups tenant_admins and catalog_readers created',
      'Admin user sbx_admin invited via QDI',
    ],
  },
};

// ---- Generic platform tables ----

/** A cell: plain text, or [text, 'm'] for mono. `to` makes the row navigate. */
export type GenCell = string | [string, 'm'];
export interface GenRow {
  cells: GenCell[];
  status: Status;
  statusLabel: string;
  to?: string;
}
export interface GenTable {
  title: string;
  desc: string;
  button: string;
  cols: string[];
  rows: GenRow[];
}

export const PLATFORM_MODELS: GenTable = {
  title: 'Model serving',
  desc: 'Models served by the KAP platform. Projects reference them through their own provider aliases.',
  button: 'Add model',
  cols: ['Model', 'Kind', 'Served on', 'Used by projects', 'Load'],
  rows: [
    { cells: [['Qwen2.5-72B-Instruct', 'm'], 'Chat · tool calling', 'gpu-01, gpu-02', 'SCEAI (Ask AI)', '38 req/min'], status: 'approved', statusLabel: 'Healthy', to: '/p/sceai/providers' },
    { cells: [['Qwen2.5-32B-Instruct', 'm'], 'Chat · tool calling', 'gpu-03', 'SCEAI, Economic Affairs, sandbox', '24 req/min'], status: 'approved', statusLabel: 'Healthy', to: '/p/sceai/providers' },
    { cells: [['Qwen2.5-14B-Instruct', 'm'], 'Chat', 'gpu-04', 'All projects', '6 req/min'], status: 'approved', statusLabel: 'Healthy', to: '/p/sceai/providers' },
    { cells: [['Qwen2.5-7B-Instruct', 'm'], 'Chat · router', 'gpu-04', 'SCEAI (Ask AI)', '52 req/min'], status: 'approved', statusLabel: 'Healthy', to: '/p/sceai/providers' },
    { cells: [['qwen3-embedding', 'm'], 'Embedding · 1024-d', 'gpu-04', 'All projects', '12 req/min'], status: 'approved', statusLabel: 'Healthy', to: '/p/sceai/providers' },
    { cells: [['BAAI/bge-m3', 'm'], 'Embedding', 'gpu-04', 'SCEAI (Ask AI)', '71 req/min'], status: 'approved', statusLabel: 'Healthy', to: '/p/sceai/providers' },
  ],
};

export const PLATFORM_MCP: GenTable = {
  title: 'MCP registry',
  desc: 'External tool servers registered on the platform. Projects opt in per agent.',
  button: 'Register server',
  cols: ['Server', 'URL', 'Tools', 'Enabled in projects', 'p95'],
  rows: [{ cells: [['oxford_economics', 'm'], ['services.oxfordeconomics.com/mcp', 'm'], '2', 'SCEAI', '2.6 s'], status: 'hold', statusLabel: 'Degraded', to: '/p/sceai/mcp' }],
};

export const PLATFORM_QUEUES: GenTable = {
  title: 'Queues & workers',
  desc: 'Shared job queues. Each project gets its own in-flight limit on top of platform capacity.',
  button: 'Scale workers',
  cols: ['Queue', 'Workers', 'In flight', 'Waiting', 'Busiest project'],
  rows: [
    { cells: [['kap.agent', 'm'], '8', '6', '1', 'SCEAI · 3 / 3'], status: 'hold', statusLabel: 'Busy', to: '/p/sceai/jobs' },
    { cells: [['kap.pipeline', 'm'], '2', '1', '0', 'sandbox · 1 / 2'], status: 'approved', statusLabel: 'Healthy', to: '/p/sceai/ingestion' },
  ],
};

export const PLATFORM_USERS: GenTable = {
  title: 'AI team & admins',
  desc: 'Platform-level users. They can see every project; project admins only see their own.',
  button: 'Invite admin',
  cols: ['User', 'Name', 'Platform role', 'Projects', 'Last sign-in'],
  rows: [
    { cells: [['m.alkuwari', 'm'], 'Mariam Al-Kuwari', 'platform administrator', 'All', '8 min ago'], status: 'approved', statusLabel: 'Active', to: '/p/sceai/users/m.alkuwari' },
    { cells: [['r.haddad', 'm'], 'Rami Haddad', 'platform administrator', 'All', '2 h ago'], status: 'approved', statusLabel: 'Active', to: '/p/sceai/users/r.haddad' },
    { cells: [['j.thomas', 'm'], 'Julia Thomas', 'platform viewer', 'All', '3 d ago'], status: 'approved', statusLabel: 'Active', to: '/p/sceai/users/j.thomas' },
  ],
};

export const PLATFORM_AUDIT: GenTable = {
  title: 'Platform audit',
  desc: 'Platform-level changes. Project changes are in each project’s own audit log.',
  button: 'Export',
  cols: ['When', 'Who', 'Action', 'Scope'],
  rows: [
    { cells: ['3 h ago', ['m.alkuwari', 'm'], 'Returned gpu-03 to the model pool', 'Model serving'], status: 'approved', statusLabel: 'Applied', to: '/platform/models' },
    { cells: ['2 d ago', ['r.haddad', 'm'], 'Raised kap.agent workers 6 → 8', 'Queues'], status: 'approved', statusLabel: 'Applied', to: '/platform/queues' },
    { cells: ['31 d ago', ['m.alkuwari', 'm'], 'Created project sandbox', 'Projects'], status: 'approved', statusLabel: 'Applied', to: '/platform/projects' },
    { cells: ['61 d ago', ['r.haddad', 'm'], 'Registered oxford_economics MCP server', 'MCP registry'], status: 'approved', statusLabel: 'Applied', to: '/platform/mcp' },
  ],
};
