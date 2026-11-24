import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { DataTable, FilterChip, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useAgents } from '@/api/core';
import type { Agent } from '@/types';

const mono = 'font-mono text-[12.5px]';
const STATUS_CYCLE = ['any', 'active', 'inactive'] as const;
const OX_CYCLE = ['any', 'yes', 'no'] as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function AgentsPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useAgents();
  const [q, setQ] = React.useState('');
  const [st, setSt] = React.useState(0);
  const [ox, setOx] = React.useState(0);

  const columns = React.useMemo<ColumnDef<Agent, any>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row: { original: a } }) => (
          <div className="flex items-center gap-2.5">
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-sm bg-[#F6E8EC] text-[#8A1538]">
              <Bot size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="font-mono text-[12.5px] font-semibold text-brand">{a.name}</div>
              <div className="text-xs text-ink-muted">{a.description}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        cell: ({ row: { original: a } }) => (
          <div>
            <div className={mono}>{a.type}</div>
            <div className="text-xs text-ink-muted">{a.group}</div>
          </div>
        ),
      },
      { id: 'model', header: 'Model', accessorKey: 'model', cell: (c) => <span className={mono}>{c.getValue()}</span> },
      {
        id: 'data',
        header: 'Data',
        accessorFn: (a) => a.collections.join(', ') || '—',
        cell: (c) => <span className={mono}>{c.getValue()}</span>,
      },
      {
        id: 'tools',
        header: () => <span className="block text-right">Tools</span>,
        accessorFn: (a) => a.toolsCount ?? -1,
        cell: ({ row: { original: a } }) => <div className={`${mono} text-right`}>{a.toolsCount ?? '—'}</div>,
      },
      {
        id: 'oxford',
        header: 'Oxford',
        accessorKey: 'oxford',
        cell: ({ row: { original: a } }) => <Badge tone={a.oxford ? 'info' : 'neutral'}>{a.oxford ? 'Yes' : 'No'}</Badge>,
      },
      {
        id: 'calls',
        header: () => <span className="block text-right">Calls · 24 h</span>,
        accessorKey: 'calls24h',
        cell: (c) => <div className={`${mono} text-right`}>{c.getValue()}</div>,
      },
      {
        id: 'success',
        header: () => <span className="block text-right">Success</span>,
        accessorKey: 'successRate',
        cell: (c) => <div className={`${mono} text-right`}>{c.getValue()}%</div>,
      },
      { id: 'status', header: 'Status', enableSorting: false, cell: () => <StatusPill status="active" /> },
    ],
    [],
  );

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter(
      (a) =>
        (!s || a.name.toLowerCase().includes(s) || a.model.toLowerCase().includes(s) || a.description.toLowerCase().includes(s)) &&
        // every agent is Active in this phase (design shows Active for all 8)
        STATUS_CYCLE[st] !== 'inactive' &&
        (OX_CYCLE[ox] === 'any' || a.oxford === (OX_CYCLE[ox] === 'yes')),
    );
  }, [data, q, st, ox]);

  return (
    <ProjectPage resource="agents">
      <Page className="gap-4 pt-3">
        <PageHeader
          title="Agents"
          count={data?.length ?? 8}
          description="All AI agents in the SCEAI project: 2 indicator agents that plan their own tool calls, and 6 narrow agents inside the Ask AI pipeline."
          actions={
            <Button onClick={() => nav(`${base}/agents/new`)}>
              <Plus size={16} />
              Create agent
            </Button>
          }
        />
        <ListToolbar
          search={q}
          onSearch={setQ}
          placeholder="Filter by name or model"
          chips={
            <>
              <FilterChip on={st > 0} onClick={() => setSt((st + 1) % STATUS_CYCLE.length)}>
                Status: {STATUS_CYCLE[st] === 'any' ? 'any' : cap(STATUS_CYCLE[st])}
              </FilterChip>
              <FilterChip on={ox > 0} onClick={() => setOx((ox + 1) % OX_CYCLE.length)}>
                Oxford enabled: {OX_CYCLE[ox] === 'any' ? 'any' : cap(OX_CYCLE[ox])}
              </FilterChip>
            </>
          }
        />
        {isLoading ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <DataTable data={rows} columns={columns} onRowClick={(a) => nav(`${base}/agents/${a.id}`)} emptyTitle="No agents match these filters" />
        )}
      </Page>
    </ProjectPage>
  );
}
