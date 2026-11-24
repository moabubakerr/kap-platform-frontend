import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Page } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';
import { HalfGauge, Sparkline } from '@/components/common/charts';
import { useBase, useOpenPalette } from '@/app/shell/AppShell';
import { useOverview } from '@/api/overview';
import type { OverviewData } from '@/mocks/overview';
import { OvIconEl, routeFor, TONE_COLOR, TONE_FG } from './shared';

const cardCls = 'flex min-w-0 flex-col rounded-card border border-line-subtle bg-surface p-4 text-inherit hover:no-underline';

export default function OverviewPage() {
  const { data } = useOverview();
  return (
    <Page className="max-w-[1320px]">
      <Header />
      {data ? <Body d={data} /> : <Loading />}
    </Page>
  );
}

function Header() {
  const openPalette = useOpenPalette();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-card bg-[#F6E8EC] font-mono text-sm font-bold text-[#8A1538]">SC</span>
      <div className="min-w-[240px] flex-1">
        <h1 className="h1">SCEAI</h1>
        <div className="mt-0.5 text-ink-muted">Project on KAP · Supreme Council for Economic Affairs and Investment</div>
      </div>
      <button
        type="button"
        onClick={openPalette}
        className="flex h-[38px] min-w-[220px] flex-[0_1_360px] items-center gap-2.5 rounded-card border border-line bg-surface px-3 text-left text-[13px] text-ink-subtle"
      >
        <Search size={15} />
        <span className="flex-1 truncate">Search resources, questions, traces</span>
        <span className="rounded-[3px] border border-line px-1.5 py-px font-mono text-[11px]">Ctrl K</span>
      </button>
    </div>
  );
}

function Loading() {
  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))' }}>
        <Skeleton className="col-span-2 h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-9 w-2/3" />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </>
  );
}

