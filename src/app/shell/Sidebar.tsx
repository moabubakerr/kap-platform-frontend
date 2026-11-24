import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/menu';
import type { NavGroup } from '../nav';

export function Sidebar({
  groups,
  base,
  identity,
  collapsed,
}: {
  groups: NavGroup[];
  base: string;
  identity: { ini: string; bg: string; fg: string; kind: string; name: string; desc: string };
  collapsed: boolean;
}) {
  const { pathname } = useLocation();
  const rel = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : '';
  const section = rel.split('/')[0] ?? '';

  return (
    <nav
      aria-label="Sidebar"
      className={cn('flex flex-none flex-col gap-3.5 overflow-y-auto border-r border-line-subtle bg-surface px-2 pb-5 pt-3 transition-[width]', collapsed ? 'w-[60px]' : 'w-[232px]')}
    >
      <div className={cn('flex items-center gap-2.5 border-b border-line-subtle pb-3 pt-1', collapsed ? 'justify-center px-0' : 'px-2')}>
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-sm font-mono text-[10.5px] font-bold" style={{ background: identity.bg, color: identity.fg }}>
          {identity.ini}
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-ink-subtle">{identity.kind}</div>
            <div className="ellipsis text-sm font-semibold text-ink-strong">{identity.name}</div>
            <div className="ellipsis text-[11.5px] text-ink-muted">{identity.desc}</div>
          </div>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-px">
          {!collapsed && <div className="px-2.5 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-subtle">{g.label}</div>}
          {collapsed && <div className="mx-2 my-1 h-px bg-line-subtle first:hidden" />}
          {g.items.map((it) => {
            const to = it.external ? it.path : it.path ? `${base}/${it.path}` : base;
            const on = !it.external && it.path === section;
            const link = (
              <NavLink
                key={it.label}
                to={to}
                className={cn(
                  'flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] hover:no-underline',
                  on ? 'bg-brand-tint font-semibold text-brand' : 'font-medium text-ink-body hover:bg-surface-hover hover:text-ink-body',
                  collapsed && 'justify-center px-0',
                )}
              >
                <it.icon size={16} strokeWidth={1.75} className="flex-none" />
                {!collapsed && <span className="ellipsis flex-1">{it.label}</span>}
              </NavLink>
            );
            return collapsed ? (
              <Tooltip key={it.label} content={it.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}
