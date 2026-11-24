import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { Page, PageHeader } from '@/components/common/layout';
import { DataTable, FilterChip, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { useConnectors } from '@/api/data';
import type { Connector } from '@/mocks/data';
import { PageLoading, readOnly } from '@/features/catalogue/shared';

export default function ConnectorsPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useConnectors();
  const [search, setSearch] = React.useState('');

  const columns = React.useMemo<ColumnDef<Connector, any>[]>(
    () => [
      { accessorKey: 'name', header: 'Name', cell: (c) => <span className="font-mono text-[12.5px] font-medium text-brand">{c.getValue()}</span> },
      { accessorKey: 'type', header: 'Type', cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span> },
      { accessorKey: 'location', header: 'Location', cell: (c) => <span className="font-mono text-[12.5px] font-medium">{c.getValue()}</span> },
      { accessorKey: 'credentials', header: 'Credentials', cell: (c) => <span className="font-mono text-[12.5px] font-medium">{c.getValue()}</span> },
      {
        accessorKey: 'pipeline',
        header: 'Feeds',
        cell: (c) => (
          <Link to={`${base}/pipelines`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px]">
            {c.getValue()}
          </Link>
        ),
      },
      { accessorKey: 'lastSync', header: 'Last sync', cell: (c) => <span className="whitespace-nowrap text-ink-muted">{c.getValue()}</span> },
      { id: 'status', header: 'Status', accessorFn: (r) => r.statusLabel, cell: ({ row }) => <StatusPill status={row.original.status} label={row.original.statusLabel} /> },
    ],
    [base],
  );

  return (
    <ProjectPage resource="connectors">
      {isLoading ? (
        <PageLoading />
      ) : (
        <Page className="gap-4">
          <PageHeader
            title="Connectors"
            count={data?.length ?? 0}
            description="Where source data is read from. Credentials are stored masked."
            actions={
              <Button onClick={readOnly}>
                <Plus size={15} strokeWidth={1.75} />
                Create connector
              </Button>
            }
          />
          <ListToolbar search={search} onSearch={setSearch} placeholder="Filter by name" chips={<FilterChip>Status: any</FilterChip>} />
          <DataTable data={data ?? []} columns={columns} globalFilter={search} onRowClick={(r) => nav(`${base}/ingestion?pipeline=${r.pipeline}`)} emptyTitle="No connectors match" />
        </Page>
      )}
    </ProjectPage>
  );
}
