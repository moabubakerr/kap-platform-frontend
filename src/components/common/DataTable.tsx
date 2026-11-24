import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Columns3, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from './primitives';

export type { ColumnDef };

/**
 * TanStack table in the console style: sunken header, 13px cells with
 * 9px×12px padding, hairline row dividers, sortable headers, optional row
 * selection with a bulk bar, and pagination.
 */
export function DataTable<T>({
  data,
  columns,
  onRowClick,
  selectable,
  bulkActions,
  pageSize = 15,
  globalFilter,
  emptyTitle = 'Nothing here yet',
  rowClassName,
  dense,
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  bulkActions?: React.ReactNode;
  pageSize?: number;
  globalFilter?: string;
  emptyTitle?: string;
  rowClassName?: (row: T) => string | undefined;
  dense?: boolean;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const cols = React.useMemo<ColumnDef<T, any>[]>(() => {
    if (!selectable) return columns;
    const sel: ColumnDef<T, any> = {
      id: '_sel',
      size: 36,
      enableSorting: false,
      header: ({ table }) => <Box on={table.getIsAllPageRowsSelected()} onClick={() => table.toggleAllPageRowsSelected()} />,
      cell: ({ row }) => <Box on={row.getIsSelected()} onClick={() => row.toggleSelected()} />,
    };
    return [sel, ...columns];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: cols,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const selected = Object.keys(rowSelection).length;
  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;

  if (data.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div className="card overflow-hidden">
      {selectable && selected > 0 && (
        <div className="flex items-center gap-3 border-b border-brand-tint2 bg-brand-tint px-3 py-2 text-[13px]">
          <span className="font-semibold text-brand-strong">{selected} selected</span>
          <span className="text-ink-muted">·</span>
          {bulkActions}
          <button className="ml-auto text-[12.5px] text-ink-muted hover:text-ink-strong" onClick={() => setRowSelection({})}>
            Clear
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sort = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className={cn('th normal-case tracking-normal text-xs',h.column.getCanSort() && 'cursor-pointer select-none hover:text-ink-strong')}
                      style={{ width: h.column.columnDef.size !== 150 ? h.column.columnDef.size : undefined }}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sort === 'asc' && <ArrowUp size={11} />}
                        {sort === 'desc' && <ArrowDown size={11} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={onRowClick ? () => onRowClick(r.original) : undefined}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  r.getIsSelected() ? 'bg-brand-tint' : 'hover:bg-surface-hover',
                  rowClassName?.(r.original),
                )}
              >
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className={cn('td', dense && 'py-1.5')} onClick={c.column.id === '_sel' ? (e) => e.stopPropagation() : undefined}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > pageSize && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px] text-ink-muted">
          <span>
            {pageIndex * pageSize + 1}–{Math.min(total, (pageIndex + 1) * pageSize)} of {total}
          </span>
          <div className="flex gap-1">
            <Button variant="quiet" size="icon" className="h-7 w-7" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} aria-label="Previous page">
              <ChevronLeft size={14} />
            </Button>
            <Button variant="quiet" size="icon" className="h-7 w-7" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} aria-label="Next page">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn('grid h-4 w-4 place-items-center rounded-[3px] border', on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface')}
    >
      {on && <Check size={11} strokeWidth={3} />}
    </button>
  );
}

/** Toolbar: search, filter chips, date range, columns. */
export function ListToolbar({
  search,
  onSearch,
  placeholder = 'Search',
  chips,
  range,
  onRange,
  right,
}: {
  search: string;
  onSearch: (s: string) => void;
  placeholder?: string;
  chips?: React.ReactNode;
  range?: string;
  onRange?: (r: string) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-[34px] min-w-[220px] flex-1 items-center gap-2 rounded-card border border-line bg-surface px-2.5 text-ink-subtle sm:max-w-[320px]">
        <Search size={15} />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-strong outline-none placeholder:text-ink-subtle" />
      </div>
      {chips}
      {onRange && (
        <div className="inline-flex rounded-card border border-line bg-surface">
          {['Today', '24 h', '7 d', 'Custom'].map((r) => (
            <button
              key={r}
              onClick={() => onRange(r)}
              className={cn('h-8 border-r border-line-subtle px-3 text-[12.5px] last:border-r-0', range === r ? 'bg-brand-tint font-semibold text-brand-strong' : 'text-ink-muted hover:text-ink-strong')}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        {right}
        <Button variant="quiet" size="sm">
          <Columns3 size={15} />
          Columns
        </Button>
      </div>
    </div>
  );
}

/** Toggleable filter chip. */
export function FilterChip({ on, onClick, children, count }: { on?: boolean; onClick?: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-card border px-3 text-[12.5px]',
        on ? 'border-brand bg-brand-tint font-semibold text-brand-strong' : 'border-line bg-surface text-ink-body hover:border-brand',
      )}
    >
      {children}
      {count != null && <span className={cn('font-mono text-[11px]', on ? 'text-brand-strong' : 'text-ink-subtle')}>{count}</span>}
    </button>
  );
}
