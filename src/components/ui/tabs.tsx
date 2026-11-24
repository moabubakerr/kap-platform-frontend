import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type TabItem = { value: string; label: string; badge?: number | string };

const tabClass = (on: boolean) =>
  cn(
    'relative -mb-px inline-flex items-center gap-[7px] whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] transition-colors',
    on ? 'border-brand font-semibold text-brand-strong' : 'border-transparent font-medium text-ink-muted hover:text-ink-strong',
  );

function TabBadge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('rounded-card px-[7px] text-[11px] font-semibold leading-[1.5]', on ? 'bg-brand-tint text-brand-strong' : 'bg-neutral-100 text-ink-muted')}>
      {children}
    </span>
  );
}

/** Underline tab bar, controlled by state. */
export function Tabs({ items, value, onChange, className }: { items: TabItem[]; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line-subtle', className)}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={on} onClick={() => onChange(it.value)} className={tabClass(on)}>
            {it.label}
            {it.badge != null && <TabBadge on={on}>{it.badge}</TabBadge>}
          </button>
        );
      })}
    </div>
  );
}

/** Same look, but each tab is a deep link (e.g. /p/sceai/agents/:id/versions). */
export function LinkTabs({ items, base, className }: { items: TabItem[]; base: string; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line-subtle', className)}>
      {items.map((it, i) => (
        <NavLink
          key={it.value}
          to={i === 0 ? base : `${base}/${it.value}`}
          end
          replace
          className={({ isActive }) => cn(tabClass(isActive), 'hover:no-underline')}
        >
          {({ isActive }) => (
            <>
              {it.label}
              {it.badge != null && <TabBadge on={isActive}>{it.badge}</TabBadge>}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

/** Segmented control (mode switches: Live | 1 h | 24 h | 7 d, etc.). */
export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-card border border-line bg-surface-sunken p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 whitespace-nowrap rounded-sm px-3 text-[12.5px] transition-colors',
            o.value === value ? 'bg-surface font-semibold text-brand-strong shadow-[0_0_0_1px_var(--border-subtle)]' : 'text-ink-muted hover:text-ink-strong',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
