import * as React from 'react';
import { Check, Copy, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/menu';

/** White card with hairline border; optional header row. */
export function Card({
  title,
  actions,
  sub,
  className,
  bodyClassName,
  children,
  stripe,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
  /** 3px top accent stripe colour (status/health cards). */
  stripe?: string;
}) {
  return (
    <section className={cn('card min-w-0', className)} style={stripe ? { borderTop: `3px solid ${stripe}` } : undefined}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink-strong">{title}</div>
            {sub && <div className="text-xs text-ink-muted">{sub}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(title || actions ? 'p-4' : 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Section title row: h2 + right-aligned meta. */
export function SectionTitle({ children, meta, className }: { children: React.ReactNode; meta?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-3', className)}>
      <h2 className="h2">{children}</h2>
      {meta && <span className="text-[12.5px] text-ink-muted">{meta}</span>}
    </div>
  );
}

/** Square icon tile (resource icons, project initials). */
export function IconTile({ children, size = 32, bg = 'var(--brand-tint)', fg = 'var(--brand)', className, mono }: { children: React.ReactNode; size?: number; bg?: string; fg?: string; className?: string; mono?: boolean }) {
  return (
    <span
      className={cn('grid flex-none place-items-center rounded-sm', mono && 'font-mono font-bold', className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: mono ? Math.round(size * 0.3) : undefined }}
    >
      {children}
    </span>
  );
}

/** The mono "AI" mark used for AI agents (never a sparkle). */
export function AiMark({ size = 16 }: { size?: number }) {
  return (
    <span className="font-mono font-semibold leading-none tracking-[-0.03em]" style={{ fontSize: Math.round(size * 0.62) }}>
      AI
    </span>
  );
}

/** Short ID in mono with copy-to-clipboard. Always pair with a human name. */
export function CopyId({ id, short = true, className }: { id: string; short?: boolean; className?: string }) {
  const [done, setDone] = React.useState(false);
  const text = short ? id.replace(/-/g, '').slice(0, 8) : id;
  return (
    <Tooltip content={done ? 'Copied' : id}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          void navigator.clipboard?.writeText(id);
          setDone(true);
          toast.success('ID copied');
          setTimeout(() => setDone(false), 1200);
        }}
        className={cn('inline-flex items-center gap-1 rounded-sm font-mono text-[12.5px] text-ink-body hover:text-brand', className)}
      >
        {text}
        {done ? <Check size={12} /> : <Copy size={12} className="opacity-60" />}
      </button>
    </Tooltip>
  );
}

/** Relative time with the exact timestamp in a tooltip. */
export function RelTime({ rel, abs }: { rel: string; abs: string }) {
  return (
    <Tooltip content={abs}>
      <span className="whitespace-nowrap text-ink-muted">{rel}</span>
    </Tooltip>
  );
}

export function EmptyState({ icon, title, body, actions }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-sunken text-ink-muted">{icon ?? <Inbox size={22} />}</span>
      <div className="text-[15px] font-semibold text-ink-strong">{title}</div>
      {body && <div className="max-w-md text-[13px] text-ink-muted">{body}</div>}
      {actions && <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-surface-sunken', className)} />;
}

/** Key/value grid used in detail panels. */
export function KeyValues({ rows, cols = '140px 1fr', className }: { rows: [React.ReactNode, React.ReactNode][]; cols?: string; className?: string }) {
  return (
    <div className={cn('grid gap-x-3.5 gap-y-2 text-[13px]', className)} style={{ gridTemplateColumns: cols }}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <span className="text-ink-muted">{k}</span>
          <span className="min-w-0 break-words text-ink-body">{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Horizontal meter with label + value (limits, capacity). */
export function Meter({ label, value, pct, color = 'var(--brand)' }: { label: string; value: string; pct: number; color?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 text-[12.5px]">
        <span className="text-ink-muted">{label}</span>
        <span className="font-mono font-medium text-ink-strong">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-surface-sunken">
        <div className="h-full rounded-sm" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}

/** Legend swatch + label. */
export function Swatch({ color, label, dashed, shape = 'square' }: { color: string; label: React.ReactNode; dashed?: boolean; shape?: 'square' | 'line' }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-ink-muted">
      {shape === 'line' ? (
        <span className="w-3" style={{ borderTop: `${dashed ? 1.5 : 2}px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      ) : (
        <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

/** Read-only checkbox look (wizards, role permissions). */
export function CheckBox({ checked, label, sub, disabled }: { checked: boolean; label: React.ReactNode; sub?: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-60')}>
      <span
        className={cn('mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-[3px] border', checked ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface')}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-ink-strong">{label}</div>
        {sub && <div className="text-xs text-ink-muted">{sub}</div>}
      </div>
    </div>
  );
}

/** Read-only form field (console is read-only in this phase). */
export function Field({ label, children, hint, mono }: { label: string; children: React.ReactNode; hint?: React.ReactNode; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-strong">{label}</span>
      <div className={cn('flex min-h-9 items-center rounded-card border border-line bg-surface px-3 text-[13px] text-ink-body', mono && 'font-mono text-[12.5px]')}>
        {children}
      </div>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}
