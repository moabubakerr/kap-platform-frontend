/**
 * MCP Registry (route /platform/mcp/:server?). Bespoke screen `showPMcp` of the
 * v35 design: platform-owned shared MCP servers (tenant availability, tools,
 * connection check, edit, enable/disable, delete) and tenant-owned servers the
 * platform can suspend. The register/edit form discovers tools through a
 * simulated connection test. Port of `mcpScreen` (platform view) and `mcpF`.
 */
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, Zap } from 'lucide-react';
import { useCrumbs } from '@/app/shell/crumbs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/primitives';
import { DsPill } from '@/engine/ScreenView';
import { MCP_SECRETS, mcpRegStore, TKEYS, TN, type McpRegistry, type McpServer, type TKey } from '@/v35/data/platform';
import {
  applyMcp, availChange, blankMcp, checkServer, deleteShared, discoverMcp, mcpAdv, mcpUsersAll, mcpValuesOf, setSharedStatus, setSuspended, sharedRow, tenantRow, type Applied, type McpForm, type McpValues,
} from './build';
import { AdvToggle, Card, Chip, DetailsBtn, ErrBanner, KvLines, Modal, SelectIn, TestBanner, TextIn, thCls, theadCls, useBanner, type TestState } from './ui';
import { usePlatform } from './usePlatform';

