import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, MessageSquare, Pencil } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { Page } from '@/components/common/layout';
import { EmptyState, IconTile } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { useCatalogueEntry } from '@/api/catalogue';
import { CURRENT_VERSION, entryHistory, topQuestions } from '@/mocks/catalogue';
import { MESSAGES } from '@/mocks/conversations';

/** A top question opens the Ask AI message that asked it (or one about the same indicator). */
function questionLink(base: string, indicatorName: string, question: string) {
  const m = MESSAGES.find((x) => x.question === question) ?? MESSAGES.find((x) => x.indicator === indicatorName);
  return m ? `${base}/conversations/${m.message_id}` : `${base}/conversations`;
}
import { ActualTargetChart, ChartLegend, Kpi, PageLoading, Panel, SimpleTable, fmtValue, latest, observationRows, readOnly, tdc, tdm } from './shared';

export default function CatalogueEntryPage() {
  const { code } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const { data: ind, isLoading } = useCatalogueEntry(code);
  useCrumbs([ind?.nameEn ?? code]);

  if (isLoading) return <PageLoading />;

  const back = (
    <Link to={`${base}/catalogue`} className="flex w-fit items-center gap-1.5 text-[13px]">
      <ChevronLeft size={16} strokeWidth={1.75} />
      Back to catalogue
    </Link>
  );

  if (!ind)
    return (
      <ProjectPage resource="catalogue entries">
        <Page className="gap-4">
          {back}
          <EmptyState title={`No catalogue entry ${code}`} body="The code may have been retired or never published." actions={<Button onClick={() => nav(`${base}/catalogue`)}>Back to catalogue</Button>} />
        </Page>
      </ProjectPage>
    );

  const s = ind.series;
  const last = latest(ind);
  const kpis = [
    { k: 'Latest value', v: `${fmtValue(s, last.actual)} · ${last.label}`, d: 'Actual' },
    { k: 'Target', v: last.target == null ? 'No target' : fmtValue(s, last.target), d: 'Current period' },
    { k: 'Questions · 7 d', v: String(ind.questions7d), d: 'Ask AI' },
    { k: 'Answer accuracy', v: '98%', d: 'Verifier pass rate' },
  ];
  const meta: [string, string, boolean?][] = [
    ['Code', ind.code, true],
    ['Frequency', ind.frequency],
    ['Unit', ind.unit],
    ['Coverage', ind.coverage],
    ['Periods', ind.periods, true],
    ['Source organisation', ind.dataSource],
    ['Collection', 'sceai_indicators', true],
    ['Catalogue version', CURRENT_VERSION, true],
  ];
  const obs = observationRows(ind);

  return (
    <ProjectPage resource="catalogue entries">
      <Page className="gap-4">
        {back}
        <div className="flex flex-wrap items-start gap-3.5">
          <IconTile size={48} bg="#F6E8EC" fg="#8A1538">
            <BookOpen size={22} strokeWidth={1.75} />
          </IconTile>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-semibold text-ink-strong">{ind.nameEn}</h1>
              <StatusPill status={ind.status === 'retired' ? 'retired' : ind.status} label={ind.statusLabel} />
            </div>
            <div dir="auto" className="text-left text-[15px] text-ink-body">
              {ind.nameAr}
            </div>
            <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 whitespace-nowrap text-[12.5px] text-ink-muted">
              <span>
                Code <span className="font-mono text-ink-body">{ind.code}</span>
              </span>
              <span>Catalogue {CURRENT_VERSION}</span>
              <span>Source {ind.dataSource}</span>
              <span>Updated 3 d ago</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => nav(`${base}/conversations`)}>
              <MessageSquare size={15} strokeWidth={1.75} />
              Ask AI about this
            </Button>
            <Button onClick={readOnly}>
              <Pencil size={15} strokeWidth={1.75} />
              Edit entry
            </Button>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {kpis.map((k) => (
            <Kpi key={k.k} {...k} />
          ))}
        </div>

        <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
          <div className="flex min-w-0 flex-col gap-3">
            <Panel title="Metadata">
              <div className="grid gap-3.5 p-4 text-[13px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {meta.map(([k, v, mono]) => (
                  <div key={k} className="min-w-0">
                    <div className="text-xs text-ink-muted">{k}</div>
                    {k === 'Collection' ? (
                      <Link to={`${base}/collections/${v}`} className="font-mono">
                        {v}
                      </Link>
                    ) : (
                      <div className={mono ? 'font-mono text-ink-strong' : 'text-ink-strong'}>{v}</div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <section className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-ink-strong">{s.target ? 'Actual vs target' : 'Actual values'}</div>
                <ChartLegend hasTarget={!!s.target} />
              </div>
              <ActualTargetChart series={s} />
            </section>

            <Panel title="Observations · latest 8" meta="From sceai_indicators">
              <SimpleTable head={['Period', 'Actual', 'Target', 'Gap', 'Source file · row']} right={[1, 2, 3]}>
                {obs.map((o) => (
                  <tr key={o.period}>
                    <td className={tdc}>{o.period}</td>
                    <td className={`${tdm} text-right`}>{o.actual}</td>
                    <td className={`${tdm} text-right`}>{o.target}</td>
                    <td className={`${tdm} text-right`} style={{ color: o.gapColor }}>
                      {o.gap}
                    </td>
                    <td className={`${tdm} text-ink-muted`}>{o.source}</td>
                  </tr>
                ))}
              </SimpleTable>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Panel title="Names the assistant recognises" meta={<span className="text-xs">Used by resolvers and the Indicator Picker</span>}>
              <div className="flex flex-col gap-3 px-4 py-3.5">
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-ink-muted">English aliases</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ind.aliasesEn.map((a) => (
                      <span key={a} className="rounded-sm border border-line px-[9px] py-[3px] text-[12.5px]">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-ink-muted">Arabic aliases</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ind.aliasesAr.map((a) => (
                      <span key={a} dir="auto" className="rounded-sm border border-line px-[9px] py-[3px] text-[13px]">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="How Ask AI answers about it · 7 d">
              <div className="flex flex-col gap-3 px-4 py-3.5 text-[13px]">
                <div>
                  <div className="mb-[5px] flex justify-between text-xs text-ink-muted">
                    <span>Resolved directly vs via Indicator Picker</span>
                    <span>
                      {ind.direct}% / {ind.picker}%
                    </span>
                  </div>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-[2px]">
                    <span style={{ width: `${ind.direct}%`, background: '#8A1538' }} />
                    <span style={{ width: `${ind.picker}%`, background: '#B7791F' }} />
                  </div>
                </div>
                <div className="text-xs font-semibold text-ink-muted">Top questions</div>
                <div>
                  {topQuestions(ind).map((q) => (
                    <Link
                      key={q.q}
                      to={questionLink(base, ind.nameEn, q.q)}
                      className="flex justify-between gap-2.5 border-t border-line-subtle py-[7px] text-ink-strong hover:bg-surface-hover hover:no-underline"
                    >
                      <span dir="auto" className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">
                        {q.q}
                      </span>
                      <span className="flex-none font-mono text-[12.5px] text-ink-muted">{q.n}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Entry history">
              {entryHistory(ind).map((v, i) => (
                <div key={v.version} className={`grid gap-2.5 px-4 py-2.5 text-[13px] ${i > 0 ? 'border-t border-line-subtle' : ''}`} style={{ gridTemplateColumns: '96px minmax(0, 1fr)' }}>
                  <span className="font-mono text-[12.5px] font-semibold text-ink-strong">{v.version}</span>
                  <div>
                    <div>{v.note}</div>
                    <div className="text-xs text-ink-muted">
                      {v.by} · {v.when}
                    </div>
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      </Page>
    </ProjectPage>
  );
}