function Body({ d }: { d: OverviewData }) {
  const base = useBase();
  const nav = useNavigate();
  return (
    <>
      {/* This week */}
      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="h2">This week</h2>
          <span className="text-[12.5px] text-ink-muted">{d.week}</span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))' }}>
          <QuestionsCard d={d} to={`${base}/conversations`} />
          <AnswerTimeCard d={d} to={`${base}/map`} />
          <FeedbackCard d={d} to={`${base}/feedback`} />
          <LanguageCard d={d} to={`${base}/conversations`} />
        </div>
      </section>

      {/* Quick actions */}
      <section className="flex flex-col gap-2.5">
        <h2 className="h2">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {d.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => nav(routeFor(base, a.go))}
              className="group flex h-9 items-center gap-2 whitespace-nowrap rounded-card border border-line bg-surface px-3.5 text-[13px] text-ink-strong hover:border-brand hover:text-brand"
            >
              <span className="flex text-brand">
                <OvIconEl name={a.icon} size={15} />
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="flex flex-col gap-2.5">
        <h2 className="h2">Resources</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {d.resources.map((r) => {
            const [ibg, ifg] = {
              local: ['#F6E8EC', '#8A1538'],
              sand: ['var(--sand-tint)', 'var(--sand-ink)'],
              teal: ['var(--teal-tint)', '#0F766E'],
              neutral: ['var(--surface-sunken)', 'var(--text-muted)'],
            }[r.kind];
            return (
              <Link key={r.name} to={routeFor(base, r.go)} className={`${cardCls} gap-1.5 px-4 py-3.5 hover:border-brand`}>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-sm" style={{ background: ibg, color: ifg }}>
                    <OvIconEl name={r.icon} size={16} />
                  </span>
                  <span className="font-semibold text-ink-strong">{r.name}</span>
                  <span className="ml-auto h-[7px] w-[7px] flex-none rounded-full" style={{ background: TONE_COLOR[r.health] }} />
                </div>
                <div className="mt-1 text-2xl font-semibold text-ink-strong">{r.value}</div>
                <div className="text-xs text-ink-muted">{r.desc}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Attention + health */}
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">Needs your attention</h2>
            <div className="flex gap-1.5">
              <span className="rounded-[3px] bg-danger-bg px-2 py-0.5 text-[11.5px] font-semibold text-danger-fg">
                {d.attention.filter((a) => a.sev === 'critical').length} critical
              </span>
              <span className="rounded-[3px] bg-warning-bg px-2 py-0.5 text-[11.5px] font-semibold text-warning-fg">
                {d.attention.filter((a) => a.sev === 'warning').length} warnings
              </span>
            </div>
          </div>
          {d.attention.map((t) => {
            const c = t.sev === 'critical' ? 'var(--danger)' : 'var(--warning)';
            const bg = t.sev === 'critical' ? 'var(--danger-bg)' : 'var(--warning-bg)';
            return (
              <div key={t.title} className="flex items-start gap-3.5 rounded-card border border-line-subtle bg-surface px-4 py-3.5">
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full" style={{ background: bg, color: c }}>
                  <OvIconEl name={t.icon} size={17} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.06em]" style={{ color: c }}>
                      {t.sev}
                    </span>
                    <span className="text-[11.5px] text-ink-muted">{t.when}</span>
                  </div>
                  <div className="text-sm font-semibold leading-[1.35] text-ink-strong">{t.title}</div>
                  <div className="text-[12.5px] leading-normal text-ink-muted">{t.desc}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {t.tags.map((g) => (
                      <span key={g} className="whitespace-nowrap rounded-[3px] bg-surface-sunken px-2 py-0.5 text-[11.5px] text-ink-body">
                        {g}
                      </span>
                    ))}
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => nav(routeFor(base, t.go, t.jobId))}
                      className="h-[30px] whitespace-nowrap rounded-sm border border-brand bg-surface px-3 text-[12.5px] font-semibold text-brand hover:bg-brand-tint"
                    >
                      {t.action}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="h2">Health</h2>
            <span className="text-xs text-ink-muted">
              {d.health.filter((h) => h.tone === 'success').length} of {d.health.length} services healthy
            </span>
          </div>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-[3px]">
            {d.health.map((x) => (
              <span key={x.name} className="flex-1" style={{ background: TONE_COLOR[x.tone] }} />
            ))}
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {d.health.map((x) => (
              <Link
                key={x.name}
                to={routeFor(base, x.go)}
                className="flex min-w-0 flex-col gap-1.5 rounded-card border border-line-subtle bg-surface px-3.5 py-3 text-inherit hover:bg-surface-hover hover:no-underline"
                style={{ borderTop: `3px solid ${TONE_COLOR[x.tone]}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex text-ink-muted">
                    <OvIconEl name={x.icon} size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-strong">{x.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-semibold text-ink-strong">{x.metric}</span>
                  <span className="text-[11.5px] text-ink-muted">{x.metricLabel}</span>
                </div>
                <Sparkline values={x.spark} color={TONE_COLOR[x.tone]} height={24} />
                <div className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: TONE_COLOR[x.tone] }} />
                  <span className="font-semibold" style={{ color: TONE_FG[x.tone] }}>
                    {x.status}
                  </span>
                  <span className="truncate text-ink-muted">· {x.detail}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function QuestionsCard({ d, to }: { d: OverviewData; to: string }) {
  const q = d.questions;
  const X = (i: number) => 24 + (i * 512) / (q.cur.length - 1);
  const Y = (v: number) => 128 - (v / 100) * 110;
  const line = (vals: number[]) => vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `M24,140 L${q.cur.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')} L536,140 Z`;
  const last = q.cur.length - 1;
  return (
    <Link to={to} className={`${cardCls} col-span-2 gap-2.5 max-[560px]:col-span-1`}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <div className="text-[12.5px] font-medium text-ink-body">Questions answered</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-semibold text-ink-strong">{q.total}</span>
            <span className="text-xs font-semibold text-success-fg">{q.delta}</span>
          </div>
        </div>
        <span className="text-[11.5px] text-ink-muted">Questions per day</span>
      </div>
      <div className="relative">
        <svg viewBox="0 0 560 140" preserveAspectRatio="none" className="block h-[140px] w-full">
          {[25, 50, 75].map((g) => (
            <line key={g} x1={0} x2={560} y1={Y(g)} y2={Y(g)} stroke="#F0ECEA" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="rgba(138,21,56,.10)" />
          <polyline points={line(q.prev)} fill="none" stroke="#A8A0A3" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <polyline points={line(q.cur)} fill="none" stroke="#8A1538" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {q.cur.map((v, i) => (
          <div
            key={i}
            className="pointer-events-none absolute flex flex-col items-center gap-0.5"
            style={{ left: `${((X(i) / 560) * 100).toFixed(2)}%`, top: Y(v) - 6, transform: 'translate(-50%,-50%)' }}
          >
            <span className="mb-0.5 bg-surface px-[3px] text-[10.5px] font-semibold text-ink-strong">{v}</span>
            <span className="h-2 w-2 rounded-full border-2 border-[#8A1538] bg-white" />
          </div>
        ))}
      </div>
      <div className="relative h-3.5 text-[11px] text-ink-muted">
        {q.labels.map((l, i) => (
          <span
            key={l}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${((X(i) / 560) * 100).toFixed(2)}%`, color: i === last ? 'var(--text-strong)' : undefined, fontWeight: i === last ? 600 : 400 }}
          >
            {l}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-2.5">
        <div className="flex justify-between text-[11.5px] text-ink-muted">
          <span>How they were answered</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t-[1.5px] border-dashed border-[#A8A0A3]" />
            Previous week · {q.previous}
          </span>
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[2px]">
          {d.routes.map((r) => (
            <span key={r.label} style={{ width: `${r.pct}%`, background: r.color }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px]">
          {d.routes.map((r) => (
            <span key={r.label} className="flex items-center gap-[5px] whitespace-nowrap text-ink-muted">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />
              {r.label} <b className="text-ink-strong">{r.pct}%</b>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function AnswerTimeCard({ d, to }: { d: OverviewData; to: string }) {
  const t = d.answerTime;
  const n = t.p50s.length - 1;
  const X = (i: number) => ((i * 200) / n).toFixed(1);
  const Y = (v: number) => (64 - (v / 6.6) * 58).toFixed(1);
  const p50 = t.p50s.map((v, i) => `${X(i)},${Y(v)}`);
  const p95 = t.p95s.map((v, i) => `${X(i)},${Y(v)}`);
  const band = `M${p95.join(' L')} L${[...p50].reverse().join(' L')} Z`;
  return (
    <Link to={to} className={`${cardCls} gap-2`}>
      <div className="flex items-baseline justify-between">
        <div className="text-[12.5px] font-medium text-ink-body">Answer time</div>
        <span className="text-[11.5px] text-ink-muted">{t.target}</span>
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="text-[22px] font-semibold text-ink-strong">{t.median}</span>
        <span className="text-xs text-ink-muted">median · p95 {t.p95}</span>
      </div>
      <svg viewBox="0 0 200 64" preserveAspectRatio="none" className="block h-16 w-full">
        <line x1={0} y1={10} x2={200} y2={10} stroke="#C0352B" strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={band} fill="rgba(138,21,56,.10)" />
        <polyline points={p95.join(' ')} fill="none" stroke="#D08AA0" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <polyline points={p50.join(' ')} fill="none" stroke="#8A1538" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex gap-3 text-[11px] text-ink-muted">
        <span className="flex items-center gap-[5px]">
          <span className="h-0.5 w-3 bg-[#8A1538]" />
          Median
        </span>
        <span className="flex items-center gap-[5px]">
          <span className="h-0.5 w-3 bg-[#D08AA0]" />
          p95
        </span>
        <span className="flex items-center gap-[5px]">
          <span className="w-3 border-t border-dashed border-[#C0352B]" />
          Target
        </span>
      </div>
    </Link>
  );
}

function FeedbackCard({ d, to }: { d: OverviewData; to: string }) {
  const f = d.feedback;
  return (
    <Link to={to} className={`${cardCls} gap-2.5`}>
      <div className="text-[12.5px] font-medium text-ink-body">User feedback</div>
      <div className="flex items-center gap-3.5">
        <HalfGauge good={f.helpful} total={f.helpful + f.notHelpful} label={f.pct} />
        <div className="min-w-0 text-xs leading-[1.7]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[#1E7B4F]" />
            {f.helpful} helpful
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[#C0352B]" />
            {f.notHelpful} not helpful
          </div>
          <div className="text-[11.5px] text-success-fg">{f.delta}</div>
        </div>
      </div>
      <div className="flex flex-col gap-[5px] border-t border-line-subtle pt-2">
        <div className="flex justify-between text-[11.5px] text-ink-muted">
          <span>Why answers were not helpful</span>
          <span className="font-medium text-brand">{f.open} open</span>
        </div>
        {f.why.map((w) => (
          <div key={w.label} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: 'minmax(0,1fr) 54px 12px' }}>
            <span className="truncate text-ink-body">{w.label}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: w.n }, (_, i) => (
                <span key={i} className="h-2 w-2 rounded-[2px] bg-[#C0352B]" />
              ))}
            </div>
            <span className="text-right font-mono">{w.n}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

function LanguageCard({ d, to }: { d: OverviewData; to: string }) {
  const l = d.language;
  const C = 2 * Math.PI * 36;
  return (
    <Link to={to} className={`${cardCls} gap-2`}>
      <div className="text-[12.5px] font-medium text-ink-body">Language</div>
      <div className="flex items-center gap-3.5">
        <svg viewBox="0 0 88 88" className="h-[88px] w-[88px] flex-none" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={44} cy={44} r={36} fill="none" stroke="#8A1538" strokeWidth={10} />
          <circle cx={44} cy={44} r={36} fill="none" stroke="#C8B49A" strokeWidth={10} strokeDasharray={`${((C * l.ar) / 100).toFixed(1)} ${C.toFixed(1)}`} />
        </svg>
        <div className="text-xs leading-[1.7]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[#8A1538]" />
            English <b className="text-ink-strong">{l.en}%</b>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[#C8B49A]" />
            Arabic <b className="text-ink-strong">{l.ar}%</b>
          </div>
          <div className="text-[11.5px] text-success-fg">{l.delta}</div>
        </div>
      </div>
    </Link>
  );
}
