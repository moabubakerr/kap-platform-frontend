import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Page } from '@/components/common/layout';
import { CopyId, RelTime, Skeleton } from '@/components/common/primitives';
import { DataTable, ListToolbar, type ColumnDef } from '@/components/common/DataTable';
import { StatusPill } from '@/components/ui/status-pill';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useJobs } from '@/api/core';
import { useLiveTenant } from '@/api/live';
import { summarize } from '@/api/platformLive';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/primitives';
import { AGENTS, JOB_SUMMARY, USERS, agentById, userByName } from '@/mocks/core';
import { CURRENT_USER } from '@/mocks/projects';
import type { Job, JobStatus } from '@/types';
import { SelectChip, SummaryStrip } from './SelectChip';

const readOnly = () => toast('Read-only in this version');

type Filters = { status: 'any' | JobStatus; agent: string; user: string; range: string };
const ALL: Filters = { status: 'any', agent: 'any', user: 'any', range: '7 d' };
const VIEWS: { name: string; f: Filters }[] = [
  { name: 'All jobs', f: ALL },
  { name: 'My failed jobs', f: { ...ALL, status: 'failed', user: CURRENT_USER.username } },
  { name: 'Oxford jobs today', f: { ...ALL, agent: 'sceai_indicators_oxford', range: 'Today' } },
];
const same = (a: Filters, b: Filters) => a.status === b.status && a.agent === b.agent && a.user === b.user && a.range === b.range;

