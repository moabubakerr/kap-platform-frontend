/**
 * Tenant dashboard (route /p/:tenant). Bespoke screen `s.home` of the v35
 * design for SCEAI (this week, quick actions, resources, attention items,
 * health; prototype `overview()`), and the "sample tenant" overview the design
 * shows for Economic Affairs and sandbox (markup `isOtherT`, data `otKpi`).
 * The shell only opens this page for accounts allowed on the tenant's
 * dashboard; links go to the tenant's screens, which apply their own access.
 */
import { useNavigate } from 'react-router-dom';
import {
  Bot, CalendarClock, CircleX, Cpu, Database, Languages, Layers, MessageSquare, MessageSquarePlus, MessagesSquare, Play, Plug, Search, Table2, TriangleAlert, Upload, User, UserPlus, Users, Workflow, type LucideIcon,
} from 'lucide-react';
import { useBase, useOpenPalette, useScope } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { Badge } from '@/components/ui/badge';
import { OTHER_KPI, SCEAI_DASH, TENANT_META } from '@/v35/data/platform';
import { questionsChart, spark, TENANT_ROUTE, timeChart } from './build';
import DefaultTenantPage from './DefaultTenantPage';

const ACTION_ICON: Record<string, LucideIcon> = { 'Ask a test question': MessageSquarePlus, 'Upload documents': Upload, 'Run ingestion': Play, 'Create agent': Bot, 'Create user': UserPlus, 'Schedule report': CalendarClock };
const RES_ICON: Record<string, LucideIcon> = { Agents: Bot, Sessions: MessagesSquare, 'Structured datasets': Table2, Collections: Database, Pipelines: Workflow, 'AI Agent Tools': Plug, Users, 'Scheduled reports': CalendarClock };
const HEALTH_ICON: Record<string, LucideIcon> = { Workflow, Layers, Plug, Cpu, Database };
const TONE: Record<string, [string, string]> = { lt: ['#F6E8EC', '#8A1538'], sd: ['var(--sand-tint)', 'var(--sand-ink)'], tl: ['var(--teal-tint)', '#0F766E'], nt: ['var(--surface-sunken)', 'var(--text-muted)'] };

export default function TenantDashboardPage() {
  const scope = useScope();
  const key = scope.kind === 'project' ? scope.project.key : 'sceai';
  useCrumbs([]);
  if (key === 'default') return <DefaultTenantPage />;
  if (key === 'econ' || key === 'sandbox') return <OtherTenant k={key} />;
  return <SceaiDashboard />;
}

function KpiCard({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-card border border-line-subtle bg-surface px-4 py-3.5">
      <div className="text-[12.5px] text-ink-muted">{k}</div>
      <div className="mt-1 text-[28px] font-semibold text-ink-strong">{v}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{d}</div>
    </div>
  );
}

/** Economic Affairs and sandbox: the design's sample-tenant overview. */
function OtherTenant({ k }: { k: 'econ' | 'sandbox' }) {
  const meta = TENANT_META[k];
  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="h1">{meta[0]}</h1>
            <Badge tone="neutral">Sample tenant</Badge>
          </div>
          <p className="mt-1 text-ink-muted">{meta[1]}</p>
        </div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {OTHER_KPI[k].map(([kk, v, d]) => <KpiCard key={kk} k={kk} v={v} d={d} />)}
      </div>
    </div>
  );
}

const card = 'rounded-card border border-line-subtle bg-surface';

