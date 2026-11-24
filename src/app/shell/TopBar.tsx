import { useNavigate } from 'react-router-dom';
import {
  Bell, Bot, Building2, Cable, CalendarClock, Check, ChevronDown, CircleHelp, CircleX, Database, FolderOpen, Key, Layers,
  PanelLeft, PanelLeftClose, Plus, Search, TriangleAlert, User, Workflow, type LucideIcon,
} from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { PROJECTS, type Project } from '@/mocks/projects';
import { accounts, iamStore, platformAdmin, roleNamesIn, tenantsOf, TENANT_KEYS } from '@/v35/iam';
import { allowedTenant, ALL_TENANT_SCREENS } from '@/v35/screens';
import { useAccess, useViewAs } from '@/v35/access';
import { cn } from '@/lib/utils';

const iconBtn = 'grid h-[34px] w-[34px] flex-none place-items-center rounded-sm text-white/90 hover:bg-white/[.12] hover:text-white';
const divider = <span className="mx-1 h-7 w-px flex-none bg-white/[.18]" />;

// v35 create menu: [label, screen key, icon]
const CREATE: [string, string, LucideIcon][] = [
  ['Agent', 'agents', Bot],
  ['Agent workflow', 'workflows', Workflow],
  ['Schedule or event trigger', 'schedules', CalendarClock],
  ['Collection', 'collections', Database],
  ['Data source', 'iSources', Cable],
  ['Pipeline', 'iPipes', Workflow],
  ['User', 'users', User],
  ['Service account', 'tokens', Key],
];