export default function McpRegistryPage() {
  const P = usePlatform('MCP Registry');
  const M = mcpRegStore.use();
  const { tab } = useParams();
  const [open, setOpen] = React.useState<string | null>(tab && M.servers.some((s) => s.n === tab) ? tab : null);
  const [test, setTest] = React.useState<TestState>(null);
  const [avail, setAvail] = React.useState<TKey[] | null>(null);
  const [adv, setAdv] = React.useState<Record<string, boolean>>({});
  const [form, setForm] = React.useState<McpForm | null>(null);
  const banner = useBanner();
  const timer = React.useRef<number>();
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  useCrumbs([open ?? undefined]);

  if (!P.canRead) return <div className="px-8 pt-3"><EmptyState title="You don't have access to platform administration" body="Sign in with a platform administrator account." /></div>;

  const apply = (r: Applied<McpRegistry>) => {
    mcpRegStore.set(r.next);
    banner.show(r.msg);
    P.audit(r.evs);
  };
  const pick = (n: string | null) => {
    setOpen(n);
    setTest(null);
    setAvail(null);
  };
  const shared = M.servers.filter((s) => s.own === 'platform');
  const tenant = M.servers.filter((s) => s.own !== 'platform');
  const sel = open ? M.servers.find((s) => s.n === open) : undefined;

  const check = (n: string) => {
    const r = checkServer(mcpRegStore.get(), n);
    const s = mcpRegStore.get().servers.find((x) => x.n === n)!;
    if (s.status !== 'Enabled' || s.susp) return setTest({ s: 'fail', m: r.msg });
    setTest({ s: 'busy' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r2 = checkServer(mcpRegStore.get(), n);
      mcpRegStore.set(r2.next);
      setTest({ s: r2.ok ? 'ok' : 'fail', m: r2.msg });
    }, 900);
  };
  const usersItems = (n: string) => mcpUsersAll(M, n).map((u) => ({ a: u.t, b: 'Agent', c: u.a }));
  const a = {
    toggle: (s: McpServer) => {
      if (s.status !== 'Enabled') return apply(setSharedStatus(M, s.n, true));
      const hit = usersItems(s.n);
      P.d.confirm(`Disable ${s.n}?`, hit.length ? 'Its tools become unavailable to these agents:' : 'Not used by any agent.', hit, 'Disable', () => apply(setSharedStatus(mcpRegStore.get(), s.n, false)));
    },
    del: (s: McpServer) => {
      const hit = usersItems(s.n);
      if (hit.length) return P.d.info(`Delete ${s.n}?`, 'Still granted to agents. Remove these grants first:', hit);
      P.d.confirm(`Delete ${s.n}?`, s.ten.length ? `It will be removed from ${s.ten.map((t) => TN[t]).join(', ')}. This can’t be undone.` : 'This can’t be undone.', [], 'Delete', () => {
        apply(deleteShared(mcpRegStore.get(), s.n));
        pick(null);
      });
    },
    availSave: (s: McpServer) => {
      if (!avail) return;
      const r = availChange(M, s.n, avail);
      if (!r.changed) return setAvail(null);
      const doIt = () => {
        apply(availChange(mcpRegStore.get(), s.n, avail));
        setAvail(null);
      };
      if (r.hit.length) P.d.confirm(`Withdraw ${s.n} from ${r.lost.map((t) => TN[t]).join(', ')}?`, 'These agents lose its tools:', r.hit.map((h) => ({ a: h.t, b: h.k, c: h.n })), 'Withdraw', doIt);
      else doIt();
    },
    susp: (s: McpServer) => {
      if (s.susp) return apply(setSuspended(M, s.n, false));
      const own = s.own as TKey;
      const { users } = tenantRow(M, s);
      P.d.confirm(`Suspend ${s.n}?`, users.length ? `Calls from ${TN[own]} stop. These agents lose its tools until it is resumed:` : `Calls from ${TN[own]} stop until it is resumed.`, users.map((u) => ({ a: TN[own], b: 'Agent', c: u })), 'Suspend', () => apply(setSuspended(mcpRegStore.get(), s.n, true)));
    },
  };

  const advOf = (s: McpServer) => (
    <div className="px-4 pb-3 pt-1">
      <AdvToggle open={!!adv[s.n]} set={(o) => setAdv({ ...adv, [s.n]: o })} />
      {adv[s.n] && (
        <div className="mt-1.5 grid gap-x-8" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(420px,1fr))' }}>
          <KvLines rows={mcpAdv(s)} w={160} />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="h1">MCP Registry</h1>
        {P.pEdit && (
          <Button size="sm" onClick={() => setForm({ mode: 'add', v: blankMcp(), adv: false, tested: null })}>
            <Plus size={15} /> Register shared MCP server
          </Button>
        )}
      </div>
      {banner.node}
      <Card title={`Shared MCP servers · platform-owned · ${shared.length}`} className="overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead className={theadCls}>
            <tr>
              <th className={thCls}>Server</th>
              <th className={thCls}>Available to</th>
              <th className={`${thCls} text-right`}>Tools</th>
              <th className={`${thCls} w-[120px]`}>Status</th>
              <th className={`${thCls} w-[130px]`}>Health</th>
              <th className={`${thCls} w-px`}><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {shared.map((s) => {
              const r = sharedRow(M, s);
              const o = open === s.n;
              return (
                <tr key={s.n} onClick={() => pick(o ? null : s.n)} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover" style={{ background: o ? 'var(--brand-tint)' : undefined, boxShadow: `inset 3px 0 0 ${o ? 'var(--brand)' : 'transparent'}` }}>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[12.5px] font-semibold text-ink-strong">{s.n}</div>
                    <div className="text-xs text-ink-muted">{r.k}</div>
                  </td>
                  <td className="px-3 py-2.5">{r.tenL}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.tc}</td>
                  <td className="px-3 py-2.5"><DsPill p={r.status} /></td>
                  <td className="px-3 py-2.5"><DsPill p={r.health} /></td>
                  <td className="px-3 py-2.5 text-right"><DetailsBtn label={s.n} onClick={() => !o && pick(s.n)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title={`Tenant MCP servers · tenant-owned · ${tenant.length}`} className="overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead className={theadCls}>
            <tr>
              <th className={thCls}>Server</th>
              <th className={thCls}>Owner tenant</th>
              <th className={thCls}>Network</th>
              <th className={`${thCls} w-[150px]`}>Status</th>
              <th className={`${thCls} w-[130px]`}>Health</th>
              <th className={`${thCls} w-px`}><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {tenant.map((s) => {
              const r = tenantRow(M, s);
              const o = open === s.n;
              return (
                <tr key={s.n} onClick={() => pick(o ? null : s.n)} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover" style={{ background: o ? 'var(--brand-tint)' : undefined, boxShadow: `inset 3px 0 0 ${o ? 'var(--brand)' : 'transparent'}` }}>
                  <td className="px-3 py-2.5 font-mono text-[12.5px] font-semibold">{s.n}</td>
                  <td className="px-3 py-2.5">{r.o}</td>
                  <td className="px-3 py-2.5">{r.k}</td>
                  <td className="px-3 py-2.5"><DsPill p={r.status} /></td>
                  <td className="px-3 py-2.5"><DsPill p={r.health} /></td>
                  <td className="px-3 py-2.5 text-right"><DetailsBtn label={s.n} onClick={() => !o && pick(s.n)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {sel && sel.own === 'platform' && (() => {
        const r = sharedRow(M, sel);
        return (
          <Modal
            title={sel.n}
            mono
            sub={r.k}
            onClose={() => pick(null)}
            footer={
              <>
                {P.pEdit && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => check(sel.n)}><Zap size={14} /> Test Connection &amp; Discover Tools</Button>
                    <Button size="sm" variant="outline" onClick={() => setForm({ mode: 'edit', id: sel.n, v: mcpValuesOf(sel), adv: false, tested: null })}><Pencil size={14} /> Edit configuration</Button>
                    <Button size="sm" variant="outline" onClick={() => a.toggle(sel)}>{r.on ? 'Disable' : 'Enable'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => a.del(sel)}>Delete</Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => pick(null)}>Close</Button>
              </>
            }
          >
            <div className="p-1 pb-4">
              <div className="rounded-card border border-line bg-surface">
                {test && <div className="px-4 pt-2"><TestBanner t={test} busyL="Checking connection…" /></div>}
                <div className="grid gap-6 px-4 pb-3 pt-2" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
                  <div><KvLines rows={r.cfg} w={160} /></div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-ink-strong">Tenant availability</span>
                      {!avail && P.pEdit && <button type="button" onClick={() => setAvail(sel.ten.slice())} className="text-[12.5px] font-medium text-brand">Change</button>}
                    </div>
                    {!avail ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.tenChips.map((x) => <span key={x} className="rounded-full bg-surface-sunken px-2.5 py-[3px] text-xs">{x}</span>)}
                        {!r.tenChips.length && <span className="text-[12.5px] text-ink-muted">Not available to any tenant</span>}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {TKEYS.map((t) => {
                            const on = avail.includes(t);
                            return <Chip key={t} n={TN[t]} on={on} toggle={() => setAvail(on ? avail.filter((x) => x !== t) : [...avail, t])} />;
                          })}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setAvail(null)}>Cancel</Button>
                          <Button size="sm" onClick={() => a.availSave(sel)}>Save</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-line-subtle">
                  <table className="w-full border-collapse text-[13px]">
                    <thead className={theadCls}>
                      <tr>
                        <th className={thCls}>Tool</th>
                        <th className={thCls}>Description</th>
                        <th className={thCls}>Enabled in tenants</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.toolRows.map((t) => (
                        <tr key={t.tn} className="border-t border-line-subtle">
                          <td className="px-3 py-2 font-mono text-[12.5px]">{t.tn}</td>
                          <td className="px-3 py-2 text-ink-muted">{t.td}</td>
                          <td className="px-3 py-2">{t.tt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {advOf(sel)}
              </div>
            </div>
          </Modal>
        );
      })()}

      {sel && sel.own !== 'platform' && (() => {
        const r = tenantRow(M, sel);
        return (
          <Modal
            title={sel.n}
            mono
            width={680}
            sub={`${r.o} · ${r.k}`}
            onClose={() => pick(null)}
            footer={
              <>
                {P.pEdit && <Button size="sm" variant="outline" onClick={() => a.susp(sel)}>{sel.susp ? 'Resume' : 'Suspend'}</Button>}
                <Button size="sm" variant="outline" onClick={() => pick(null)}>Close</Button>
              </>
            }
          >
            <div className="p-1 pb-4">
              <div className="rounded-card border border-line bg-surface">
                <div className="px-4 pb-2"><KvLines rows={r.cfg} w={160} /></div>
                {advOf(sel)}
              </div>
            </div>
          </Modal>
        );
      })()}

      {form && (
        <McpFormDialog
          M={M}
          init={form}
          close={() => setForm(null)}
          save={(F) => {
            const r = applyMcp(mcpRegStore.get(), F, P.uid);
            if ('err' in r) return r.err;
            apply(r);
            setForm(null);
            if (F.mode === 'add') pick(F.v.n);
            return '';
          }}
        />
      )}
    </div>
  );
}

const SELECT_CRED = 'Select credential';

/** Register / edit a shared MCP server (markup block mcpFOpen, platform scope). */
function McpFormDialog({ M, init, close, save }: { M: McpRegistry; init: McpForm; close: () => void; save: (F: McpForm) => string }) {
  const [F, setF] = React.useState<McpForm>(init);
  const [err, setErr] = React.useState('');
  const [test, setTest] = React.useState<TestState>(null);
  const timer = React.useRef<number>();
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const v = F.v;
  const isEdit = F.mode === 'edit';
  const secs = MCP_SECRETS.platform;
  const set = (p: Partial<McpValues>) => {
    setErr('');
    setF((f) => ({ ...f, v: { ...f.v, ...p } }));
  };
  /** connection changes invalidate a previous test */
  const reset = (p: Partial<McpValues>) => {
    setTest(null);
    setErr('');
    setF((f) => ({ ...f, tested: null, v: { ...f.v, ...p } }));
  };
  const runTest = () => {
    const r = discoverMcp(M, F);
    if ('err' in r) return setErr(r.err);
    setTest({ s: 'busy' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setF((f) => ({ ...f, tested: r.tools }));
      setTest({ s: r.ok ? 'ok' : 'fail', m: r.msg });
    }, 900);
  };
  const toolsL = (F.tested ?? v.tools ?? []).map((t) => t.n).join(', ');
  return (
    <Modal
      title={isEdit ? `Edit configuration · ${v.n}` : 'Register shared MCP server'}
      width={560}
      z={91}
      onClose={close}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={runTest}><Zap size={14} /> Test Connection &amp; Discover Tools</Button>
          <span className="flex-1" />
          <Button size="sm" variant="outline" onClick={close}>Cancel</Button>
          <Button size="sm" onClick={() => setErr(save(F))}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <TextIn label="Name" value={v.n} ph="e.g. hr_directory" disabled={isEdit} tip={isEdit ? 'Names can’t be changed after creation.' : ''} set={(x) => set({ n: x })} />
        </div>
        <div>
          <TextIn label="MCP Server URL" value={v.up} ph="https://…/mcp" set={(x) => reset({ up: x })} />
          <div className="mt-1 text-xs text-ink-muted">Endpoint of an MCP-compatible server (Streamable HTTP).</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectIn label="Authentication" value={v.auth} opts={['OAuth2 client credentials', 'API key', 'mTLS', 'None']} set={(x) => reset({ auth: x, secret: x === 'None' ? '' : v.secret })} />
          {v.auth !== 'None' && (
            <SelectIn label="Credential" value={v.secret ? v.secret.split('/').pop()! : SELECT_CRED} opts={[SELECT_CRED, ...secs.map((x) => x.split('/').pop()!)]} set={(x) => reset({ secret: secs.find((s) => s.split('/').pop() === x) || '' })} />
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SelectIn label="Classification ceiling" value={v.cls} opts={['L0 · Public', 'L1 · Internal', 'L2 · Restricted']} set={(x) => set({ cls: x })} />
          <SelectIn label="Personal data" value={v.pii} opts={['Not allowed', 'Masked', 'Allowed']} set={(x) => set({ pii: x })} />
          <SelectIn label="Side effects" value={v.fx} opts={['Read-only', 'Changes state']} set={(x) => set({ fx: x })} />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-strong">Tenant availability</div>
          <div className="flex flex-wrap gap-1.5">
            {TKEYS.map((t) => {
              const on = v.ten.includes(t);
              return <Chip key={t} n={TN[t]} on={on} toggle={() => set({ ten: on ? v.ten.filter((x) => x !== t) : [...v.ten, t] })} />;
            })}
          </div>
        </div>
        {toolsL && <div className="text-[12.5px] text-ink-muted">Tools: <span className="font-mono">{toolsL}</span></div>}
        <div>
          <AdvToggle open={F.adv} set={(o) => setF((f) => ({ ...f, adv: o }))} />
          {F.adv && (
            <div className="mt-3 flex flex-col gap-3">
              <TextIn label="Egress allowlist" value={v.dest} ph="host:port" set={(x) => reset({ dest: x })} />
              <div className="grid grid-cols-3 gap-3">
                <TextIn label="Timeout (seconds)" value={v.timeout} ph="30" set={(x) => set({ timeout: x })} />
                <TextIn label="Retries" value={v.retries} ph="2" set={(x) => set({ retries: x })} />
                <TextIn label="Rate limit" value={v.rate} ph="60 / min" set={(x) => set({ rate: x })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectIn label="Tool discovery" value={v.disc} opts={['Automatic', 'Manual']} set={(x) => set({ disc: x })} />
                <TextIn label="Description" value={v.vendor} set={(x) => set({ vendor: x })} />
              </div>
            </div>
          )}
        </div>
        <ErrBanner err={err} />
        <TestBanner t={test} busyL="Checking connection…" />
      </div>
    </Modal>
  );
}
