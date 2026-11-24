import {
  ArrowUpLeft,
  BookOpen,
  Bot,
  Building2,
  Cable,
  CalendarClock,
  ChartLine,
  Cpu,
  Database,
  FolderOpen,
  GitCompareArrows,
  HardDriveDownload,
  History,
  House,
  Key,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListChecks,
  MessagesSquare,
  Network,
  Package,
  Plug,
  Settings,
  Shield,
  ThumbsDown,
  User,
  Users,
  Waypoints,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { label: string; path: string; icon: LucideIcon; external?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

/** Project sidebar (README §5). Paths are relative to /p/:projectId. */
export const PROJECT_NAV: NavGroup[] = [
  { label: 'Home', items: [{ label: 'Overview', path: '', icon: House }] },
  {
    label: 'Orchestration',
    items: [
      { label: 'Agents map', path: 'map', icon: Network },
      { label: 'Traces', path: 'traces', icon: Waypoints },
      { label: 'Conversations', path: 'conversations', icon: MessagesSquare },
      { label: 'Feedback', path: 'feedback', icon: ThumbsDown },
      { label: 'Catalogue', path: 'catalogue', icon: BookOpen },
    ],
  },
  {
    label: 'AI',
    items: [
      { label: 'Agents', path: 'agents', icon: Bot },
      { label: 'Model providers', path: 'providers', icon: Cpu },
      { label: 'Tools & MCP servers', path: 'mcp', icon: Plug },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Collections', path: 'collections', icon: Database },
      { label: 'Connectors', path: 'connectors', icon: Cable },
      { label: 'Pipelines', path: 'pipelines', icon: Workflow },
      { label: 'Indicators', path: 'indicators', icon: ChartLine },
      { label: 'Ingest packages', path: 'packages', icon: Package },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Agent jobs', path: 'jobs', icon: ListChecks },
      { label: 'Ingestion jobs', path: 'ingestion', icon: HardDriveDownload },
    ],
  },
  {
    label: 'Identity & access',
    items: [
      { label: 'Users', path: 'users', icon: User },
      { label: 'Groups', path: 'groups', icon: Users },
      { label: 'Roles', path: 'roles', icon: Shield },
      { label: 'Access grants', path: 'grants', icon: KeyRound },
      { label: 'API tokens', path: 'tokens', icon: Key },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Audit log', path: 'audit', icon: History },
      { label: 'Configuration versions', path: 'configs', icon: GitCompareArrows },
      { label: 'Scheduled reports', path: 'reports', icon: CalendarClock },
    ],
  },
  { label: 'Project', items: [{ label: 'Project settings', path: 'settings', icon: Settings }] },
  { label: 'KAP platform', items: [{ label: 'Platform overview', path: '/platform', icon: ArrowUpLeft, external: true }] },
];

/** Platform sidebar. Paths are relative to /platform. */
export const PLATFORM_NAV: NavGroup[] = [
  {
    label: 'KAP platform',
    items: [
      { label: 'Overview', path: '', icon: LayoutDashboard },
      { label: 'Projects', path: 'projects', icon: Building2 },
    ],
  },
  {
    label: 'Shared services',
    items: [
      { label: 'Model serving', path: 'models', icon: Cpu },
      { label: 'MCP registry', path: 'mcp', icon: Plug },
      { label: 'Queues & workers', path: 'queues', icon: Layers },
    ],
  },
  { label: 'Platform access', items: [{ label: 'AI team & admins', path: 'users', icon: Shield }] },
  { label: 'Governance', items: [{ label: 'Platform audit', path: 'audit', icon: History }] },
  {
    label: 'Open a project',
    items: [
      { label: 'SCEAI', path: '/p/sceai', icon: FolderOpen, external: true },
      { label: 'Default · system', path: '/p/default', icon: FolderOpen, external: true },
    ],
  },
];

/** Section → group label lookup for breadcrumbs. */
export function crumbsFor(nav: NavGroup[], seg: string | undefined): [string, string] | null {
  for (const g of nav) for (const it of g.items) if (!it.external && it.path === (seg ?? '')) return [g.label, it.label];
  return null;
}
