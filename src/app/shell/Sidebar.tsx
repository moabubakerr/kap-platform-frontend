import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu';
import { useNavigate } from 'react-router-dom';
import type { NavGroup } from '@/v35/screens';

/**
 * v35 sidebar: groups with uppercase labels; only screens the current account
 * may open are listed. Collapsed: one icon per group with a fly-out menu.
 */
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
  const nav = useNavigate();
  const rel = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : '';
  const section = rel.split('/')[0] ?? '';
  const to = (path: string) => (path ? `${base}/${path}` : base);
  const visible = groups.filter((g) => g.items.length > 0);

  return (
    <nav
      aria-label="Sidebar"
      className={cn('flex flex-none flex-col gap-3.5 overflow-y-auto overflow-x-hidden border-r border-line-subtle bg-surface px-2 py-3 transition-[width]', collapsed ? 'w-[60px] items-center' : 'w-[248px]')}
    >
      {collapsed ? (
        <span title={`${identity.kind} · ${identity.name}`} className="mb-2 grid h-[34px] w-[34px] place-items-center rounded-sm font-mono text-[10.5px] font-bold" style={{ background: identity.bg, color: identity.fg }}>
          {identity.ini}
        </span>
      ) : (
        <div className="flex items-center gap-2.5 border-b border-line-subtle px-2 pb-3 pt-1">
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-sm font-mono text-[10.5px] font-bold" style={{ background: identity.bg, color: identity.fg }}>
            {identity.ini}
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-ink-subtle">{identity.kind}</div>
            <div className="ellipsis text-sm font-semibold text-ink-strong">{identity.name}</div>
            <div className="ellipsis text-[11.5px] text-ink-muted">{identity.desc}</div>
          </div>
        </div>
      )}

      {visible.map((g) => {
        const groupOn = g.items.some((it) => it.path === section);
        if (collapsed) {
          const Icon = g.items[0].icon;
          return (
            <Menu key={g.label}>
              <MenuTrigger asChild>
                <button
                  type="button"
                  title={g.label}
                  aria-label={g.label}
                  className={cn('grid h-10 w-10 place-items-center rounded-sm hover:bg-surface-hover', groupOn ? 'bg-brand-tint text-brand shadow-[inset_3px_0_0_var(--brand)]' : 'text-ink-body')}
                >
                  <Icon size={18} strokeWidth={1.75} />
                </button>
              </MenuTrigger>
              <MenuContent side="right" align="start" className="min-w-[230px]">
                <MenuLabel>{g.label}</MenuLabel>
                {g.items.map((it) => (
                  <MenuItem key={it.key} onSelect={() => nav(to(it.path))} className={cn(it.path === section && 'bg-brand-tint font-semibold text-brand')}>
                    <it.icon size={16} strokeWidth={1.75} />
                    {it.label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          );
        }
        return (
          <div key={g.label} className="flex flex-col gap-px">
            <div className="px-2.5 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-subtle">{g.label}</div>
            {g.items.map((it) => {
              const on = it.path === section;
              return (
                <NavLink
                  key={it.key}
                  to={to(it.path)}
                  title={it.label}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] hover:no-underline',
                    on ? 'bg-brand-tint font-semibold text-brand' : 'font-medium text-ink-body hover:bg-surface-hover hover:text-ink-body',
                  )}
                >
                  <it.icon size={16} strokeWidth={1.75} className="flex-none" />
                  <span className="ellipsis flex-1">{it.label}</span>
                </NavLink>
              );
            })}
          </div>
        );
      })}
      {visible.length === 0 && !collapsed && <div className="px-2.5 text-[12.5px] text-ink-muted">This account has no access in this scope.</div>}
    </nav>
  );
}

export default React.memo(Sidebar);
