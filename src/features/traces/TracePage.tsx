import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, Network, RotateCcw, ShieldCheck, TriangleAlert, Waypoints } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/common/layout';
import { EmptyState, Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { LinkTabs } from '@/components/ui/tabs';
import { StatusPill, type Status } from '@/components/ui/status-pill';
import { Tooltip } from '@/components/ui/menu';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { agentById, userByName } from '@/mocks/core';
import { useTrace } from '@/api/traces';
import { AnswerText, FieldLabel, LimitMeter, Logs, Provenance, RawRecord, SpanDetail, Waterfall } from './parts';

const TABS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'answer', label: 'Answer & provenance' },
  { value: 'raw', label: 'Raw JSON' },
  { value: 'logs', label: 'Logs' },
] as const;
type TabKey = (typeof TABS)[number]['value'];

const readOnly = () => toast('Read-only in this version');

export default function TracePage() {
  return (
    <ProjectPage resource="traces">
      <TraceView />
    </ProjectPage>
  );
}

function TraceView() {
  const { jobId = '', tab } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const { data: trace, isLoading } = useTrace(jobId);
  const active: TabKey = (TABS.find((t) => t.value === tab)?.value ?? 'timeline') as TabKey;
  const [sel, setSel] = React.useState<string | null>(null);
  useCrumbs([(trace?.job.id ?? jobId).slice(0, 8), TABS.find((t) => t.value === active)?.label]);

  React.useEffect(() => setSel(null), [jobId]);

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[520px]" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-72" />
      </Page>
    );
  }
  if (!trace) {
    return (
      <Page>
        <EmptyState
          icon={<Waypoints size={22} />}
          title={`No trace for job ${jobId}`}
          body="The job may have been purged from history, or the ID is wrong."
          actions={<Button onClick={() => nav(`${base}/jobs`)}>Open agent jobs</Button>}
        />
      </Page>
    );
  }

  const j = trace.job;
  const user = userByName(j.user);
  const tabBase = `${base}/traces/${j.id}`;
  const span = trace.spans.find((s) => s.id === (sel ?? trace.defaultSpan)) ?? trace.spans[0];
  const failed = trace.status === 'failed' || trace.status === 'cancelled';

  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 whitespace-nowrap text-[22px] font-semibold text-ink-strong">
              Trace <span className="font-mono font-medium">{j.id.length > 12 ? j.id.slice(0, 8) : j.id}</span>
            </h1>
            <StatusPill status={trace.status as Status} label={trace.statusLabel} />
            <Tooltip content={trace.uuid}>
              <button
                type="button"
                aria-label="Copy job ID"
                className="flex text-ink-muted hover:text-brand"
                onClick={() => {
                  void navigator.clipboard?.writeText(trace.uuid);
                  toast.success('ID copied');
                }}
              >
                <Copy size={15} />
              </button>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 whitespace-nowrap text-[13px] text-ink-muted">
            <span>
              Agent{' '}
              {agentById(j.agent) ? (
                <Link to={`${base}/agents/${j.agent}`} className="font-mono">
                  {j.agent}
                </Link>
              ) : (
                <span className="font-mono text-ink-body">{j.agent}</span>
              )}
            </span>
            <span>
              User{' '}
              {user ? (
                <Link to={`${base}/users/${user.username}`} className="font-mono">
                  {j.user}
                </Link>
              ) : (
                <span className="font-mono text-ink-body">{j.user}</span>
              )}
            </span>
            <span>
              Duration <b className="text-ink-strong">{trace.duration}</b>
            </span>
            <Tooltip content={trace.createdAbs}>
              <span>Created {trace.createdRel}</span>
            </Tooltip>
            <span>Updated {trace.updatedRel}</span>
            <span>Retries {trace.retries}</span>
            <span>
              Queue <span className="font-mono">{trace.queue}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              toast.success('Link copied');
            }}
          >
            <Copy size={15} />
            Copy link
          </Button>
          <Button variant="outline" size="sm" onClick={() => nav(`${base}/map?job=${j.id}`)}>
            <Network size={15} />
            Open in agents map
          </Button>
          <Button size="sm" onClick={readOnly}>
            <RotateCcw size={15} />
            Re-run job
          </Button>
        </div>
      </div>

      {trace.reason && (
        <div className={failed && trace.status === 'failed' ? 'flex items-center gap-2 rounded-sm border border-danger-border bg-danger-bg px-3 py-2.5 text-[13px] font-medium text-danger-fg' : 'flex items-center gap-2 rounded-sm border border-line-subtle bg-neutral-100 px-3 py-2.5 text-[13px] font-medium text-neutral-700'}>
          <TriangleAlert size={15} />
          {trace.status === 'failed' ? 'Job failed' : 'Job cancelled'} · {trace.reason}
        </div>
      )}

      {/* Prompt + answer, limits */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
        <div className="card flex min-w-0 flex-col gap-3 p-4">
          <div>
            <FieldLabel>user_prompt</FieldLabel>
            <div className="rounded-sm bg-surface-sunken px-3 py-2.5 text-ink-strong">{trace.prompt}</div>
          </div>
          <div>
            <FieldLabel>Answer</FieldLabel>
            {trace.answer ? (
              <AnswerText parts={trace.answer} />
            ) : trace.status === 'running' || trace.status === 'queued' ? (
              <div className="text-[13.5px] text-ink-muted">{trace.status === 'queued' ? 'Waiting for a worker on kap.agent…' : 'The agent is still working. The answer appears here when the job finishes.'}</div>
            ) : (
              <div className="text-[13.5px] text-ink-muted">No answer was produced. {trace.reason}.</div>
            )}
          </div>
        </div>
        <div className="card flex min-w-0 flex-col gap-3.5 p-4">
          <div className="font-semibold text-ink-strong">Limits</div>
          {trace.meters.map((m) => (
            <LimitMeter key={m.k} {...m} />
          ))}
          <div
            className={
              trace.leak.tone === 'ok'
                ? 'flex items-center gap-2 rounded-sm bg-success-bg px-3 py-2.5 text-[13px] font-medium text-success-fg'
                : 'flex items-center gap-2 rounded-sm bg-surface-sunken px-3 py-2.5 text-[13px] font-medium text-ink-muted'
            }
          >
            <ShieldCheck size={16} />
            {trace.leak.text}
          </div>
        </div>
      </div>

      <LinkTabs base={tabBase} items={TABS.map((t) => (t.value === 'logs' ? { ...t, badge: trace.logs.length } : t))} />

      {active === 'timeline' && (
        <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))' }}>
          <Waterfall trace={trace} selected={span.id} onSelect={setSel} />
          <SpanDetail span={span} />
        </div>
      )}
      {(active === 'timeline' || active === 'answer') && <Provenance trace={trace} />}
      {active === 'raw' && <RawRecord lines={trace.rawLines} />}
      {active === 'logs' && <Logs logs={trace.logs} />}
    </div>
  );
}
