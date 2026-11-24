import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Info, Search, TriangleAlert } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { Page, PageHeader } from '@/components/common/layout';
import { EmptyState } from '@/components/common/primitives';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useIndicators } from '@/api/catalogue';
import { INDICATOR_COUNT, type Indicator } from '@/mocks/catalogue';
import { ActualTargetChart, ChartLegend, PageLoading, Panel, SimpleTable, fmtValue, latest, longPeriod, observationRows, tdc, tdm } from '@/features/catalogue/shared';

const FREQ_CODE = { Quarterly: 'Q', Monthly: 'M', Annual: 'A' } as const;

/** Indicators master/detail (design `indicators.html`). `code` = selected indicator. */
export function IndicatorsView({ code }: { code: string }) {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useIndicators();
  const [q, setQ] = React.useState('');
  const ind = data?.find((i) => i.code.toLowerCase() === code.toLowerCase());
  useCrumbs([ind?.nameEn]);

  if (isLoading) return <PageLoading />;

  const list = (data ?? []).filter((i) => !q || `${i.nameEn} ${i.code} ${i.nameAr}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <ProjectPage resource="indicators">
      <Page className="gap-4">
        <PageHeader title="Indicators" count={INDICATOR_COUNT} description="Economic indicators in the SCEAI catalogue, with actual and target observations from sceai_indicators." />
        <div className="grid items-start gap-3 md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
          <div className="card overflow-hidden">
            <div className="p-2.5">
              <div className="flex h-[34px] items-center gap-2 rounded-card border border-line px-2.5 text-ink-subtle">
                <Search size={15} strokeWidth={1.75} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search indicators" className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-strong outline-none placeholder:text-ink-subtle" />
              </div>
            </div>
            {list.map((i) => {
              const on = i.code === ind?.code;
              return (
                <button
                  key={i.code}
                  type="button"
                  onClick={() => nav(`${base}/indicators/${i.code}`)}
                  className={cn('block w-full border-t border-line-subtle px-3.5 py-2.5 text-left', on ? 'bg-brand-tint' : 'hover:bg-surface-hover')}
                >
                  <div className={cn('text-[13px] font-medium', on ? 'text-brand-strong' : 'text-ink-strong')}>{i.nameEn}</div>
                  <div className="flex gap-2 text-xs text-ink-muted">
                    <span className="font-mono">{i.code}</span>
                    <span>{i.frequency}</span>
                  </div>
                </button>
              );
            })}
            {list.length === 0 && <div className="border-t border-line-subtle px-3.5 py-3 text-[13px] text-ink-muted">No indicators match</div>}
          </div>
          {ind ? <IndicatorDetail ind={ind} base={base} /> : <EmptyState title={`No indicator ${code}`} body="Pick an indicator from the list." />}
        </div>
      </Page>
    </ProjectPage>
  );
}

function IndicatorDetail({ ind, base }: { ind: Indicator; base: string }) {
  const s = ind.series;
  const last = latest(ind);
  const obs = observationRows(ind, true);
  const badge = last.gap == null ? <Badge tone="neutral">No target</Badge> : last.gap >= 0 ? <Badge tone="success">Above target</Badge> : <Badge tone="danger">Below target</Badge>;

  const facts: [string, React.ReactNode][] = [
    ['External ID', <span className="font-mono text-[12.5px]">{ind.code}</span>],
    ['Frequency', `${ind.frequency} (${FREQ_CODE[ind.frequency]})`],
    ['Unit', ind.unit],
    ['Source organisation', ind.dataSource],
    [
      'Latest',
      <>
        <b>{fmtValue(s, last.actual)}</b> · {longPeriod(last.label)}
      </>,
    ],
    ['Target', last.target == null ? 'No target' : fmtValue(s, last.target)],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-semibold text-ink-strong">{ind.nameEn}</h2>
          {badge}
          {ind.inCatalogue && (
            <Link to={`${base}/catalogue/${ind.code}`} className="ml-auto text-[12.5px]">
              Open catalogue entry
            </Link>
          )}
        </div>
        <div className="mt-3.5 grid gap-3 text-[13px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <div className="text-xs text-ink-muted">{k}</div>
              <div>{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-ink-strong">{s.target ? 'Actual vs target' : 'Actual values'}</div>
          <ChartLegend hasTarget={!!s.target} />
        </div>
        <ActualTargetChart series={s} />
      </section>

      <Panel title={`Quality warnings · ${ind.quality.length}`}>
        {ind.quality.length === 0 && <div className="px-4 py-2.5 text-[13px] text-ink-muted">No quality warnings for this indicator.</div>}
        {ind.quality.map((w, i) => (
          <div key={w.title} className={cn('flex items-start gap-2.5 px-4 py-2.5 text-[13px]', i > 0 && 'border-t border-line-subtle')}>
            <span className="flex pt-0.5" style={{ color: w.tone === 'warning' ? 'var(--warning)' : 'var(--info)' }}>
              {w.tone === 'warning' ? <TriangleAlert size={16} strokeWidth={1.75} /> : <Info size={16} strokeWidth={1.75} />}
            </span>
            <div>
              <b>{w.title}</b>
              <div className="text-[12.5px] text-ink-muted">{w.detail}</div>
            </div>
          </div>
        ))}
      </Panel>

      <Panel title={`Observations · ${obs.length}`} meta="Replaces Indicator Observations">
        <SimpleTable head={['Period', 'Actual', 'Target', 'Gap', 'Status', 'Source file · row']} right={[1, 2, 3]} minWidth={640}>
          {obs.map((o) => (
            <tr key={o.period}>
              <td className={tdc}>{o.period}</td>
              <td className={`${tdm} text-right`}>{o.actual}</td>
              <td className={`${tdm} text-right`}>{o.target}</td>
              <td className={`${tdm} text-right`} style={{ color: o.gapColor }}>
                {o.gap}
              </td>
              <td className={tdc}>
                {o.above == null ? <Badge tone="neutral">No target</Badge> : o.above ? <Badge tone="success">Above target</Badge> : <Badge tone="danger">Below target</Badge>}
              </td>
              <td className={`${tdm} text-ink-muted`}>{o.source}</td>
            </tr>
          ))}
        </SimpleTable>
      </Panel>
    </div>
  );
}
