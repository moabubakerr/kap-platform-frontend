import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { Page, PageHeader } from '@/components/common/layout';
import { DataTable, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { useCollections } from '@/api/data';
import { fmtInt } from '@/lib/utils';
import type { Collection } from '@/mocks/data';
import { PageLoading, readOnly } from '@/features/catalogue/shared';

export default function CollectionsPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useCollections();
  const [search, setSearch] = React.useState('');

  const columns = React.useMemo<ColumnDef<Collection, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Collection',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-mono text-[12.5px] font-medium text-brand">{row.original.name}</div>
            <div className="text-xs text-ink-muted">{row.original.description}</div>
          </div>
        ),
      },
      {
        id: 'contents',
        header: 'Contents',
        accessorFn: (r) => r.observations,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {fmtInt(row.original.observations)} observations · {row.original.chunks} chunks
          </span>
        ),
      },
      {
        id: 'embedding',
        header: 'Embedding',
        accessorFn: (r) => r.embedding.provider,
        cell: ({ row }) => <span className="font-mono text-[12.5px]">{row.original.embedding.provider}</span>,
      },
      {
        id: 'agents',
        header: 'Used by',
        accessorFn: (r) => r.agents.length,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            {row.original.agents.map((a) => (
              <a
                key={a}
                href={`${base}/agents/${a}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  nav(`${base}/agents/${a}`);
                }}
                className="font-mono text-[12.5px]"
              >
                {a}
              </a>
            ))}
          </div>
        ),
      },
      { accessorKey: 'lastIngestion', header: 'Last ingestion', cell: (c) => <span className="whitespace-nowrap text-ink-muted">{c.getValue()}</span> },
      { id: 'status', header: 'Status', cell: () => <StatusPill status="approved" label="Healthy" /> },
    ],
    [base, nav],
  );

  return (
    <ProjectPage resource="collections">
      {isLoading ? (
        <PageLoading />
      ) : (
        <Page className="gap-4">
          <PageHeader
            title="Collections"
            count={data?.length ?? 0}
            description="Indexed data that agents read: indicator observations and document chunks."
            actions={
              <Button onClick={readOnly}>
                <Plus size={15} strokeWidth={1.75} />
                Create collection
              </Button>
            }
          />
          <ListToolbar search={search} onSearch={setSearch} placeholder="Filter by name" />
          <DataTable data={data ?? []} columns={columns} globalFilter={search} onRowClick={(r) => nav(`${base}/collections/${r.id}`)} emptyTitle="No collections yet" />
        </Page>
      )}
    </ProjectPage>
  );
}
