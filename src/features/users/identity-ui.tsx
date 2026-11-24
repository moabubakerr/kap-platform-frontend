import * as React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/common/primitives';

/** Read-only phase: every mutating action only shows this toast. */
export const readOnly = () => toast('Read-only in this version');

/** Where a resource name (or permission scope label) links to. */
export function resourceHref(base: string, resource: string): string {
  if (resource.startsWith('sceai_indicators_')) return `${base}/agents/${resource}`;
  if (resource === 'sceai_indicators' || resource === 'All collections') return `${base}/collections/sceai_indicators`;
  if (resource === 'oxford_economics') return `${base}/mcp`;
  if (resource === 'All agents') return `${base}/agents`;
  if (/jobs|Job history/i.test(resource)) return `${base}/jobs`;
  if (resource === 'Users and groups') return `${base}/users`;
  if (resource === 'Access grants') return `${base}/grants`;
  if (resource === 'API tokens') return `${base}/tokens`;
  return `${base}/grants`;
}

/** Two-letter initials (design: `n.replace('api:', '').slice(0, 2).toUpperCase()`). */
export const initials = (username: string) => username.replace('api:', '').slice(0, 2).toUpperCase();

export function Avatar({ name, size = 26, tone = 'muted' }: { name: string; size?: number; tone?: 'muted' | 'brand' }) {
  return (
    <span
      className={cn('grid flex-none place-items-center rounded-full font-semibold', tone === 'brand' ? 'bg-brand-tint text-brand-strong' : 'bg-surface-sunken text-ink-muted')}
      style={{ width: size, height: size, fontSize: size >= 40 ? 15 : 11 }}
    >
      {initials(name)}
    </span>
  );
}

/** Mono link used for every resource mention. Stops row-click propagation. */
export function MonoLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} onClick={(e) => e.stopPropagation()} className={cn('font-mono text-[12.5px] text-brand hover:underline', className)}>
      {children}
    </Link>
  );
}

/** Mono chip (path chips, group chips). */
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('whitespace-nowrap rounded-sm border border-line bg-surface px-2 py-0.5 font-mono text-[12.5px]', className)}>{children}</span>;
}

/** Dropdown-looking filter pill as in the design (`Who: anyone ⌄`). */
export function PillSelect<T extends string>({
  value,
  options,
  onChange,
  prefix,
  active,
  mono,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  prefix?: string;
  active?: boolean;
  mono?: boolean;
}) {
  return (
    <label
      className={cn(
        'relative inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 text-[13px]',
        active ? 'border-brand bg-brand-tint font-medium text-brand-strong' : 'border-line bg-surface text-ink-body',
        mono && 'font-mono',
      )}
    >
      {prefix}
      {options.find((o) => o.value === value)?.label}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={prefix ?? 'Filter'}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Labelled native select in the design-system Select look. */
export function SelectField<T extends string>({ label, value, options, onChange, className, mono }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string; mono?: boolean }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-medium text-ink-body">{label}</span>
      <span className="relative flex">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={cn('h-10 w-full cursor-pointer appearance-none rounded-card border border-line bg-surface pl-3 pr-8 text-[13px] text-ink-strong outline-none focus-visible:shadow-focus', mono && 'font-mono text-[12.5px]')}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}

/** Design-style plain table (sunken 12px header, 13px rows). */
export function PlainTable({ head, children, minWidth = 820, align }: { head: React.ReactNode[]; children: React.ReactNode; minWidth?: number; align?: ('left' | 'right')[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-[9px] font-semibold" style={{ textAlign: align?.[i] ?? 'left' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-7" />
      ))}
    </div>
  );
}
