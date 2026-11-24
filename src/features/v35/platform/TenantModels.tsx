/**
 * Tenant side of the registry (markup block `showTModels`, shown on Tenant
 * Configuration · General in the prototype): the tenant's model defaults and
 * the models the platform makes available to it. Exported for the tenant
 * configuration screen; reads and writes the same registry store.
 */
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { DsPill } from '@/engine/ScreenView';
import { recordAudit } from '@/v35/data/audit';
import { registryStore, type Role, type TKey } from '@/v35/data/platform';
import { useAccess } from '@/v35/access';
import { saveDefaults, tenantModels } from './build';
import { Card, ErrBanner, thCls, theadCls, useBanner } from './ui';

export function TenantModelsSection({ tenant }: { tenant: TKey }) {
  const R = registryStore.use();
  const access = useAccess(tenant);
  const canAdmin = access.can('tenant:configure', 'tenant');
  const [draft, setDraft] = React.useState<Record<Role, string> | null>(null);
  const [err, setErr] = React.useState('');
  const banner = useBanner();
  const V = tenantModels(R, tenant, draft ?? undefined);
  const save = () => {
    const r = saveDefaults(registryStore.get(), tenant, draft ?? R.tDef[tenant]);
    if ('err' in r) return setErr(r.err);
    registryStore.set(r.next);
    r.evs.forEach((e) => recordAudit({ who: access.uid, action: e.action, res: e.res, tenants: e.tenants, lvl: 'tenant', area: 'Tenant Configuration' }));
    setDraft(null);
    setErr('');
    banner.show(r.msg);
  };
  return (
    <div className="flex flex-col gap-4">
      {banner.node}
      <Card title="Models">
        <div className="grid gap-3 px-4 py-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
          {V.defaults.map((x) => (
            <div key={x.r}>
              <div className="mb-1 text-[12.5px] text-ink-muted">{x.k}</div>
              <select
                value={x.cur}
                disabled={!canAdmin}
                onChange={(e) => {
                  const id = e.target.value.split(' · ')[0];
                  setDraft({ ...(draft ?? R.tDef[tenant]), [x.r]: id });
                  setErr('');
                }}
                className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[13px]"
              >
                {x.opts.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              {x.warn && <div className="mt-1 text-xs text-danger-fg">{x.warnMsg}</div>}
            </div>
          ))}
        </div>
        {err && <div className="mx-4 mb-3"><ErrBanner err={err} /></div>}
        {V.dirty && (
          <div className="flex justify-end gap-2 px-4 pb-3.5">
            <Button size="sm" variant="outline" onClick={() => { setDraft(null); setErr(''); }}>Discard</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </div>
        )}
        <div className="overflow-auto border-t border-line-subtle">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead className={theadCls}>
              <tr>
                <th className={thCls}>Model</th>
                <th className={thCls}>Capabilities</th>
                <th className={thCls}>Used by</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {V.rows.map((r) => (
                <tr key={r.id} className="border-t border-line-subtle">
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[12.5px] font-semibold">{r.id}</div>
                    <div className="text-xs text-ink-muted">{r.m}</div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted">{r.caps}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{r.used}</td>
                  <td className="px-3 py-2.5"><DsPill p={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!V.rows.length && <div className="p-6 text-center text-ink-muted">No models available.</div>}
        </div>
      </Card>
    </div>
  );
}
