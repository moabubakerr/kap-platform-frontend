import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { Page, PageHeader } from '@/components/common/layout';
import { DataTable, FilterChip, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { useCatalogue, useCatalogueVersions } from '@/api/catalogue';
import { CATALOGUE_COUNT, type Frequency, type Indicator } from '@/mocks/catalogue';
import { PageLoading, Panel } from './shared';

const FREQS: (Frequency | 'any')[] = ['any', 'Quarterly', 'Monthly', 'Annual'];
const STATUSES = ['published', 'draft', 'any'] as const;

const columns: ColumnDef<Indicator, any>[] = [
  {
    id: 'name',
    header: 'Indicator',
    accessorFn: (r) => `${r.nameEn} ${r.nameAr} ${r.aliasesEn.join(' ')} ${r.aliasesAr.join(' ')} ${r.code}`,
    sortingFn: (a, b) => a.original.nameEn.localeCompare(b.original.nameEn),
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="font-medium text-brand">{row.original.nameEn}</div>
        <div dir="auto" className="text-left text-xs text-ink-muted">
          {row.original.nameAr}
        </div>
      </div>
    ),
  },
  { accessorKey: 'code', header: 'Code', cell: (c) => <span className="whitespace-nowrap font-mono text-[12.5px]">{c.getValue()}</span> },
  { accessorKey: 'frequency', header: 'Freq.' },
  { accessorKey: 'coverage', header: 'Coverage', cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span> },
  { accessorKey: 'periods', header: 'Periods', cell: (c) => <span className="whitespace-nowrap font-mono text-xs">{c.getValue()}</span> },
  {
    id: 'aliases',
    header: () => <span className="block text-right">Aliases EN / AR</span>,
    accessorFn: (r) => r.aliasesEn.length,
    cell: ({ row }) => (
      <span className="block text-right font-mono text-[12.5px]">
        {row.original.aliasesEn.length} / {row.original.aliasesAr.length}
      </span>
    ),
  },
  { id: 'status', header: 'Status', accessorFn: (r) => r.statusLabel, cell: ({ row }) => <StatusPill status={row.original.status === 'retired' ? 'retired' : row.original.status} label={row.original.statusLabel} /> },
];

export default function CataloguePage() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useCatalogue();
  const { data: versions } = useCatalogueVersions();
  const [search, setSearch] = React.useState('');
  const [freq, setFreq] = React.useState(0);
  const [status, setStatus] = React.useState(0);

  const rows = React.useMemo(() => {
    const f = FREQS[freq];
    const s = STATUSES[status];
    return (data ?? []).filter(
      (r) =>
        (f === 'any' || r.frequency === f) &&
        // "published" = everything in the published catalogue scope, including entries queued for the next version.
        (s === 'any' || (s === 'published' ? r.status !== 'retired' : r.status === 'hold')),
    );
  }, [data, freq, status]);

  return (
    <ProjectPage resource="catalogue entries">
      {isLoading ? (
        <PageLoading />
      ) : (
        <Page className="gap-4">
          <PageHeader
            title="Catalogue"
            count={`${CATALOGUE_COUNT} indicators`}
            description="Indicators the Ask AI assistant can answer about. The Indicator Picker may only choose names from the published version."
            actions={
              <Button onClick={() => nav(`${base}/catalogue/publish`)}>
                <Upload size={15} strokeWidth={1.75} />
                Publish new version
              </Button>
            }
          />
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <div className="flex min-w-0 flex-col gap-3">
              <ListToolbar
                search={search}
                onSearch={setSearch}
                placeholder="Search name, alias or code"
                chips={
                  <>
                    <FilterChip on={freq !== 0} onClick={() => setFreq((freq + 1) % FREQS.length)}>
                      Frequency: {FREQS[freq] === 'any' ? 'any' : FREQS[freq]}
                    </FilterChip>
                    <FilterChip on={STATUSES[status] !== 'any'} onClick={() => setStatus((status + 1) % STATUSES.length)}>
                      Status: {STATUSES[status]}
                    </FilterChip>
                  </>
                }
              />
              <DataTable data={rows} columns={columns} globalFilter={search} onRowClick={(r) => nav(`${base}/catalogue/${r.code}`)} emptyTitle="No indicators match" />
            </div>
            <Panel title="Version history" className="self-start">
              {(versions ?? []).map((v, i) => (
                <div key={v.version} className={i > 0 ? 'border-t border-line-subtle px-4 py-3' : 'px-4 py-3'} style={{ background: v.current ? 'var(--brand-tint)' : undefined }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12.5px] font-semibold text-ink-strong">{v.version}</span>
                    <span className="text-[11.5px] font-semibold text-brand">{v.tag}</span>
                  </div>
                  <div className="mt-0.5 text-[12.5px]">{v.note}</div>
                  <div className="text-xs text-ink-muted">
                    {v.by} · {v.when}
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </Page>
      )}
    </ProjectPage>
  );
}
