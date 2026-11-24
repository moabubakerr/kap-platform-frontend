import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { Page, PageHeader } from '@/components/common/layout';
import { DataTable, FilterChip, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { usePackages } from '@/api/data';
import type { IngestPackage } from '@/mocks/data';
import { PageLoading, readOnly } from '@/features/catalogue/shared';

export default function PackagesPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = usePackages();
  const [search, setSearch] = React.useState('');

  const columns = React.useMemo<ColumnDef<IngestPackage, any>[]>(
    () => [
      { accessorKey: 'name', header: 'Package', cell: (c) => <span className="font-mono text-[12.5px] font-medium text-brand">{c.getValue()}</span> },
      { accessorKey: 'files', header: 'Files' },
      {
        accessorKey: 'collection',
        header: 'Collection',
        cell: (c) => (
          <Link to={`${base}/collections/${c.getValue()}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] font-medium">
            {c.getValue()}
          </Link>
        ),
      },
      { accessorKey: 'submittedBy', header: 'Submitted by' },
      { accessorKey: 'submitted', header: 'Submitted', cell: (c) => <span className="whitespace-nowrap text-ink-muted">{c.getValue()}</span> },
      { id: 'status', header: 'Status', accessorFn: (r) => r.statusLabel, cell: ({ row }) => <StatusPill status={row.original.status} label={row.original.statusLabel} /> },
    ],
    [base],
  );

  return (
    <ProjectPage resource="ingest packages">
      {isLoading ? (
        <PageLoading />
      ) : (
        <Page className="gap-4">
          <PageHeader
            title="Ingest packages"
            count={data?.length ?? 0}
            description="Versioned bundles of source files submitted for ingestion."
            actions={
              <Button onClick={readOnly}>
                <Plus size={15} strokeWidth={1.75} />
                Upload package
              </Button>
            }
          />
          <ListToolbar search={search} onSearch={setSearch} placeholder="Filter by name" chips={<FilterChip>Status: any</FilterChip>} />
          <DataTable
            data={data ?? []}
            columns={columns}
            globalFilter={search}
            onRowClick={(r) => nav(r.run ? `${base}/ingestion?run=${r.run}` : `${base}/collections/${r.collection}/files`)}
            emptyTitle="No packages match"
          />
        </Page>
      )}
    </ProjectPage>
  );
}
