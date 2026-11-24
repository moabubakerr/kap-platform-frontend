/**
 * Platform Overview (route /platform). Bespoke screen `s.pHome`: installation
 * facts, period summary, open alerts, service health (from telemetry, never
 * healthy when stale), tenants requiring attention, and processing / agent
 * activity by tenant. Port of `platformOps` and `telemetry`.
 */
import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/primitives';
import { DsPill } from '@/engine/ScreenView';
import { cn } from '@/lib/utils';
import { INSTALL, mcpRegStore, registryStore, tenantsStore, type Period } from '@/v35/data/platform';
import { activity, openAlerts, platformSummary, telemetry, tenantOverview } from './build';
import { Card, LinkBtn, thCls, theadCls } from './ui';
import { usePlatform } from './usePlatform';
import { useCreateTenant } from './TenantsPage';

const SEV: Record<string, [string, string]> = { Critical: ['var(--danger-bg)', 'var(--danger-fg)'], Warning: ['var(--warning-bg)', 'var(--warning-fg)'], Info: ['var(--info-bg)', 'var(--info)'] };

export default function PlatformHomePage() {
  const P = usePlatform('Tenants');
  const R = registryStore.use();
  const M = mcpRegStore.use();
  const TEN = tenantsStore.use();
  const [per, setPer] = React.useState<Period>('7d');
  const [tf, setTf] = React.useState('all');
  const createTenant = useCreateTenant();
  useCrumbs([]);
  if (!P.canRead) return <div className="px-8 pt-3"><EmptyState title="You don't have access to platform administration" body="Sign in with a platform administrator account." /></div>;

  const svc = telemetry(R, M);
  const sum = platformSummary(TEN, per, svc);
  const act = activity(TEN, per, tf);
  const ov = tenantOverview(TEN);
  const alerts = openAlerts();
  const active = TEN.filter((t) => t.st !== 'Internal');
  const info: [string, string][] = [['Hosting', INSTALL.hosting], ['Release', `${INSTALL.release} · installed ${INSTALL.released}`], ['Maintenance window', INSTALL.maint]];

  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">Platform Overview</h1>
          <div title={INSTALL.maintNote} className="mt-1.5 flex flex-wrap gap-5 text-[13px] text-ink-muted">
            {info.map(([k, v]) => (
              <span key={k}>
                {k} <span className="font-medium text-ink-body">{v}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-sm border border-line">
            {([['24h', '24 h'], ['7d', '7 days'], ['30d', '30 days']] as [Period, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setPer(k)} className={cn('px-3 py-1.5 text-[13px]', per === k ? 'bg-brand-tint font-semibold text-brand' : 'bg-surface text-ink-body')}>
                {l}
              </button>
            ))}
          </div>
          {P.pEdit && <Button size="sm" onClick={createTenant}>Create tenant</Button>}
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {sum.map((k) => (
          <button key={k.k} type="button" onClick={() => P.goP(k.g)} className="rounded-card border border-line-subtle bg-surface px-4 py-3.5 text-left hover:border-line-strong">
            <div className="text-[12.5px] text-ink-muted">{k.k}</div>
            <div className="mt-1 text-[26px] font-semibold text-ink-strong">{k.v}</div>
            <div className="mt-0.5 text-xs text-ink-muted">{k.d}</div>
          </button>
        ))}
      </div>

      <Card title="Alerts" right={<LinkBtn onClick={() => P.goP('pMon')}>View all</LinkBtn>}>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead className={theadCls}>
              <tr>
                <th className={thCls}>Severity</th>
                <th className={thCls}>Affected</th>
                <th className={thCls}>Issue</th>
                <th className={thCls}>Time</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((x) => (
                <tr key={x.id} onClick={() => P.goP('pMon')} className="cursor-pointer border-t border-line-subtle align-top hover:bg-surface-hover">
                  <td className="px-3 py-[9px]">
                    <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: SEV[x.sev][0], color: SEV[x.sev][1] }}>{x.sev}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-[9px] font-medium">{x.comp}</td>
                  <td className="px-3 py-[9px] text-ink-muted">{x.issue}</td>
                  <td className="whitespace-nowrap px-3 py-[9px] text-ink-muted">{x.last}</td>
                  <td className="px-3 py-[9px]"><DsPill p={[x.st === 'Resolved' ? 'approved' : x.st === 'Acknowledged' ? 'submitted' : 'hold', x.st]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))' }}>
        <Card title="Service health">
          <div className="overflow-auto">
            <table className="w-full min-w-[600px] border-collapse text-[13px]">
              <thead className={theadCls}>
                <tr>
                  <th className={thCls}>Service</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Metric</th>
                  <th className={thCls}>Last checked</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody>
                {svc.map((s) => (
                  <tr key={s.n} className="border-t border-line-subtle">
                    <td className="px-3 py-[9px] font-medium text-ink-strong">{s.n}</td>
                    <td className="px-3 py-[9px]"><DsPill p={[s.pill, s.status]} /></td>
                    <td className="px-3 py-[9px] text-ink-muted">{s.shown}</td>
                    <td className="whitespace-nowrap px-3 py-[9px] text-ink-muted">{s.last}</td>
                    <td className="px-3 py-[9px] text-right"><LinkBtn onClick={() => P.goP(s.go)}>Details</LinkBtn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Tenants" right={<LinkBtn onClick={() => P.goP('tenants')}>Manage tenants</LinkBtn>}>
          <div className="flex border-b border-line-subtle">
            {ov.sum.map((x) => (
              <div key={x.k} className="border-r border-line-subtle px-5 py-3">
                <div className="text-xs text-ink-muted">{x.k}</div>
                <div className="text-xl font-semibold text-ink-strong">{x.v}</div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-1 pt-2.5 text-[12.5px] text-ink-muted">Requiring attention</div>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {ov.attn.map((t) => (
                <tr key={t.k} className="border-t border-line-subtle">
                  <td className="w-[200px] px-3 py-[9px] font-medium">{t.n}</td>
                  <td className="w-[140px] px-3 py-[9px]"><DsPill p={[t.p, t.st]} /></td>
                  <td className="px-3 py-[9px] text-ink-muted">{t.issue}</td>
                  <td className="px-3 py-[9px] text-right"><LinkBtn onClick={() => P.goP(t.go)}>Open</LinkBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card
        title="Processing and agent activity"
        right={
          <div className="flex items-center gap-3">
            <select
              value={tf === 'all' ? 'All tenants' : active.find((t) => t.k === tf)?.n}
              onChange={(e) => setTf(e.target.value === 'All tenants' ? 'all' : active.find((t) => t.n === e.target.value)?.k ?? 'all')}
              className="h-8 rounded-sm border border-line bg-surface px-2 text-[13px]"
            >
              {act.tenOpts.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <LinkBtn onClick={() => P.goP('pMon')}>Open monitoring</LinkBtn>
          </div>
        }
      >
        <div className="grid border-b border-line-subtle" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          {act.metrics.map(([k, v]) => (
            <div key={k} className="border-r border-line-subtle px-4 py-3">
              <div className="text-xs text-ink-muted">{k}</div>
              <div className="text-xl font-semibold text-ink-strong">{v}</div>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(280px,1fr)' }}>
          <div className="border-r border-line-subtle px-4 pb-4 pt-3">
            <div className="mb-1 text-[12.5px] text-ink-muted">Agent requests over time</div>
            <div className="relative pb-[18px] pl-[34px]">
              {act.grid.map((g) => (
                <span key={g.y} className="absolute left-0 -translate-y-1/2 text-[10.5px] text-[#766E71]" style={{ top: g.t }}>{g.l}</span>
              ))}
              <svg viewBox="0 0 700 150" preserveAspectRatio="none" className="block h-[170px] w-full">
                {act.grid.map((g) => <line key={g.y} x1="0" x2="700" y1={g.y} y2={g.y} stroke="#ECE7E5" />)}
                <path d={act.area} fill="#8A1538" fillOpacity="0.08" />
                <polyline points={act.line} fill="none" stroke="#8A1538" strokeWidth="2" />
              </svg>
              <div className="absolute bottom-0 left-[34px] right-0 h-4">
                {act.labels.map((d, i) => (
                  <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] text-[#766E71]" style={{ left: d.x }}>{d.l}</span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="px-4 pb-1.5 pt-3 text-[12.5px] text-ink-muted">By tenant</div>
            <table className="w-full border-collapse text-[13px]">
              <thead className={theadCls}>
                <tr>
                  <th className={thCls}>Tenant</th>
                  <th className={`${thCls} text-right`}>Requests</th>
                  <th className={thCls}>Share</th>
                  <th className={`${thCls} text-right`}>Failed</th>
                </tr>
              </thead>
              <tbody>
                {act.tenants.map((t) => (
                  <tr key={t.k} onClick={() => P.goTenant(t.k)} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover">
                    <td className="px-3 py-[9px] font-medium">{t.n}</td>
                    <td className="px-3 py-[9px] text-right font-mono text-[12.5px]">{t.r}</td>
                    <td className="w-[110px] px-3 py-[9px]">
                      <span className="block h-1.5 rounded-[3px] bg-surface-sunken"><span className="block h-1.5 rounded-[3px] bg-[#8A1538]" style={{ width: t.w }} /></span>
                    </td>
                    <td className="px-3 py-[9px] text-right font-mono text-[12.5px]">{t.f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