export function TopBar({ scope, project, collapsed, onToggleSidebar, onOpenPalette }: { scope: 'platform' | 'project'; project?: Project; collapsed: boolean; onToggleSidebar: () => void; onOpenPalette: () => void }) {
  const nav = useNavigate();
  const { uid, setUid } = useViewAs();
  iamStore.use(); // menus follow IAM edits
  const access = useAccess(project?.key ?? null);
  const base = `/p/${project?.key ?? 'sceai'}`;
  const pa = platformAdmin(uid);
  const isPlatAdmin = pa?.role === 'Platform Administrator';
  const myTenants = tenantsOf(uid);

  const createItems =
    scope === 'platform'
      ? isPlatAdmin
        ? [['Tenant', '/platform/tenants', Building2, 'AI team'] as const]
        : []
      : CREATE.map(([n, k, Icon]) => {
          const s = ALL_TENANT_SCREENS.find((x) => x.key === k)!;
          return project && allowedTenant(uid, project.key, s) ? ([n, s.path ? `${base}/${s.path}` : base, Icon, ''] as const) : null;
        }).filter(Boolean as unknown as <T>(x: T | null) => x is T);

  const bell: [boolean, string, string, string][] = [
    [true, 'Job 5d2e0a71 exceeded the 180 s timeout', 'sceai_indicators_oxford · 2 h ago', '/p/sceai/monitoring'],
    [false, 'Oxford MCP degraded', '2 errors (502) in the last 24 h · 18 min ago', '/p/sceai/tools'],
    [true, 'Job b1c94f08 reached the tool-call limit', 'sceai_indicators_agent · 5 h ago', '/p/sceai/monitoring'],
    [false, 'docs_docx_ingest skipped 1 file', 'run 87 · 1 d ago', '/p/sceai/runs'],
  ];

  const tenantRows = PROJECTS.filter((p) => isPlatAdmin || (p.key !== 'default' && myTenants.includes(p.key)));
  const roleLine = scope === 'platform' ? (pa ? pa.role : 'No platform access') : project ? (isPlatAdmin && !myTenants.includes(project.key) ? 'Platform administrator' : access.rolesIn(project.key)) : '';

  return (
    <header className="relative z-[60] flex h-14 flex-none items-center gap-2.5 border-b border-black/25 bg-brand-strong pl-2.5 pr-4 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,.06)]">
      <button className={iconBtn} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={onToggleSidebar} aria-label="Toggle navigation" aria-expanded={!collapsed}>
        {collapsed ? <PanelLeft size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
      </button>
      <div className="flex flex-none items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-sm border border-dashed border-white/50 bg-white/[.04] text-[8px] tracking-[.06em] text-white/75">LOGO</span>
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.005em]">KAP Console</span>
      </div>
      {divider}

      {/* Scope switcher */}
      <Menu>
        <MenuTrigger asChild>
          <button className="flex h-10 flex-none items-center gap-2.5 rounded-sm border border-white/20 bg-white/[.06] pl-1.5 pr-2.5 text-left text-[13px] hover:bg-white/[.12] focus-visible:shadow-focus">
            <span className="grid h-7 w-7 place-items-center rounded-sm bg-white/[.14]">{scope === 'platform' ? <Layers size={15} /> : <FolderOpen size={15} />}</span>
            <span className="flex flex-col leading-[1.15]">
              <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-white/65">{scope === 'platform' ? 'Platform' : 'Tenant'}</span>
              <span className="text-[13.5px] font-semibold">{scope === 'platform' ? 'KAP' : project?.name}</span>
            </span>
            <ChevronDown size={14} className="ml-0.5 opacity-75" />
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-[340px]">
          {pa && (
            <>
              <MenuLabel>Platform</MenuLabel>
              <ScopeRow ini="KAP" ibg="#1F1A1C" ifg="#fff" name="KAP platform" desc="Shared runtime, model serving, queues · AI team" on={scope === 'platform'} onSelect={() => nav('/platform')} />
            </>
          )}
          {tenantRows.map((p, i) => (
            <div key={p.key}>
              {p.key === 'default' ? <MenuLabel>System · internal</MenuLabel> : i === 0 && <MenuLabel>{pa ? 'Tenants on KAP' : 'Your tenants'}</MenuLabel>}
              <ScopeRow
                ini={p.initials}
                ibg={p.key === 'sceai' ? '#F6E8EC' : 'var(--surface-sunken)'}
                ifg={p.key === 'sceai' ? '#8A1538' : 'var(--text-body)'}
                name={p.name}
                desc={p.description}
                on={scope === 'project' && project?.key === p.key}
                onSelect={() => nav(`/p/${p.key}`)}
              />
            </div>
          ))}
        </MenuContent>
      </Menu>

      {/* Search → command palette */}
      <div className="flex min-w-[200px] flex-1 justify-center">
        <button
          onClick={onOpenPalette}
          className="flex h-[38px] min-w-[200px] max-w-[560px] flex-auto items-center gap-2.5 rounded-sm border border-white/[.14] bg-black/[.18] pl-3 pr-2 text-left text-[13px] text-white/80 hover:border-white/30 hover:bg-black/[.26]"
        >
          <Search size={15} />
          <span className="ellipsis flex-1">Search agents, conversations, traces, indicators</span>
          <span className="whitespace-nowrap rounded-[3px] bg-white/[.12] px-1.5 py-0.5 font-mono text-[10.5px]">Ctrl K</span>
        </button>
      </div>

      {/* Create — only what the account may create */}
      {createItems.length > 0 && (
        <Menu>
          <MenuTrigger asChild>
            <button className="flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-sm bg-white pl-3 pr-2.5 text-[13px] font-semibold text-brand-strong hover:bg-brand-tint">
              <Plus size={15} />
              Create
              <span className="mx-0.5 h-4 w-px bg-brand-strong/20" />
              <ChevronDown size={14} />
            </button>
          </MenuTrigger>
          <MenuContent align="end" className="w-[280px]">
            <div className="px-2.5 pb-2 pt-1.5 text-xs text-ink-muted">Create in {scope === 'platform' ? 'KAP' : project?.name}</div>
            {createItems.map(([n, to, Icon, k]) => (
              <MenuItem key={n} onSelect={() => nav(to)}>
                <Icon size={15} className="text-ink-muted" />
                <span className="flex-1">{n}</span>
                <span className="text-[11.5px] text-ink-muted">{k}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
      {divider}

      {/* Notifications */}
      <Menu>
        <MenuTrigger asChild>
          <button className={cn(iconBtn, 'relative')} title="Notifications" aria-label="Notifications">
            <Bell size={18} strokeWidth={1.75} />
            <span className="absolute right-[3px] top-1 grid h-4 min-w-4 place-items-center rounded-lg bg-sand px-1 text-[10px] font-bold text-[#3A2A12] shadow-[0_0_0_2px_#6B0F2B]">4</span>
          </button>
        </MenuTrigger>
        <MenuContent align="end" className="w-[380px] p-0">
          <div className="flex justify-between border-b border-line-subtle px-3.5 py-3 font-semibold text-ink-strong">
            Notifications<span className="text-[12.5px] font-normal text-brand">Mark all read</span>
          </div>
          {bell.map(([bad, t, m, to]) => (
            <MenuItem key={t} onSelect={() => nav(to)} className="grid grid-cols-[18px_1fr] items-start gap-2.5 rounded-none border-t border-line-subtle px-3.5 py-2.5 first:border-t-0">
              <span className="pt-0.5" style={{ color: bad ? 'var(--danger)' : 'var(--warning)' }}>
                {bad ? <CircleX size={16} /> : <TriangleAlert size={16} />}
              </span>
              <div>
                <div className="text-[13px] font-medium text-ink-strong">{t}</div>
                <div className="text-xs text-ink-muted">{m}</div>
              </div>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <button className={iconBtn} title="Help" aria-label="Help">
        <CircleHelp size={18} strokeWidth={1.75} />
      </button>

      {/* Account: name, role, switch account (access simulation) */}
      <Menu>
        <MenuTrigger asChild>
          <button title="Account" className="flex h-10 flex-none items-center gap-2 rounded-sm pl-1 pr-1.5 text-left hover:bg-white/[.12]">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-brand-tint text-xs font-semibold text-brand-strong">{access.initials}</span>
            <span className="flex max-w-[170px] flex-col leading-[1.15]">
              <span className="ellipsis text-[13px] font-semibold">{access.name}</span>
              <span className="ellipsis text-[11px] opacity-75">{roleLine}</span>
            </span>
            <ChevronDown size={14} className="opacity-70" />
          </button>
        </MenuTrigger>
        <MenuContent align="end" className="w-[340px]">
          <div className="border-b border-line-subtle px-2.5 pb-3 pt-2.5">
            <div className="font-semibold text-ink-strong">{access.name}</div>
            <div className="font-mono text-xs text-ink-muted">{uid}</div>
            <div className="mt-1.5 text-[12.5px]">
              <span className="text-ink-muted">{scope === 'platform' ? 'KAP platform' : project?.name}:</span> {roleLine}
            </div>
          </div>
          <MenuLabel>Switch account</MenuLabel>
          <div className="max-h-[320px] overflow-auto">
            {accounts().map((a) => {
              const p = platformAdmin(a.id);
              const desc = [...(p ? [p.role] : []), ...TENANT_KEYS.filter((t) => tenantsOf(a.id).includes(t)).map((t) => `${PROJECTS.find((x) => x.key === t)?.name} · ${roleNamesIn(a.id, t)}`)].join(' / ') || 'No access';
              return (
                <MenuItem key={a.id} onSelect={() => setUid(a.id)} className={cn('flex-col items-start gap-0', a.id === uid && 'bg-brand-tint')}>
                  <div className="flex w-full items-center gap-1.5 text-[13px] font-medium text-ink-strong">
                    {a.name} <span className="font-mono text-[11.5px] font-normal text-ink-muted">{a.id}</span>
                    {a.id === uid && <Check size={13} className="ml-auto text-brand" />}
                  </div>
                  <div className="text-[11.5px] text-ink-muted">{desc}</div>
                </MenuItem>
              );
            })}
          </div>
          <MenuSeparator />
          <div className="px-2.5 pb-1 pt-1.5 text-[13px] text-ink-muted">Sign out</div>
        </MenuContent>
      </Menu>
    </header>
  );
}

function ScopeRow({ ini, ibg, ifg, name, desc, on, disabled, onSelect }: { ini: string; ibg: string; ifg: string; name: string; desc: string; on: boolean; disabled?: boolean; onSelect: () => void }) {
  return (
    <MenuItem disabled={disabled} onSelect={onSelect} className={cn('items-start', on && 'bg-brand-tint')}>
      <span className="grid h-7 w-7 flex-none place-items-center rounded-sm font-mono text-[10px] font-bold" style={{ background: ibg, color: ifg }}>
        {ini}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-strong">
          {name}
          {on && <Check size={14} className="ml-auto text-brand" />}
        </div>
        <div className="text-xs text-ink-muted">{desc}</div>
      </div>
    </MenuItem>
  );
}
