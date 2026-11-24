import { Link, useNavigate } from 'react-router-dom';
import { Cpu, History, Layers, Plug, Plus, Shield, type LucideIcon } from 'lucide-react';
import { Page } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { usePlatformOverview } from '@/api/platform';
import type { PlatformIcon, PlatformOverviewData, PlatformRequestSeries } from '@/mocks/platform';

const SVC_ICON: Record<PlatformIcon, LucideIcon> = { cpu: Cpu, layers: Layers, plug: Plug, shield: Shield, history: History };
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[.08em] text-ink-subtle';

export default function PlatformOverviewPage() {
  const nav = useNavigate();
  const { data } = usePlatformOverview();
  return (
    <Page className="max-w-[1320px] gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-card bg-platform font-mono text-[13px] font-bold text-white">KAP</span>
        <div className="min-w-[240px] flex-1">
          <h1 className="h1">KAP platform</h1>
          <div className="mt-0.5 text-ink-muted">{data?.subtitle ?? '4 projects on shared infrastructure · 2 services need attention'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => nav('/p/sceai')}>
            Open SCEAI
          </Button>
          <Button onClick={() => nav('/platform/projects')}>
            <Plus size={15} />
            Create project
          </Button>
        </div>
      </div>
      {data ? (
        <>
          <Organisation d={data} />
          <Requests d={data} />
        </>
      ) : (
        <>
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[260px]" />
        </>
      )}
    </Page>
  );
}

