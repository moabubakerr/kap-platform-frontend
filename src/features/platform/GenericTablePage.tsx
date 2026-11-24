import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import type { GenCell, GenTable } from '@/mocks/platform';

const cellText = (c: GenCell) => (Array.isArray(c) ? c[0] : c);

/**
 * The design's generic list screen (pModels, pMcp, pQueues, pUsers, pAudit):
 * title + count, description, primary action, name filter, status filter and
 * a plain table with a trailing Status pill column.
 */
export function GenericTablePage({ data }: { data: GenTable | undefined }) {
  const nav = useNavigate();
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);

  if (!data) {
    return (
      <Page className="gap-4 pt-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
        <Skeleton className="h-[34px] w-[280px]" />
        <Skeleton className="h-56" />
      </Page>
    );
  }

  const statuses = Array.from(new Set(data.rows.map((r) => r.statusLabel)));
  const rows = data.rows.filter(
    (r) => (!status || r.statusLabel === status) && (!q || r.cells.some((c) => cellText(c).toLowerCase().includes(q.toLowerCase()))),
  );

  return (
    <Page className="gap-4 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <h1 className="h1">
            {data.title} <span className="text-[15px] font-medium text-ink-muted">{data.rows.length}</span>
          </h1>
          <p className="mt-1 text-ink-muted">{data.desc}</p>
        </div>
        <Button onClick={() => toast('Read-only in this version')}>
          <Plus size={15} />
          {data.button}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-[34px] w-[280px] max-w-full items-center gap-2 rounded-card border border-line bg-surface px-2.5 text-ink-subtle">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-strong outline-none placeholder:text-ink-subtle"
          />
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-sm border border-line bg-surface px-3 text-[13px] text-ink-body hover:border-brand"
            >
              Status: {status ?? 'any'}
              <ChevronDown size={14} />
            </button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem onSelect={() => setStatus(null)}>Any</MenuItem>
            {statuses.map((s) => (
              <MenuItem key={s} onSelect={() => setStatus(s)}>
                {s}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>

      <div className="card overflow-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
              {[...data.cols, 'Status'].map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-[9px] font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                onClick={r.to ? () => nav(r.to!) : undefined}
                className={cn('border-t border-line-subtle', r.to && 'cursor-pointer hover:bg-surface-hover')}
              >
                {r.cells.map((c, j) => {
                  const mono = Array.isArray(c);
                  // Last plain-text column is muted (design: i === r.length - 3).
                  const muted = !mono && j > 0 && j === r.cells.length - 1;
                  return (
                    <td
                      key={j}
                      className={cn('px-3 py-[9px]', mono ? 'font-mono font-medium text-ink-body' : muted ? 'text-ink-muted' : 'text-ink-body')}
                    >
                      {cellText(c)}
                    </td>
                  );
                })}
                <td className="px-3 py-[9px]">
                  <StatusPill status={r.status} label={r.statusLabel} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="border-t border-line-subtle">
                <td colSpan={data.cols.length + 1} className="px-3 py-8 text-center text-ink-muted">
                  No matches
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
