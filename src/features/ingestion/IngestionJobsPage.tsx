import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Play, TriangleAlert } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { Page, PageHeader, SideDrawer } from '@/components/common/layout';
import { DataTable, FilterChip, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { KeyValues } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { usePipelineRuns, usePipelines } from '@/api/data';
import { pipelineByName, type PipelineRun } from '@/mocks/data';
import { PageLoading, readOnly } from '@/features/catalogue/shared';
import { RunSegments, SEG_COLOR, SEG_LABEL } from '@/features/pipelines/runParts';

export default function IngestionJobsPage() {
  const base = useBase();
  const [params, setParams] = useSearchParams();
  const { data: runs, isLoading } = usePipelineRuns();
  const { data: pipes } = usePipelines();
  const [search, setSearch] = React.useState('');
  const pipeline = params.get('pipeline');
  const runId = params.get('run');
  const sel = runs?.find((r) => String(r.id) === runId);
  useCrumbs([sel?.label]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v == null) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const columns = React.useMemo<ColumnDef<PipelineRun, any>[]>(
    () => [
      { accessorKey: 'label', header: 'Run', sortingFn: (a, b) => a.original.id - b.original.id, cell: (c) => <span className="whitespace-nowrap font-mono text-[12.5px] font-medium text-brand">{c.getValue()}</span> },
      {
        accessorKey: 'pipeline',
        header: 'Pipeline',
        cell: (c) => (
          <Link to={`${base}/pipelines`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] font-medium">
            {c.getValue()}
          </Link>
        ),
      },
      { id: 'steps', header: 'Steps', enableSorting: false, cell: ({ row }) => <RunSegments segs={row.original.segs} /> },
      {
        accessorKey: 'rows',
        header: 'Rows',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.rows}
            {row.original.skipped && ` · ${row.original.skipped.length} skipped`}
          </span>
        ),
      },
      { accessorKey: 'duration', header: 'Duration', cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span> },
      { accessorKey: 'triggeredBy', header: 'Triggered by', cell: (c) => <span className="whitespace-nowrap text-ink-muted">{c.getValue()}</span> },
      { accessorKey: 'started', header: 'Started', sortingFn: (a, b) => a.original.ageDays - b.original.ageDays, cell: (c) => <span className="whitespace-nowrap text-ink-muted">{c.getValue()}</span> },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.statusLabel,
        cell: ({ row }) => (
          <div>
            <StatusPill status={row.original.status} label={row.original.statusLabel} />
            {row.original.reason && <div className="mt-[3px] text-[11.5px] text-danger-fg">{row.original.reason}</div>}
            {row.original.skipped && <div className="mt-[3px] text-[11.5px] text-warning-fg">Skipped {row.original.skipped.join(', ')}</div>}
          </div>
        ),
      },
    ],
    [base],
  );

  if (isLoading) return <PageLoading />;
  const data = (runs ?? []).filter((r) => !pipeline || r.pipeline === pipeline);

  return (
    <ProjectPage resource="ingestion jobs">
      <div className="flex min-h-full">
        <div className="min-w-0 flex-1">
          <Page className="gap-4">
            <PageHeader
              title="Ingestion jobs"
              count={data.length}
              description="Pipeline runs on the kap.pipeline queue."
              actions={
                <Button onClick={readOnly}>
                  <Play size={15} strokeWidth={1.75} />
                  Run pipeline
                </Button>
              }
            />
            <ListToolbar
              search={search}
              onSearch={setSearch}
              placeholder="Filter by run or pipeline"
              chips={
                <>
                  <FilterChip on={!pipeline} onClick={() => set('pipeline', null)}>
                    All pipelines
                  </FilterChip>
                  {(pipes ?? []).map((p) => (
                    <FilterChip key={p.name} on={pipeline === p.name} onClick={() => set('pipeline', pipeline === p.name ? null : p.name)} count={(runs ?? []).filter((r) => r.pipeline === p.name).length}>
                      {p.name}
                    </FilterChip>
                  ))}
                </>
              }
            />
            <DataTable
              data={data}
              columns={columns}
              globalFilter={search}
              onRowClick={(r) => set('run', String(r.id))}
              rowClassName={(r) => (String(r.id) === runId ? 'bg-brand-tint' : undefined)}
              emptyTitle="No runs match"
            />
          </Page>
        </div>
        {sel && (
          <div className="sticky top-0 flex h-[calc(100vh-56px)]">
            <SideDrawer
              open
              onClose={() => set('run', null)}
              title={
                <div>
                  <div className="font-mono text-[15px] font-semibold text-ink-strong">{sel.label}</div>
                  <div className="font-mono text-xs text-ink-muted">{sel.pipeline}</div>
                </div>
              }
              footer={
                <Button variant="outline" onClick={readOnly}>
                  <Play size={15} strokeWidth={1.75} />
                  Re-run
                </Button>
              }
            >
              <RunDetail run={sel} base={base} />
            </SideDrawer>
          </div>
        )}
      </div>
    </ProjectPage>
  );
}

function RunDetail({ run, base }: { run: PipelineRun; base: string }) {
  const p = pipelineByName(run.pipeline);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <StatusPill status={run.status} label={run.statusLabel} />
        {run.reason && <div className="mt-2 text-[12.5px] text-danger-fg">{run.reason}</div>}
      </div>
      <KeyValues
        cols="110px 1fr"
        rows={[
          [
            'Pipeline',
            <Link to={`${base}/pipelines`} className="font-mono text-[12.5px]">
              {run.pipeline}
            </Link>,
          ],
          [
            'Collection',
            <Link to={`${base}/collections/sceai_indicators`} className="font-mono text-[12.5px]">
              sceai_indicators
            </Link>,
          ],
          ['Rows ingested', <span className="font-mono">{run.rows}</span>],
          ['Errors', <span className="font-mono">{run.errors}</span>],
          ['Duration', <span className="font-mono">{run.duration}</span>],
          ['Triggered by', run.triggeredBy],
          ['Started', run.started],
          ['Queue', <span className="font-mono">kap.pipeline</span>],
        ]}
      />
      {p && (
        <div>
          <div className="mb-2 text-xs font-semibold text-ink-muted">Steps</div>
          <div className="flex flex-col">
            {p.steps.map((s, i) => {
              const st = run.segs[i] ?? '-';
              return (
                <div key={s.name} className="flex items-center gap-2.5 border-t border-line-subtle py-2 text-[13px]">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: SEG_COLOR[st] }} />
                  <span className="w-16 flex-none font-medium text-ink-strong">{s.name}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-muted">{s.detail}</span>
                  <span className="flex-none text-xs text-ink-muted">{SEG_LABEL[st]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {run.skipped && (
        <div className="flex gap-2 rounded-card bg-warning-bg p-3 text-[12.5px] text-warning-fg">
          <TriangleAlert size={16} strokeWidth={1.75} className="mt-px flex-none" />
          <div>
            <b>1 file skipped.</b> {run.skipped.join(', ')} could not be parsed. Re-upload a clean copy to include it.
            <div className="mt-1">
              <Link to={`${base}/collections/sceai_indicators/files`}>View source files</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
