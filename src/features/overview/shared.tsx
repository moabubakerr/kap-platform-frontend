import {
  Bot,
  BookOpen,
  CalendarClock,
  CircleX,
  Cpu,
  Database,
  Languages,
  Layers,
  MessageSquarePlus,
  MessagesSquare,
  Play,
  Plug,
  TriangleAlert,
  Upload,
  UserPlus,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { OvIcon, OvRoute } from '@/mocks/overview';

const ICONS: Record<OvIcon, LucideIcon> = {
  bot: Bot,
  messages: MessagesSquare,
  book: BookOpen,
  database: Database,
  workflow: Workflow,
  plug: Plug,
  users: Users,
  calendar: CalendarClock,
  msgPlus: MessageSquarePlus,
  upload: Upload,
  play: Play,
  userPlus: UserPlus,
  circleX: CircleX,
  alert: TriangleAlert,
  languages: Languages,
  layers: Layers,
  cpu: Cpu,
};

export function OvIconEl({ name, size = 16 }: { name: OvIcon; size?: number }) {
  const I = ICONS[name];
  return <I size={size} strokeWidth={1.75} className="block flex-none" />;
}

/** Design screen key → console route under the project base. */
export function routeFor(base: string, r: OvRoute, jobId?: string) {
  const p: Record<OvRoute, string> = {
    convs: '/conversations',
    map: '/map',
    feedback: '/feedback',
    catalogue: '/catalogue',
    catPublish: '/catalogue/publish',
    pipelines: '/pipelines',
    wizard: '/agents/new',
    users: '/users',
    reports: '/reports',
    agents: '/agents',
    collections: '/collections',
    mcp: '/mcp',
    providers: '/providers',
    trace: `/traces/${jobId ?? '93c7a1f2'}`,
  };
  return `${base}${p[r]}`;
}

export const TONE_COLOR = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' } as const;
export const TONE_FG = { success: 'var(--success-fg)', warning: 'var(--warning-fg)', danger: 'var(--danger-fg)' } as const;