function SceaiDashboard() {
  const nav = useNavigate();
  const base = useBase();
  const openPalette = useOpenPalette();
  const go = (k: string) => () => nav(`${base}/${TENANT_ROUTE[k] ?? ''}`.replace(/\/$/, ''));
  const D = SCEAI_DASH;
  const Q = questionsChart(D.questions.cur, D.questions.prev, D.questions.days);
  const TC = timeChart(D.time.p50, D.time.p95);
  const gauge = `${((157.1 * 86) / 93).toFixed(1)} 157.1`;
  const C = 2 * Math.PI * 36;
  const lang = `${(C * 0.38).toFixed(1)} ${C.toFixed(1)}`;
  const healthy = D.health.filter((x) => x[4]).length;

  return (
    <div className="flex max-w-[1320px] flex-col gap-6 px-8 pb-12 pt-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-card bg-[#F6E8EC] font-mono text-sm font-bold text-[#8A1538]">SC</span>
        <div className="min-w-[240px] flex-1">
          <h1 className="h1">SCEAI</h1>
          <div className="mt-0.5 text-ink-muted">Tenant on KAP · Supreme Council for Economic Affairs and Investment</div>
        </div>
        <button type="button" onClick={openPalette} className="flex h-[38px] min-w-[220px] flex-[0_1_360px] items-center gap-2.5 rounded-card border border-line bg-surface px-3 text-left text-[13px] text-ink-subtle">
          <Search size={15} />
          <span className="flex-1 truncate">Search resources, questions, traces</span>
          <span className="rounded-[3px] border border-line px-1.5 py-px font-mono text-[11px]">Ctrl K</span>
        </button>
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-[15px] font-semibold text-ink-strong">This week</h2>
          <span className="text-[12.5px] text-ink-muted">{D.week}</span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))' }}>
          <div onClick={go('convs')} className={`${card} col-span-2 flex min-w-0 cursor-pointer flex-col gap-2.5 p-4 max-[640px]:col-span-1`}>
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div>
                <div className="text-[12.5px] font-medium text-ink-body">Questions answered</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-semibold text-ink-strong">508</span>
                  <span className="text-xs font-semibold text-success-fg">+21%</span>
                </div>
              </div>
              <span className="text-[11.5px] text-ink-muted">Questions per day</span>
            </div>
            <div className="relative">
              <svg viewBox="0 0 560 140" preserveAspectRatio="none" className="block h-[140px] w-full">
                {Q.grid.map((y) => <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="#F0ECEA" vectorEffect="non-scaling-stroke" />)}
                <path d={Q.area} fill="rgba(138,21,56,.10)" />
                <polyline points={Q.prev} fill="none" stroke="#A8A0A3" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                <polyline points={Q.cur} fill="none" stroke="#8A1538" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              </svg>
              {Q.pts.map((p) => (
                <div key={p.l} className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5" style={{ left: `${p.x}%`, top: `${p.y}px` }}>
                  <span className="mb-0.5 bg-surface px-[3px] text-[10.5px] font-semibold text-ink-strong">{p.v}</span>
                  <span className="h-2 w-2 rounded-full border-2 border-[#8A1538] bg-white" />
                </div>
              ))}
            </div>
            <div className="relative h-3.5 text-[11px] text-ink-muted">
              {Q.pts.map((p) => (
                <span key={p.l} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${p.x}%`, color: p.last ? 'var(--text-strong)' : undefined, fontWeight: p.last ? 600 : 400 }}>{p.l}</span>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-2.5">
              <div className="flex justify-between text-[11.5px] text-ink-muted">
                <span>How they were answered</span>
                <span className="flex items-center gap-1.5"><span className="w-3 border-t-[1.5px] border-dashed border-[#A8A0A3]" />Previous week · 420</span>
              </div>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[2px]">
                {D.routes.map(([l, p, c]) => <span key={l} style={{ width: `${p}%`, background: c }} />)}
              </div>
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px]">
                {D.routes.map(([l, p, c]) => (
                  <span key={l} className="flex items-center gap-[5px] whitespace-nowrap text-ink-muted">
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: c }} />
                    {l} <b className="text-ink-strong">{p}%</b>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div onClick={go('map')} className={`${card} flex cursor-pointer flex-col gap-2 p-4`}>
            <div className="flex items-baseline justify-between">
              <div className="text-[12.5px] font-medium text-ink-body">Answer time</div>
              <span className="text-[11.5px] text-ink-muted">target &lt; 6 s</span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[22px] font-semibold text-ink-strong">3.1 s</span>
              <span className="text-xs text-ink-muted">median · p95 3.9 s</span>
            </div>
            <svg viewBox="0 0 200 64" preserveAspectRatio="none" className="block h-16 w-full">
              <line x1="0" y1="10" x2="200" y2="10" stroke="#C0352B" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path d={TC.band} fill="rgba(138,21,56,.10)" />
              <polyline points={TC.p95} fill="none" stroke="#D08AA0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <polyline points={TC.p50} fill="none" stroke="#8A1538" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex gap-3 text-[11px] text-ink-muted">
              <span className="flex items-center gap-[5px]"><span className="h-0.5 w-3 bg-[#8A1538]" />Median</span>
              <span className="flex items-center gap-[5px]"><span className="h-0.5 w-3 bg-[#D08AA0]" />p95</span>
              <span className="flex items-center gap-[5px]"><span className="w-3 border-t border-dashed border-[#C0352B]" />Target</span>
            </div>
          </div>

          <div onClick={go('feedback')} className={`${card} flex cursor-pointer flex-col gap-2.5 p-4`}>
            <div className="text-[12.5px] font-medium text-ink-body">User feedback</div>
            <div className="flex items-center gap-3.5">
              <div className="relative h-[66px] w-[120px] flex-none">
                <svg viewBox="0 0 120 66" className="block h-[66px] w-[120px]">
                  <path d="M10,60 A50,50 0 0 1 110,60" fill="none" stroke="#F0ECEA" strokeWidth="12" />
                  <path d="M10,60 A50,50 0 0 1 110,60" fill="none" stroke="#C0352B" strokeWidth="12" strokeDasharray="157.1 157.1" />
                  <path d="M10,60 A50,50 0 0 1 110,60" fill="none" stroke="#1E7B4F" strokeWidth="12" strokeDasharray={gauge} />
                </svg>
                <div className="absolute inset-x-0 bottom-0 text-center leading-none">
                  <div className="text-xl font-semibold text-ink-strong">92%</div>
                  <div className="mt-0.5 text-[10.5px] text-ink-muted">helpful</div>
                </div>
              </div>
              <div className="min-w-0 text-xs leading-[1.7]">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-[#1E7B4F]" />86 helpful</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-[#C0352B]" />7 not helpful</div>
                <div className="text-[11.5px] text-success-fg">+2 pp vs last week</div>
              </div>
            </div>
            <div className="flex flex-col gap-[5px] border-t border-line-subtle pt-2">
              <div className="flex justify-between text-[11.5px] text-ink-muted">
                <span>Why answers were not helpful</span>
                <span className="font-medium text-brand">4 open</span>
              </div>
              {D.fbWhy.map(([l, n]) => (
                <div key={l} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: 'minmax(0,1fr) 54px 12px' }}>
                  <span className="truncate text-ink-body">{l}</span>
                  <div className="flex gap-0.5">{Array.from({ length: n }, (_, i) => <span key={i} className="h-2 w-2 rounded-[2px] bg-[#C0352B]" />)}</div>
                  <span className="text-right font-mono">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div onClick={go('convs')} className={`${card} flex cursor-pointer flex-col gap-2 p-4`}>
            <div className="text-[12.5px] font-medium text-ink-body">Language</div>
            <div className="flex items-center gap-3.5">
              <svg viewBox="0 0 88 88" className="h-[88px] w-[88px] flex-none -rotate-90">
                <circle cx="44" cy="44" r="36" fill="none" stroke="#8A1538" strokeWidth="10" />
                <circle cx="44" cy="44" r="36" fill="none" stroke="#C8B49A" strokeWidth="10" strokeDasharray={lang} />
              </svg>
              <div className="text-xs leading-[1.7]">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-[#8A1538]" />English <b className="text-ink-strong">62%</b></div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-[#C8B49A]" />Arabic <b className="text-ink-strong">38%</b></div>
                <div className="text-[11.5px] text-success-fg">Arabic +4 pp</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 text-[15px] font-semibold text-ink-strong">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {D.actions.map(([l, k]) => {
            const Ic = ACTION_ICON[l] ?? MessageSquare;
            return (
              <button key={l} type="button" onClick={go(k)} className="flex h-9 items-center gap-2 whitespace-nowrap rounded-card border border-line bg-surface px-3.5 text-[13px] text-ink-strong hover:border-brand hover:text-brand">
                <Ic size={15} className="text-brand" />
                {l}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 text-[15px] font-semibold text-ink-strong">Resources</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>
          {D.res.map(([n, v, d, tone, hc, k]) => {
            const Ic = RES_ICON[n] ?? User;
            return (
              <div key={n} onClick={go(k)} className={`${card} flex cursor-pointer flex-col gap-1.5 px-4 py-3.5 hover:border-brand`}>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-sm" style={{ background: TONE[tone][0], color: TONE[tone][1] }}><Ic size={16} /></span>
                  <span className="font-semibold text-ink-strong">{n}</span>
                  <span className="ml-auto h-[7px] w-[7px] rounded-full" style={{ background: hc }} />
                </div>
                <div className="mt-1 text-2xl font-semibold text-ink-strong">{v}</div>
                <div className="text-xs text-ink-muted">{d}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold text-ink-strong">Needs your attention</h2>
            <div className="flex gap-1.5">
              <span className="rounded-[3px] bg-danger-bg px-2 py-0.5 text-[11.5px] font-semibold text-danger-fg">1 critical</span>
              <span className="rounded-[3px] bg-warning-bg px-2 py-0.5 text-[11.5px] font-semibold text-warning-fg">2 warnings</span>
            </div>
          </div>
          {D.att.map(([sev, t, d, tags, when, l, k]) => {
            const crit = sev === 'critical';
            const c = crit ? 'var(--danger)' : 'var(--warning)';
            const Ic = crit ? CircleX : t.includes('Arabic') ? Languages : TriangleAlert;
            return (
              <div key={t} className={`${card} flex items-start gap-3.5 px-4 py-3.5`}>
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full" style={{ background: crit ? 'var(--danger-bg)' : 'var(--warning-bg)', color: c }}><Ic size={17} /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.06em]" style={{ color: c }}>{sev}</span>
                    <span className="text-[11.5px] text-ink-muted">{when}</span>
                  </div>
                  <div className="text-sm font-semibold leading-[1.35] text-ink-strong">{t}</div>
                  <div className="text-[12.5px] leading-normal text-ink-muted">{d}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {tags.map((g) => <span key={g} className="whitespace-nowrap rounded-[3px] bg-surface-sunken px-2 py-0.5 text-[11.5px] text-ink-body">{g}</span>)}
                    <div className="flex-1" />
                    <button type="button" onClick={go(k)} className="h-[30px] whitespace-nowrap rounded-sm border border-brand bg-surface px-3 text-[12.5px] font-semibold text-brand hover:bg-brand-tint">{l}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold text-ink-strong">Health</h2>
            <span className="text-xs text-ink-muted">{healthy} of {D.health.length} services healthy</span>
          </div>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-[3px]">
            {D.health.map((x) => <span key={x[0]} className="flex-1" style={{ background: x[4] ? 'var(--success)' : 'var(--warning)' }} />)}
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            {D.health.map(([n, m, ml, s, ok, d, icn, k, sp]) => {
              const c = ok ? 'var(--success)' : 'var(--warning)';
              const Ic = HEALTH_ICON[icn] ?? Layers;
              return (
                <div key={n} onClick={go(k)} className={`${card} flex cursor-pointer flex-col gap-1.5 px-3.5 py-3 hover:bg-surface-hover`} style={{ borderTop: `3px solid ${c}` }}>
                  <div className="flex items-center gap-2">
                    <Ic size={14} className="text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-strong">{n}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[22px] font-semibold text-ink-strong">{m}</span>
                    <span className="text-[11.5px] text-ink-muted">{ml}</span>
                  </div>
                  <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="block h-6 w-full">
                    <polyline points={spark(sp)} fill="none" stroke={c} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: c }} />
                    <span className="font-semibold" style={{ color: ok ? 'var(--success-fg)' : 'var(--warning-fg)' }}>{s}</span>
                    <span className="truncate text-ink-muted">· {d}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
