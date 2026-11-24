import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, Plus } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { DataTable, FilterChip, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useProviders } from '@/api/agents';
import { agentById } from '@/mocks/core';
import type { Provider } from '@/mocks/agents';
import { readOnly } from '@/features/agents/shared';

const mono = 'font-mono text-[12.5px]';
const KINDS = ['any', 'Chat', 'Embedding'] as const;

export default function ProvidersPage() {
  return (
    <ProjectPage resource="model providers">
      <Providers />
    </ProjectPage>
  );
}

function Providers() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useProviders();
  const [q, setQ] = React.useState('');
  const [kind, setKind] = React.useState(0);

  const columns = React.useMemo<ColumnDef<Provider, any>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row: { original: p } }) => (
          <div className="flex items-center gap-2.5">
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-sm bg-surface-sunken text-model">
              <Cpu size={16} strokeWidth={1.75} />
            </span>
            <span className="font-mono text-[12.5px] font-semibold text-brand">{p.name}</span>
          </div>
        ),
      },
      { id: 'kind', header: 'Kind', accessorKey: 'kind' },
      { id: 'model', header: 'Model', accessorKey: 'model', cell: (c) => <span className={mono}>{c.getValue()}</span> },
      { id: 'endpoint', header: 'Endpoint', accessorKey: 'endpoint', cell: (c) => <span className={`${mono} text-ink-muted`}>{c.getValue()}</span> },
      {
        id: 'usedBy',
        header: 'Used by',
        accessorKey: 'usedBy',
        enableSorting: false,
        cell: ({ row: { original: p } }) => (
          <div className="min-w-0">
            <div>{p.usedBy}</div>
            <div className="truncate text-xs text-ink-muted" style={{ maxWidth: 320 }}>
              {[...p.usedByAgents, ...p.usedByCollections].map((n, i) => {
                const a = agentById(n);
                return (
                  <React.Fragment key={n}>
                    {i > 0 && ', '}
                    <Link
                      to={a ? `${base}/agents/${a.id}` : `${base}/collections/${n}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-ink-muted hover:text-brand"
                    >
                      {a?.name ?? n}
                    </Link>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ),
      },
      { id: 'load', header: () => <span className="block text-right">Load</span>, accessorKey: 'load', cell: (c) => <div className={`${mono} text-right`}>{c.getValue()}</div> },
      { id: 'p95', header: () => <span className="block text-right">p95</span>, accessorKey: 'p95', cell: (c) => <div className={`${mono} text-right`}>{c.getValue()}</div> },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: (c) => <StatusPill status={c.getValue()} /> },
    ],
    [base],
  );

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter(
      (p) =>
        (!s || p.name.toLowerCase().includes(s) || p.model.toLowerCase().includes(s)) && (KINDS[kind] === 'any' || p.kind.startsWith(KINDS[kind])),
    );
  }, [data, q, kind]);

  return (
    <Page className="gap-4 pt-3">
      <PageHeader
        title="Model providers"
        count={data?.length ?? 3}
        description={
          <>
            LLM and embedding endpoints available to agents and pipelines. Models are served by <Link to="/platform/models">KAP platform model serving</Link>.
          </>
        }
        actions={
          <Button onClick={readOnly}>
            <Plus size={16} />
            Add provider
          </Button>
        }
      />
      <ListToolbar
        search={q}
        onSearch={setQ}
        placeholder="Filter by name or model"
        chips={
          <FilterChip on={kind > 0} onClick={() => setKind((kind + 1) % KINDS.length)}>
            Kind: {KINDS[kind]}
          </FilterChip>
        }
      />
      {isLoading ? (
        <Skeleton className="h-[200px]" />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          emptyTitle="No providers match these filters"
          onRowClick={(p) => nav(p.usedByCollections.length ? `${base}/collections/${p.usedByCollections[0]}` : `${base}/agents/${p.usedByAgents[0] ?? ''}`)}
        />
      )}
    </Page>
  );
}
