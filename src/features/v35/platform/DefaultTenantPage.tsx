/**
 * Default (system) tenant overview (route /p/default). Markup block `isSys`:
 * the internal tenant that owns platform service identities — KPI cards and
 * the service identities (prototype `defKpi`, `defUsers`).
 */
import { useCrumbs } from '@/app/shell/crumbs';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_TENANT } from '@/v35/data/platform';

export default function DefaultTenantPage() {
  useCrumbs([]);
  const D = DEFAULT_TENANT;
  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="h1">Default</h1>
            <Badge tone="neutral">Internal system tenant</Badge>
          </div>
          <p className="mt-1 text-ink-muted">Internal system tenant that owns platform service identities.</p>
        </div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {D.kpi.map(([k, v, d]) => (
          <div key={k} className="rounded-card border border-line-subtle bg-surface px-4 py-3.5">
            <div className="text-[12.5px] text-ink-muted">{k}</div>
            <div className="mt-1 text-[28px] font-semibold text-ink-strong">{v}</div>
            <div className="mt-0.5 text-xs text-ink-muted">{d}</div>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
        <div className="rounded-card border border-line-subtle bg-surface">
          <div className="border-b border-line-subtle px-4 py-3.5 font-semibold text-ink-strong">Platform service identities · {D.users.length}</div>
          {D.users.map(([n, d, last]) => (
            <div key={n} className="grid items-center gap-3 border-t border-line-subtle px-4 py-2.5 first:border-t-0" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <div className="min-w-0">
                <div className="font-mono text-[12.5px] font-semibold text-ink-strong">{n}</div>
                <div className="text-xs text-ink-muted">{d}</div>
              </div>
              <span className="whitespace-nowrap text-xs text-ink-muted">{last}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
