import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Minus, Pencil, Play, Plus, TriangleAlert, Workflow, X } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { Page, PageHeader } from '@/components/common/layout';
import { IconTile } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import { usePipelineRuns, usePipelines } from '@/api/data';
import { PIPELINE_KPIS, type Pipeline } from '@/mocks/data';
import { PageLoading, Panel, SimpleTable, readOnly, tdc, tdm } from '@/features/catalogue/shared';
import { RunSegments } from './runParts';

const HIST = { o: ['var(--success)', 'Succeeded'], f: ['var(--danger)', 'Failed'], p: ['var(--warning)', 'Partial'] } as const;

export default function PipelinesPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data: pipes, isLoading } = usePipelines();
  const { data: runs } = usePipelineRuns();
  const [filter, setFilter] = React.useState<'all' | 'failed' | '7d'>('all');

  const shown = (runs ?? []).filter((r) => (filter === 'failed' ? r.status === 'rejected' : filter === '7d' ? r.ageDays <= 7 : true));

  return (
    <ProjectPage resource="pipelines">
      {isLoading ? (
        <PageLoading />
      ) : (
        <Page className="gap-4">
          <PageHeader
            title="Pipelines"
            count={pipes?.length ?? 0}
            description="Ingestion pipelines that turn connector data into sceai_indicators. Runs execute on the kap.pipeline queue."
            actions={
              <>
                <Button variant="outline" onClick={readOnly}>
                  <Play size={15} strokeWidth={1.75} />
                  Run all now
                </Button>
                <Button onClick={readOnly}>
                  <Plus size={15} strokeWidth={1.75} />
                  Create pipeline
                </Button>
              </>
            }
          />

          <div className="card grid overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {PIPELINE_KPIS.map((k) => (
              <div key={k.k} className="-ml-px border-l border-line-subtle px-4 py-3">
                <div className="whitespace-nowrap text-[12.5px] text-ink-muted">{k.k}</div>
                <div className="mt-0.5 text-[22px] font-semibold text-ink-strong">{k.v}</div>
                <div className="text-xs text-ink-muted">{k.d}</div>
              </div>
            ))}
          </div>

          {(pipes ?? []).map((p) => (
            <PipelineCard key={p.name} p={p} base={base} />
          ))}

          <Panel
            title="Run history"
            meta={
              <div className="flex gap-1.5 text-[12.5px]">
                {(
                  [
                    ['all', 'All'],
                    ['failed', 'Failed'],
                    ['7d', 'Last 7 d'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFilter(v)}
                    className={cn('rounded-sm px-2.5 py-[3px]', filter === v ? 'bg-brand-tint font-semibold text-brand-strong' : 'border border-line text-ink-body hover:border-brand')}
                  >
                    {l}
                  </button>
                ))}
              </div>
            }
          >
            <SimpleTable head={['Run', 'Pipeline', 'Status', 'Steps', 'Rows ingested', 'Errors', 'Duration', 'Triggered by', 'Started']} right={[4, 5]} minWidth={960}>
              {shown.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/ingestion?run=${r.id}`)}>
                  <td className={`${tdm} whitespace-nowrap`}>{r.label}</td>
                  <td className={tdm}>{r.pipeline}</td>
                  <td className={tdc}>
                    <StatusPill status={r.status} label={r.statusLabel} />
                    {r.reason && <div className="mt-[3px] text-[11.5px] text-danger-fg">{r.reason}</div>}
                  </td>
                  <td className={tdc}>
                    <RunSegments segs={r.segs} />
                  </td>
                  <td className={`${tdm} text-right`}>{r.rows}</td>
                  <td className={`${tdm} text-right`} style={{ color: r.errors === 0 ? 'var(--text-muted)' : 'var(--danger-fg)' }}>
                    {r.errors}
                  </td>
                  <td className={`${tdc} min-w-[120px]`}>
                    <div className="font-mono text-[12.5px]">{r.duration}</div>
                    <div className="mt-1 h-1 rounded-[2px] bg-surface-sunken">
                      <div className="h-full rounded-[2px] bg-brand" style={{ width: `${r.durationPct}%` }} />
                    </div>
                  </td>
                  <td className={`${tdc} whitespace-nowrap text-ink-muted`}>{r.triggeredBy}</td>
                  <td className={`${tdc} whitespace-nowrap text-ink-muted`}>{r.started}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9} className={`${tdc} text-center text-ink-muted`}>
                    No runs match
                  </td>
                </tr>
              )}
            </SimpleTable>
          </Panel>
        </Page>
      )}
    </ProjectPage>
  );
}

function PipelineCard({ p, base }: { p: Pipeline; base: string }) {
  const facts: [string, string][] = [
    ['Schedule', p.schedule],
    ['Last run', p.lastRun],
    ['Next run', p.nextRun],
    ['Output', p.output],
  ];
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle px-4 py-3.5">
        <IconTile size={36} bg={p.iconBg} fg={p.iconFg}>
          <Workflow size={18} strokeWidth={1.75} />
        </IconTile>
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to={`${base}/ingestion?pipeline=${p.name}`} className="font-mono text-sm font-semibold text-ink-strong hover:text-brand">
              {p.name}
            </Link>
            <StatusPill status={p.status} label={p.statusLabel} />
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-muted">{p.description}</div>
        </div>
        <div className="flex gap-2">
          <Button onClick={readOnly}>
            <Play size={15} strokeWidth={1.75} />
            Run now
          </Button>
          <Button variant="outline" onClick={readOnly}>
            <Pencil size={15} strokeWidth={1.75} />
            Edit
          </Button>
        </div>
      </div>

      <div className="overflow-auto p-4">
        <div className="flex min-w-[720px] items-stretch">
          {p.steps.map((s, i) => {
            const warn = s.state === 'warn';
            const dot = s.state === 'ok' ? 'var(--success)' : s.state === 'bad' ? 'var(--danger)' : 'var(--warning)';
            return (
              <div key={s.name} className="flex flex-1 items-center">
                <div
                  className="min-w-0 flex-1 rounded-sm border px-[11px] py-[9px]"
                  style={{ borderColor: warn ? 'var(--warning-border)' : 'var(--border-subtle)', background: warn ? 'var(--warning-bg)' : 'var(--surface-card)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-4 w-4 flex-none place-items-center rounded-full text-white" style={{ background: dot }}>
                      {s.state === 'ok' ? <Check size={10} strokeWidth={3} /> : s.state === 'bad' ? <X size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
                    </span>
                    <span className="whitespace-nowrap text-[12.5px] font-semibold text-ink-strong">{s.name}</span>
                  </div>
                  <div className="mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-ink-muted">{s.detail}</div>
                  <div className="mt-0.5 font-mono text-[11.5px]" style={{ color: warn ? 'var(--warning-fg)' : 'var(--text-muted)' }}>
                    {s.metric}
                  </div>
                </div>
                {i < p.steps.length - 1 && <span className="h-[1.5px] w-5 flex-none bg-line" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-x-5 gap-y-3 px-4 pb-4 text-[13px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {facts.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-ink-muted">{k}</div>
            <div>{v}</div>
          </div>
        ))}
        <div>
          <div className="mb-[5px] text-xs text-ink-muted">Last 12 runs</div>
          <Link to={`${base}/ingestion?pipeline=${p.name}`} className="flex w-fit gap-[3px]">
            {p.history.split('').map((ch, i) => {
              const [c, t] = HIST[ch as keyof typeof HIST];
              return <span key={i} title={t} className="h-5 w-3 rounded-[2px]" style={{ background: c }} />;
            })}
          </Link>
        </div>
      </div>

      {p.warning && (
        <div className="flex items-center gap-2 border-t border-line-subtle bg-warning-bg px-4 py-2.5 text-[13px] text-warning-fg">
          <TriangleAlert size={16} strokeWidth={1.75} className="flex-none" />
          {p.warning}
        </div>
      )}
    </section>
  );
}
