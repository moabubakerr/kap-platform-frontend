/**
 * Tenants (route /platform/tenants). Bespoke screen `s.tenants`: tenant
 * inventory with search, status filter, sortable columns and pagination
 * (prototype `platformOps` tInv). "Create tenant" opens a wizard (tenant,
 * limits, administrator, review) and shows the provisioning checklist of the
 * prototype (`provision`); the new tenant is provisioned in the session.
 */
import * as React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCrumbs } from '@/app/shell/crumbs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/primitives';
import { DsPill } from '@/engine/ScreenView';
import { tenantsStore, type TenantRec } from '@/v35/data/platform';
import { INV_COLS, INV_DEFAULT, provisionSteps, TENANT_IDPS, tenantInventory, tenantRecord, validateTenant, type InvQuery, type TenantDraft } from './build';
import { usePlatform } from './usePlatform';

/** Opens the create-tenant wizard (also used by Platform Overview). */
export function useCreateTenant() {
  const P = usePlatform('Tenants');
  return React.useCallback(() => {
    P.d.wizard({
      title: 'Create tenant',
      steps: ['Tenant', 'Limits', 'Administrator', 'Review'],
      finishL: 'Create tenant',
      initial: { agent: '3', pipe: '2', models: 'Platform defaults', idp: TENANT_IDPS[0] },
      fields: (step, v) => {
        if (step === 0)
          return [
            { type: 'text', k: 'k', label: 'Tenant key', ph: 'e.g. finance', hint: 'Lower-case; used in URLs, queues and secret paths. Can’t be changed later.' },
            { type: 'text', k: 'n', label: 'Display name', ph: 'e.g. Finance directorate' },
            { type: 'textarea', k: 'd', label: 'Description', rows: 3 },
          ];
        if (step === 1)
          return [
            { type: 'num', k: 'agent', label: 'kap.agent · max in-flight', hint: 'Agent jobs this tenant may run at once (1–8).' },
            { type: 'num', k: 'pipe', label: 'kap.pipeline · max in-flight', hint: 'Ingestion runs this tenant may run at once (1–2).' },
            { type: 'select', k: 'models', label: 'Default model providers', opts: ['Platform defaults', 'None'], hint: 'Platform defaults link the shared agent, chat and embedding models.' },
          ];
        if (step === 2)
          return [
            { type: 'text', k: 'admin', label: 'Administrator user name', ph: 'e.g. fin_admin' },
            { type: 'text', k: 'email', label: 'Administrator e-mail', ph: 'name@example.gov.qa' },
            { type: 'select', k: 'idp', label: 'Identity provider', opts: TENANT_IDPS },
          ];
        const t = v as TenantDraft;
        return [
          { type: 'kv', label: 'Tenant', rows: [['Key', t.k], ['Display name', t.n], ['Description', t.d], ['kap.agent · max in-flight', t.agent], ['kap.pipeline · max in-flight', t.pipe], ['Default model providers', t.models], ['Administrator', `${t.admin} · ${t.email}`], ['Identity provider', t.idp]] },
          { type: 'kv', label: 'Provisioning checklist', rows: provisionSteps(t).map((s, i) => [`Step ${i + 1}`, s]) },
        ];
      },
      validate: (step, v) => validateTenant(tenantsStore.get(), step, v),
      finish: (v) => {
        const t = v as TenantDraft;
        const e = [0, 1, 2].map((s) => validateTenant(tenantsStore.get(), s, t)).find(Boolean);
        if (e) return e;
        const rec = tenantRecord(t);
        tenantsStore.update((all) => {
          all.push(rec);
        });
        P.audit([{ action: 'Created tenant', res: `${rec.k} · ${rec.n}`, tenants: [] }]);
        window.setTimeout(() => {
          tenantsStore.update((all) => {
            const x = all.find((y) => y.k === rec.k);
            if (x && x.st === 'Provisioning') x.st = 'Healthy';
          });
        }, 2500);
        window.setTimeout(() => P.d.info(`Provisioning ${rec.n}`, 'The tenant is being provisioned. Its administrator can sign in when every step is done.', rec.prov!.map((s) => ({ a: 'Done', b: '', c: s }))), 0);
        return '';
      },
    });
  }, [P]);
}

