import * as React from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/ui/status-pill';
import { SOURCE_COLOR } from '@/mocks/core';
import type { Job } from '@/types';

export const readOnly = () => toast('Read-only in this version');

export const TOOL_SRC: Record<'local' | 'documents' | 'oxford', { label: string; color: string }> = {
  local: { label: 'Local data', color: SOURCE_COLOR.local },
  documents: { label: 'Documents', color: SOURCE_COLOR.documents },
  oxford: { label: 'Oxford (external)', color: SOURCE_COLOR.oxford },
};

/** 8px square + mono tool name. */
export function ToolName({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[12.5px]">
      <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: color }} />
      {name}
    </span>
  );
}

/** Small 12px spinner ring in the info colour (design: border 2px, top transparent). */
export function Spinner({ color = 'var(--info)', className }: { color?: string; className?: string }) {
  return <span className={cn('inline-block h-3 w-3 flex-none animate-spin rounded-full border-2', className)} style={{ borderColor: color, borderTopColor: 'transparent' }} />;
}

/** Job row: status · id · question · duration · when (agent overview + jobs tab). */
export function JobLine({ job, onClick, dense }: { job: Job; onClick: () => void; dense?: boolean }) {
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={cn(
        'grid cursor-pointer items-center gap-2.5 border-t border-line-subtle px-4 text-[13px] hover:bg-surface-hover',
        dense ? 'py-2' : 'py-[9px]',
      )}
      style={{ gridTemplateColumns: '100px 90px minmax(0,1fr) 70px 80px' }}
    >
      <span>
        <StatusPill status={job.status} />
      </span>
      <span className="font-mono text-[12.5px]">{job.id}…</span>
      <span className="ellipsis truncate" title={job.question}>
        {job.question}
      </span>
      <span className="text-right font-mono text-[12.5px]">{job.duration}</span>
      <span className="whitespace-nowrap text-right text-ink-muted" title={job.abs}>
        {job.rel}
      </span>
    </div>
  );
}

export function CardHead({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
      <div className="font-semibold text-ink-strong">{title}</div>
      {children}
    </div>
  );
}

/** Plain table used inside cards (design tables, not TanStack). */
export function SimpleTable({ head, children, minWidth = 680 }: { head: { label: string; right?: boolean }[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
            {head.map((h) => (
              <th key={h.label} className={cn('whitespace-nowrap px-3 py-[9px] font-semibold', h.right && 'text-right')}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const tdc = 'border-t border-line-subtle px-3 py-[9px]';
