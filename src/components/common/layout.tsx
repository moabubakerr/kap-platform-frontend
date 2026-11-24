import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { IconTile } from './primitives';

/** Page wrapper: padding 16px 32px 48px, max width 1440. */
export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('page', wide && 'max-w-none', className)}>{children}</div>;
}

/** List/resource page header: title + count + description + actions. */
export function PageHeader({
  title,
  count,
  description,
  actions,
  icon,
  badge,
}: {
  title: React.ReactNode;
  count?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      {icon}
      <div className="min-w-[240px] flex-1">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="h1 whitespace-nowrap">{title}</h1>
          {count != null && <span className="font-mono text-[15px] text-ink-muted">{count}</span>}
          {badge}
        </div>
        {description && <div className="mt-0.5 text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Detail ("blade") header: icon tile, name, status, facts row, actions. */
export function DetailHeader({
  icon,
  name,
  status,
  facts,
  actions,
  mono = true,
  sub,
}: {
  icon: React.ReactNode;
  name: React.ReactNode;
  status?: React.ReactNode;
  facts?: [string, React.ReactNode][];
  actions?: React.ReactNode;
  mono?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <IconTile size={48}>{icon}</IconTile>
      <div className="min-w-[260px] flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className={cn('h1 text-[22px]', mono && 'font-mono font-semibold tracking-[-0.02em]')}>{name}</h1>
          {status}
        </div>
        {sub && <div className="mt-0.5 text-ink-muted">{sub}</div>}
        {facts && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
            {facts.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {k} <span className="text-ink-body">{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Right-side drawer for quick inspection. Esc closes (handled by caller via onClose). */
export function SideDrawer({ open, onClose, title, children, footer, width = 400 }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <aside className="flex max-h-full flex-none flex-col border-l border-line-subtle bg-surface" style={{ width }}>
      <div className="flex items-start gap-3 border-b border-line-subtle px-4 py-3">
        <div className="min-w-0 flex-1">{title}</div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-ink-muted" onClick={onClose} aria-label="Close">
          <X size={18} />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
      {footer && <div className="flex gap-2 border-t border-line-subtle bg-surface-sunken px-4 py-3">{footer}</div>}
    </aside>
  );
}

/** Azure-style wizard: left step list, right card with sunken footer. */
export function WizardLayout({
  steps,
  current,
  onStep,
  children,
  footer,
  title,
}: {
  steps: string[];
  current: number;
  onStep?: (i: number) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'minmax(200px, 240px) minmax(0, 1fr)' }}>
      <ol className="card flex flex-col gap-0.5 p-2">
        {steps.map((s, i) => {
          const done = i < current;
          const cur = i === current;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onStep?.(i)}
                className={cn('flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13.5px]', cur && 'bg-brand-tint')}
              >
                <span
                  className={cn(
                    'grid h-[22px] w-[22px] flex-none place-items-center rounded-full border text-[11px] font-semibold',
                    done ? 'border-brand bg-brand text-white' : cur ? 'border-brand bg-white text-brand' : 'border-line text-ink-muted',
                  )}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn(cur ? 'font-semibold text-brand-strong' : done ? 'text-ink-strong' : 'text-ink-muted')}>{s}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="card flex min-w-0 flex-col overflow-hidden">
        {title && <div className="border-b border-line-subtle px-5 py-4">{title}</div>}
        <div className="p-5">{children}</div>
        <div className="flex items-center gap-2 border-t border-line-subtle bg-surface-sunken px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}
