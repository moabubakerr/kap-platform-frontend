/**
 * Small bespoke pieces of the platform screens (markup blocks showPModels,
 * showPMcp, s.pHome, s.tenants): modal shell, segmented control, toggle chips,
 * key/value lines, inline banners and the success toast strip.
 */
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({ title, sub, mono, width = 720, onClose, footer, children, z = 81 }: { title: string; sub?: string; mono?: boolean; width?: number; onClose: () => void; footer: React.ReactNode; children: React.ReactNode; z?: number }) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[rgba(31,26,28,.35)]" style={{ zIndex: z - 1 }} />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 flex max-h-[calc(100vh-64px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-surface shadow-xl outline-none" style={{ width, zIndex: z }}>
          <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className={cn('text-[17px] font-semibold text-ink-strong', mono && 'font-mono')}>{title}</Dialog.Title>
              {sub && <div className="text-[12.5px] text-ink-muted">{sub}</div>}
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="flex rounded p-1 text-ink-muted hover:text-ink-strong">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-auto">{children}</div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-subtle px-5 py-3">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Segmented control: [key, label, disabled?]. */
export function Seg<K extends string>({ opts, cur, pick, ro }: { opts: [K, string, boolean?][]; cur: K; pick: (k: K) => void; ro?: boolean }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-line">
      {opts.map(([k, n, dis]) => {
        const on = cur === k;
        return (
          <button
            key={k}
            type="button"
            disabled={ro || dis}
            onClick={() => !on && pick(k)}
            className={cn('whitespace-nowrap px-3 py-1.5 text-[12.5px]', on ? 'bg-brand text-white' : dis ? 'bg-surface text-ink-subtle' : 'bg-surface text-ink-strong', (ro || dis) && 'cursor-default', dis && 'cursor-not-allowed')}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle chip (check / plus mark). */
export function Chip({ n, on, toggle, tip, off, ro }: { n: string; on: boolean; toggle: () => void; tip?: string; off?: boolean; ro?: boolean }) {
  return (
    <button
      type="button"
      title={tip}
      onClick={() => !off && !ro && toggle()}
      className={cn('inline-flex h-[30px] select-none items-center gap-1.5 rounded-sm border px-2.5 text-[12.5px]', on ? 'border-brand bg-brand-tint' : 'border-line bg-surface', off && 'cursor-not-allowed opacity-45', ro && 'cursor-default')}
    >
      <span className={on ? 'text-brand' : 'text-ink-muted'}>{on ? <Check size={12} /> : <Plus size={12} />}</span>
      {n}
    </button>
  );
}

export function KvLines({ rows, w = 150 }: { rows: [string, string, boolean?][]; w?: number }) {
  return (
    <>
      {rows.map(([k, v, m]) => (
        <div key={k} className="flex gap-3 border-b border-dashed border-line-subtle py-[5px] text-[13px]">
          <span className="flex-none text-ink-muted" style={{ width: w }}>
            {k}
          </span>
          <span className={cn('text-[12.5px] [overflow-wrap:anywhere]', m && 'font-mono')}>{v}</span>
        </div>
      ))}
    </>
  );
}

export type TestState = { s: 'busy' | 'ok' | 'fail'; m?: string } | null;

export function TestBanner({ t, busyL = 'Testing…' }: { t: TestState; busyL?: string }) {
  if (!t) return null;
  if (t.s === 'busy') return <div className="rounded-sm bg-info-bg px-3 py-[9px] text-[13px] text-info">{busyL}</div>;
  return <div className={cn('rounded-sm px-3 py-[9px] text-[13px]', t.s === 'ok' ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}>{t.m}</div>;
}

export function ErrBanner({ err }: { err: string }) {
  return err ? <div className="rounded-sm bg-danger-bg px-3 py-2.5 text-[13px] text-danger-fg">{err}</div> : null;
}

/** The inline success strip shown under a page title (regToast / mcpToast). */
export function useBanner() {
  const [msg, setMsg] = React.useState('');
  const timer = React.useRef<number>();
  const show = React.useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), 3500);
  }, []);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = msg ? (
    <div className="flex items-center gap-2 rounded-card bg-success-bg px-3.5 py-2.5 text-[13px] text-success-fg">
      <Check size={14} />
      {msg}
    </div>
  ) : null;
  return { show, node };
}

export function AdvToggle({ open, set, label = 'Advanced settings' }: { open: boolean; set: (o: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => set(!open)} className="inline-flex select-none items-center gap-1.5 text-[13px] font-medium text-ink-strong">
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      {label}
    </button>
  );
}

export const inputCls = 'h-9 w-full rounded-card border border-line bg-surface px-3 text-[13.5px] text-ink-body outline-none focus-visible:shadow-focus disabled:bg-surface-sunken disabled:text-ink-muted';

export function TextIn({ label, value, set, ph, disabled, tip }: { label: string; value: string; set: (v: string) => void; ph?: string; disabled?: boolean; tip?: string }) {
  return (
    <label className="flex flex-col gap-1.5" title={tip}>
      <span className="text-[13px] font-medium text-ink-strong">{label}</span>
      <input value={value} placeholder={ph} disabled={disabled} onChange={(e) => set(e.target.value)} className={inputCls} />
    </label>
  );
}

export function SelectIn({ label, value, set, opts, disabled }: { label: string; value: string; set: (v: string) => void; opts: string[]; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-strong">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => set(e.target.value)} className={inputCls}>
        {opts.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Card({ title, right, children, className }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-card border border-line-subtle bg-surface', className)}>
      {title != null && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
          <div className="font-semibold text-ink-strong">{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export const thCls = 'whitespace-nowrap px-3 py-[9px] text-left text-xs font-semibold text-ink-muted';
export const theadCls = 'bg-surface-sunken';

export function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="whitespace-nowrap font-medium text-brand hover:underline"
    >
      {children}
    </button>
  );
}

export function DetailsBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={`View details: ${label}`}
      title="View details"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-0.5 whitespace-nowrap rounded px-0.5 py-1 text-[12.5px] text-ink-muted hover:text-ink-strong"
    >
      Details
      <ChevronRight size={14} />
    </button>
  );
}
