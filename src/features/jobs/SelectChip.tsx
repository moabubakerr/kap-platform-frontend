import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';

export type ChipOption<T extends string> = { value: T; label: string; count?: number };

/**
 * Design filter chip with a dropdown ("Status: any ⌄"): 30px, 3px radius,
 * maroon tint when a value other than the default is chosen.
 * Shared by Agent jobs, Conversations and Feedback.
 */
export function SelectChip<T extends string>({
  label,
  value,
  options,
  onChange,
  defaultValue,
  active,
  bare,
}: {
  label?: string;
  value: T;
  options: ChipOption<T>[];
  onChange: (v: T) => void;
  defaultValue?: T;
  /** Force the active look (e.g. the date-range chip). */
  active?: boolean;
  /** Show only the value, no "Label:" prefix. */
  bare?: boolean;
}) {
  const cur = options.find((o) => o.value === value);
  const on = active ?? (defaultValue !== undefined ? value !== defaultValue : false);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-[30px] flex-none items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 text-[13px] outline-none',
            on ? 'border-brand bg-brand-tint font-medium text-brand-strong' : 'border-line bg-surface text-ink-body hover:border-brand',
          )}
        >
          {bare ? cur?.label : `${label}: ${cur?.label ?? value}`}
          <ChevronDown size={14} />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="min-w-[200px]">
        {options.map((o) => (
          <MenuItem key={o.value} onSelect={() => onChange(o.value)}>
            <span className="w-3.5 flex-none text-brand">{o.value === value && <Check size={14} />}</span>
            <span className="flex-1">{o.label}</span>
            {o.count != null && <span className="font-mono text-[11px] text-ink-subtle">{o.count}</span>}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** Design search box (34px, 280px wide). */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex h-[34px] w-[280px] max-w-full items-center gap-2 overflow-hidden rounded-card border border-line bg-surface px-2.5 text-ink-subtle focus-within:border-brand">
      <Search size={15} className="flex-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-strong outline-none placeholder:text-ink-subtle"
      />
    </div>
  );
}

/** Summary strip: cells separated by hairlines, dot + label over a 22px value. */
export function SummaryStrip({ items, min = 140 }: { items: { k: string; v: string; c?: string; vc?: string }[]; min?: number }) {
  return (
    <div className="card grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {items.map((x, i) => (
        <div key={x.k} className={cn('px-4 py-3', i > 0 && 'border-l border-line-subtle')}>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink-muted">
            {x.c && <span className="h-2 w-2 rounded-full" style={{ background: x.c }} />}
            {x.k}
          </div>
          <div className="mt-0.5 text-[22px] font-semibold" style={{ color: x.vc ?? 'var(--text-strong)' }}>
            {x.v}
          </div>
        </div>
      ))}
    </div>
  );
}