export default function TenantsPage() {
  const P = usePlatform('Tenants');
  const TEN = tenantsStore.use();
  const [Q, setQ] = React.useState<InvQuery>(INV_DEFAULT);
  const create = useCreateTenant();
  useCrumbs([]);
  if (!P.canRead) return <div className="px-8 pt-3"><EmptyState title="You don't have access to platform administration" body="Sign in with a platform administrator account." /></div>;
  const inv = tenantInventory(TEN, Q);
  const open = (t: TenantRec) => {
    if (t.prov) return P.d.info(`${t.n} · provisioning`, t.st === 'Provisioning' ? 'The tenant is being provisioned.' : 'Provisioned in this session. The tenant opens once it is added to the console’s tenant list.', t.prov.map((s) => ({ a: 'Done', b: '', c: s })));
    P.goTenant(t.k);
  };
  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="h1">Tenants</h1>
        {P.pEdit && <Button size="sm" onClick={create}>Create tenant</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-[300px] max-w-full">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input type="search" value={Q.q} placeholder="Search tenants" onChange={(e) => setQ({ ...Q, q: e.target.value, pg: 1 })} className="h-[38px] w-full rounded-card border border-line bg-surface pl-8 pr-3 text-[13.5px] outline-none focus-visible:shadow-focus" />
        </label>
        <select value={Q.fs} onChange={(e) => setQ({ ...Q, fs: e.target.value, pg: 1 })} className="h-[38px] w-[190px] rounded-card border border-line bg-surface px-2 text-[13.5px]">
          {['All statuses', 'Healthy', 'At limit', 'Degraded', 'Internal'].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="overflow-auto rounded-card border border-line-subtle bg-surface">
        <table className="w-full min-w-[980px] border-collapse text-[13px]">
          <thead className="bg-surface-sunken">
            <tr>
              {INV_COLS.map(([k, l]) => (
                <th key={k} onClick={() => setQ({ ...Q, sk: k, sd: Q.sk === k ? (-Q.sd as 1 | -1) : 1 })} className="cursor-pointer select-none whitespace-nowrap px-3 py-[9px] text-left text-xs font-semibold" style={{ color: Q.sk === k ? 'var(--text-strong)' : 'var(--text-muted)' }}>
                  {l}
                  {Q.sk === k ? (Q.sd === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inv.rows.map(({ t, u, q, p }) => (
              <tr key={t.k} onClick={() => open(t)} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover">
                <td className="px-3 py-[9px]">
                  <div className="font-semibold text-ink-strong">{t.n}</div>
                  <div className="text-xs text-ink-muted">{t.d}</div>
                </td>
                <td className="px-3 py-[9px]"><DsPill p={[p, t.st]} /></td>
                <td className="px-3 py-[9px] font-mono text-[12.5px]">{u}</td>
                <td className="px-3 py-[9px] font-mono text-[12.5px]">{t.a}</td>
                <td className="px-3 py-[9px] font-mono text-[12.5px]">{t.c}</td>
                <td className="px-3 py-[9px] font-mono text-[12.5px]">{t.j}</td>
                <td className="px-3 py-[9px] font-mono text-[12.5px]">{q}</td>
                <td className="whitespace-nowrap px-3 py-[9px] text-ink-muted">{t.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {inv.empty && <div className="p-7 text-center text-ink-muted">No tenants match the search or filter.</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle px-3 py-2.5 text-[13px] text-ink-muted">
          <span>{inv.info}</span>
          <div className="flex items-center gap-2.5">
            <span>Rows per page</span>
            <select value={Q.ps} onChange={(e) => setQ({ ...Q, ps: parseInt(e.target.value, 10), pg: 1 })} className="h-[30px] rounded-sm border border-line bg-surface px-1.5 text-[13px]">
              {[10, 25, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <span>{inv.page}</span>
            <button type="button" aria-label="Previous page" disabled={inv.cur <= 1} onClick={() => setQ({ ...Q, pg: Math.max(1, inv.cur - 1) })} className="flex rounded-sm border border-line p-1 disabled:opacity-40">
              <ChevronLeft size={14} />
            </button>
            <button type="button" aria-label="Next page" disabled={inv.cur >= inv.pages} onClick={() => setQ({ ...Q, pg: Math.min(inv.pages, inv.cur + 1) })} className="flex rounded-sm border border-line p-1 disabled:opacity-40">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