function Organisation({ d }: { d: PlatformOverviewData }) {
  const nav = useNavigate();
  const healthy = d.services.filter((s) => s.status === 'Healthy').length;
  return (
    <div className="card flex flex-col px-[22px] py-5">
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className={eyebrow}>How KAP is organised</div>
          <div className="mt-0.5 text-base font-semibold text-ink-strong">Projects run their own agents and data on shared services</div>
        </div>
        <Link to="/platform/projects" className="text-[13px]">
          Manage projects
        </Link>
      </div>

      <div className={`${eyebrow} mb-2`}>Projects</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {d.projects.map((p) => (
          <div
            key={p.name}
            role={p.projectKey ? 'link' : undefined}
            tabIndex={p.projectKey ? 0 : undefined}
            onClick={p.projectKey ? () => nav(`/p/${p.projectKey}`) : undefined}
            onKeyDown={p.projectKey ? (e) => e.key === 'Enter' && nav(`/p/${p.projectKey}`) : undefined}
            className="flex min-w-0 flex-col gap-3 rounded-sm border border-line-subtle bg-surface p-3.5 hover:border-brand"
            style={{ borderTop: `3px solid ${p.accent}`, cursor: p.projectKey ? 'pointer' : 'default' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-8 w-8 flex-none place-items-center rounded-sm font-mono text-[10.5px] font-bold"
                style={{ background: p.iconBg, color: p.iconFg }}
              >
                {p.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-strong">{p.name}</div>
                <div className="truncate text-[11.5px] text-ink-muted">{p.desc}</div>
              </div>
              <span className="whitespace-nowrap rounded-[3px] px-[7px] py-0.5 text-[11px] font-semibold" style={{ background: p.healthBg, color: p.healthFg }}>
                {p.health}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {p.metrics.map((m) => (
                <div key={m.k}>
                  <div className="text-[17px] font-semibold text-ink-strong">{m.v}</div>
                  <div className="text-[11px] text-ink-muted">{m.k}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span className="whitespace-nowrap">kap.agent</span>
              <div className="h-[5px] flex-1 rounded-[3px] bg-surface-sunken">
                <div className="h-full rounded-[3px]" style={{ width: `${p.queuePct}%`, background: p.queuePct >= 100 ? 'var(--warning)' : '#8A1538' }} />
              </div>
              <span className="font-mono text-ink-body">{p.queue}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Connector: one drop per project into a bar, then down to shared services. */}
      <div className="relative h-10" aria-hidden>
        <div className="absolute left-[12%] right-[12%] top-5 h-px bg-line" />
        <div className="flex h-5 justify-around">
          {d.projects.map((p) => (
            <span key={p.name} className="h-full w-px bg-line" />
          ))}
        </div>
        <div className="absolute left-1/2 top-5 h-5 w-px bg-line" />
        <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap bg-surface px-2 text-[11px] text-ink-muted">all projects use</span>
      </div>

      <div className="rounded-sm border border-line bg-surface-sunken p-3.5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className={eyebrow}>Shared services · operated by the AI team</span>
          <span className="text-xs text-ink-muted">
            {healthy} of {d.services.length} healthy
          </span>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {d.services.map((x) => {
            const ok = x.status === 'Healthy';
            const I = SVC_ICON[x.icon];
            return (
              <Link
                key={x.name}
                to={`/platform/${x.go}`}
                className="flex min-w-0 flex-col gap-1 rounded-sm border border-line-subtle bg-surface px-3 py-2.5 text-inherit hover:border-brand hover:no-underline"
              >
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-strong">
                  <I size={14} strokeWidth={1.75} className="flex-none text-ink-muted" />
                  <span className="min-w-0 flex-1 truncate">{x.name}</span>
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: ok ? 'var(--success)' : 'var(--warning)' }} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-semibold text-ink-strong">{x.metric}</span>
                  <span className="text-[11px] text-ink-muted">{x.metricLabel}</span>
                </div>
                <div className="text-[11.5px] font-semibold" style={{ color: ok ? 'var(--success-fg)' : 'var(--warning-fg)' }}>
                  {x.status} <span className="font-normal text-ink-muted">· {x.detail}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Requests({ d }: { d: PlatformOverviewData }) {
  const r = d.requests;
  return (
    <div className="card flex flex-col gap-3.5 px-[22px] py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={eyebrow}>Requests per day</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[26px] font-semibold text-ink-strong">{r.total}</span>
            <span className="text-xs font-semibold text-success-fg">{r.delta}</span>
          </div>
        </div>
        <span className="text-[12.5px] text-ink-muted">{r.range}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {r.series.map((s) => (
          <SmallMultiple key={s.name} s={s} days={r.days} />
        ))}
      </div>
    </div>
  );
}

function SmallMultiple({ s, days }: { s: PlatformRequestSeries; days: string[] }) {
  const nav = useNavigate();
  const mx = 100;
  const bw = 240 / s.values.length;
  const total = s.values.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / s.values.length);
  const peak = Math.max(...s.values);
  const peakDay = days[s.values.indexOf(peak)];
  const avgY = 78 - (avg / mx) * 74;
  const last = s.values.length - 1;
  const go = s.projectKey ? () => nav(`/p/${s.projectKey}`) : undefined;
  return (
    <div
      role={go ? 'link' : undefined}
      tabIndex={go ? 0 : undefined}
      onClick={go}
      onKeyDown={go ? (e) => e.key === 'Enter' && go() : undefined}
      className="flex min-w-0 flex-col gap-2.5 rounded-sm border border-line-subtle p-3.5 hover:border-brand"
      style={{ cursor: go ? 'pointer' : 'default' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
          <span className="font-semibold text-ink-strong">{s.name}</span>
        </div>
        <span className="whitespace-nowrap rounded-[3px] px-[7px] py-0.5 text-[11.5px] font-semibold" style={{ background: s.deltaBg, color: s.deltaFg }}>
          {s.delta}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-ink-strong">{total}</span>
        <span className="text-xs text-ink-muted">requests · {s.share} of total</span>
      </div>
      <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="block h-20 w-full">
        <line x1={0} x2={240} y1={avgY} y2={avgY} stroke="#D2CBC9" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        {s.values.map((v, i) => (
          <rect
            key={i}
            x={i * bw + bw * 0.18}
            y={78 - (v / mx) * 74}
            width={bw * 0.64}
            height={(v / mx) * 74}
            rx={2}
            fill={i === last ? s.color : `${s.color}99`}
          >
            <title>{`${days[i]} · ${v} requests`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex justify-between text-[10.5px] text-ink-muted">
        {days.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="flex justify-between border-t border-line-subtle pt-2 text-[11.5px] text-ink-muted">
        <span>
          Peak <b className="font-mono text-ink-strong">{peak}</b> {peakDay}
        </span>
        <span>
          Avg <b className="font-mono text-ink-strong">{avg}</b>/day
        </span>
      </div>
    </div>
  );
}