const STATUS_LABEL: Record<JobStatus, string> = { running: 'Running', succeeded: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled', queued: 'Queued' };
const RANGE_H: Record<string, number> = { Today: 14.4, '24 h': 24, '7 d': 168, Custom: Infinity };

export default function JobsPage() {
  return (
    <ProjectPage resource="agent jobs">
      <JobsView />
    </ProjectPage>
  );
}

function JobsView() {
  const base = useBase();
  const nav = useNavigate();
  const { data: jobs, isLoading, isError, refetch } = useJobs();
  const live = useLiveTenant();
  const [q, setQ] = React.useState('');
  const [f, setF] = React.useState<Filters>(ALL);
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));

  const newest = React.useMemo(() => Math.max(0, ...(jobs ?? []).map((j) => Date.parse(j.createdAt))), [jobs]);
  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return (jobs ?? [])
      .filter((j) => f.status === 'any' || j.status === f.status)
      .filter((j) => f.agent === 'any' || j.agent === f.agent)
      .filter((j) => f.user === 'any' || (userByName(j.user)?.username ?? j.user) === f.user)
      .filter((j) => (newest - Date.parse(j.createdAt)) / 3_600_000 <= RANGE_H[f.range])
      .filter((j) => !s || j.question.toLowerCase().includes(s) || j.id.includes(s) || j.uuid.includes(s) || j.user.toLowerCase().includes(s))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [jobs, q, f, newest]);

  const columns = React.useMemo<ColumnDef<Job, any>[]>(
    () => [
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusPill status={row.original.status} label={STATUS_LABEL[row.original.status]} />,
      },
      {
        id: 'id',
        header: 'Job ID',
        accessorKey: 'id',
        cell: ({ row }) => <CopyId id={row.original.uuid} className="whitespace-nowrap" />,
      },
      {
        id: 'agent',
        header: 'Agent',
        accessorKey: 'agent',
        cell: ({ row }) =>
          agentById(row.original.agent) ? (
            <Link to={`${base}/agents/${row.original.agent}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px]">
              {row.original.agent}
            </Link>
          ) : (
            <span className="font-mono text-[12.5px] text-ink-body">{row.original.agent}</span>
          ),
      },
      {
        id: 'user',
        header: 'User',
        accessorKey: 'user',
        cell: ({ row }) => {
          const u = userByName(row.original.user);
          return u ? (
            <Link to={`${base}/users/${u.username}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px]">
              {row.original.user}
            </Link>
          ) : (
            <span className="font-mono text-[12.5px] text-ink-body">{row.original.user}</span>
          );
        },
      },
      {
        id: 'question',
        header: 'Question',
        accessorKey: 'question',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="max-w-[360px]">
            <div className="ellipsis text-ink-strong" title={row.original.question}>
              {row.original.question}
            </div>
            {row.original.reason && <div className="text-xs text-danger-fg">{row.original.reason}</div>}
          </div>
        ),
      },
      {
        id: 'duration',
        header: () => <span className="block w-full text-right">Duration</span>,
        accessorKey: 'durationS',
        cell: ({ row }) => <div className="text-right font-mono text-[12.5px]">{row.original.duration}</div>,
      },
      {
        id: 'retries',
        header: () => <span className="block w-full text-right">Retries</span>,
        accessorKey: 'retries',
        cell: ({ row }) => <div className="text-right font-mono text-[12.5px]">{row.original.retries}</div>,
      },
      {
        id: 'created',
        header: 'Created',
        accessorFn: (j) => Date.parse(j.createdAt),
        cell: ({ row }) => <RelTime rel={row.original.rel} abs={row.original.abs} />,
      },
    ],
    [base],
  );

  const summary = live ? summarize(jobs ?? []) : JOB_SUMMARY;
  const agentOptions = live
    ? Array.from(new Set((jobs ?? []).map((j) => j.agent))).sort().map((a) => ({ value: a, label: a, count: jobs?.filter((j) => j.agent === a).length }))
    : AGENTS.filter((a) => a.kind === 'kap').map((a) => ({ value: a.id, label: a.name, count: jobs?.filter((j) => j.agent === a.id).length }));

  const view = VIEWS.find((v) => same(v.f, f))?.name;
  const users = Array.from(new Set((jobs ?? []).map((j) => userByName(j.user)?.username ?? j.user)));

  return (
    <Page className="gap-4 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">
            Agent jobs <span className="text-[15px] font-medium text-ink-muted">{jobs?.length ?? summary.total}</span>
            {live && (
              <Badge tone="success" className="ml-2 align-middle">
                Live · test stand
              </Badge>
            )}
          </h1>
          <p className="mt-1 text-ink-muted">
            {live ? `Real jobs of the ${live.name} tenant, synced from KAP every 15 s. Select a row to open its trace.` : 'Jobs submitted to SCEAI agents on the kap.agent queue. Select a row to open its trace.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="whitespace-nowrap text-ink-muted">Saved views</span>
          {VIEWS.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => setF(v.f)}
              className={cn('whitespace-nowrap rounded-sm px-2.5 py-[5px]', view === v.name ? 'bg-brand-tint font-semibold text-brand-strong' : 'border border-line hover:border-brand')}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <SummaryStrip
        items={[
          { k: 'Total', v: String(summary.total), c: '#8C8487' },
          { k: 'Succeeded', v: String(summary.succeeded), c: 'var(--success)' },
          { k: 'Failed', v: String(summary.failed), c: 'var(--danger)' },
          { k: 'Running', v: String(summary.running), c: 'var(--info)' },
          { k: 'Avg duration', v: summary.avgDuration, c: 'transparent' },
        ]}
      />

      <ListToolbar
        search={q}
        onSearch={setQ}
        placeholder="Search question, job ID, user"
        range={f.range}
        onRange={(range) => set({ range })}
        chips={
          <>
            <SelectChip
              label="Status"
              value={f.status}
              defaultValue="any"
              onChange={(status) => set({ status })}
              options={[
                { value: 'any', label: 'any' },
                ...(['running', 'succeeded', 'failed', 'cancelled', 'queued'] as JobStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s].toLowerCase(), count: jobs?.filter((j) => j.status === s).length })),
              ]}
            />
            <SelectChip
              label="Agent"
              value={f.agent}
              defaultValue="any"
              onChange={(agent) => set({ agent })}
              options={[{ value: 'any', label: 'any' }, ...agentOptions]}
            />
            <SelectChip
              label="User"
              value={f.user}
              defaultValue="any"
              onChange={(user) => set({ user })}
              options={[{ value: 'any', label: 'any' }, ...(live ? users.map((u) => ({ value: u, label: u })) : USERS.filter((u) => users.includes(u.username) || u.username === CURRENT_USER.username).map((u) => ({ value: u.username, label: u.username })))]}
            />
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="h-[480px]" />
      ) : isError ? (
        <EmptyState
          title="Cannot reach the platform API"
          body="Live jobs come from the platform API on the test stand. Check that the SSH tunnel to port 8180 is open and PLATFORM_API_KEY is set for the console server."
          actions={<button type="button" className="text-brand underline" onClick={() => void refetch()}>Try again</button>}
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          selectable
          pageSize={12}
          onRowClick={(j) => nav(`${base}/traces/${j.id}`)}
          emptyTitle="No jobs match these filters"
          bulkActions={
            <>
              {['Re-run', 'Cancel', 'Export'].map((a) => (
                <button key={a} type="button" onClick={readOnly} className="text-brand-strong underline hover:text-brand">
                  {a}
                </button>
              ))}
            </>
          }
        />
      )}
    </Page>
  );
}
