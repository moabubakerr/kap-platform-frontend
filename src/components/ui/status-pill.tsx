import { cn } from '@/lib/utils';

/**
 * Status vocabulary used across the console (README §9):
 * running→info, succeeded/approved→green, failed/rejected→red,
 * waiting/queued/cancelled→neutral, partial/hold/degraded→amber.
 */
export type Status =
  | 'running'
  | 'succeeded'
  | 'approved'
  | 'healthy'
  | 'active'
  | 'failed'
  | 'rejected'
  | 'down'
  | 'waiting'
  | 'queued'
  | 'cancelled'
  | 'draft'
  | 'partial'
  | 'hold'
  | 'degraded'
  | 'warning'
  | 'retired';

type Look = { dot: string; fg: string; bg: string; label: string };

const LOOKS: Record<Status, Look> = {
  running: { dot: 'var(--info)', fg: 'var(--info)', bg: 'var(--info-bg)', label: 'Running' },
  succeeded: { dot: 'var(--success)', fg: 'var(--success-fg)', bg: 'var(--success-bg)', label: 'Succeeded' },
  approved: { dot: 'var(--success)', fg: 'var(--success-fg)', bg: 'var(--success-bg)', label: 'Approved' },
  healthy: { dot: 'var(--success)', fg: 'var(--success-fg)', bg: 'var(--success-bg)', label: 'Healthy' },
  active: { dot: 'var(--success)', fg: 'var(--success-fg)', bg: 'var(--success-bg)', label: 'Active' },
  failed: { dot: 'var(--danger)', fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', label: 'Failed' },
  rejected: { dot: 'var(--danger)', fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', label: 'Rejected' },
  down: { dot: 'var(--danger)', fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', label: 'Down' },
  waiting: { dot: 'var(--neutral-500)', fg: 'var(--neutral-700)', bg: 'var(--neutral-100)', label: 'Waiting' },
  queued: { dot: 'var(--neutral-500)', fg: 'var(--neutral-700)', bg: 'var(--neutral-100)', label: 'Queued' },
  cancelled: { dot: 'var(--neutral-500)', fg: 'var(--neutral-700)', bg: 'var(--neutral-100)', label: 'Cancelled' },
  draft: { dot: 'var(--neutral-500)', fg: 'var(--neutral-700)', bg: 'var(--neutral-100)', label: 'Draft' },
  retired: { dot: 'var(--neutral-500)', fg: 'var(--neutral-700)', bg: 'var(--neutral-100)', label: 'Retired' },
  partial: { dot: 'var(--warning)', fg: 'var(--warning-fg)', bg: 'var(--warning-bg)', label: 'Partial' },
  hold: { dot: 'var(--warning)', fg: 'var(--warning-fg)', bg: 'var(--warning-bg)', label: 'On hold' },
  degraded: { dot: 'var(--warning)', fg: 'var(--warning-fg)', bg: 'var(--warning-bg)', label: 'Degraded' },
  warning: { dot: 'var(--warning)', fg: 'var(--warning-fg)', bg: 'var(--warning-bg)', label: 'Warning' },
};

export function StatusPill({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const s = LOOKS[status];
  return (
    <span
      className={cn('inline-flex h-[26px] items-center gap-[7px] whitespace-nowrap rounded-card pl-2.5 pr-3 text-xs font-semibold', className)}
      style={{ color: s.fg, background: s.bg }}
    >
      <span className={cn('h-[7px] w-[7px] flex-none rounded-full', status === 'running' && 'animate-pulse')} style={{ background: s.dot }} />
      {label ?? s.label}
    </span>
  );
}

/** Small coloured health dot used on tiles, nodes and lists. */
export function HealthDot({ tone, className }: { tone: 'ok' | 'warn' | 'bad' | 'idle'; className?: string }) {
  const c = { ok: 'var(--success)', warn: 'var(--warning)', bad: 'var(--danger)', idle: '#A8A0A3' }[tone];
  return <span className={cn('inline-block h-[7px] w-[7px] flex-none rounded-full', className)} style={{ background: c }} />;
}
