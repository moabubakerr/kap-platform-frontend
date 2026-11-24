/**
 * Model Providers Registry (route /platform/models/:id?). Bespoke screen
 * `showPModels` of the v35 design: registered models with their connection,
 * tenant availability, status and health; a details panel with test, edit,
 * emergency disable, enable/disable and delete; the add/edit model form with
 * connection reuse and a simulated provider test. Port of `regScreen`.
 */
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, TriangleAlert, Zap } from 'lucide-react';
import { useCrumbs } from '@/app/shell/crumbs';
import { Button } from '@/components/ui/button';
import { DsPill } from '@/engine/ScreenView';
import { EmptyState } from '@/components/common/primitives';
import { ASR_LANGS, MODEL_CATALOG, MODEL_TYPES, registryStore, TKEYS, TN, type Dep, type Registry, type TKey } from '@/v35/data/platform';
import {
  applyKill, applyModel, blankModel, connFieldsOf, credLabel, deleteDep, depRow, depRows, depsOf, editModel, formInfo, newConnFields, revokeDep, setDepStatus, simOf, testModelForm, testMsg, toggleTenant,
  validateKill, validateModel, type Applied, type DepUse, type ModelForm, type ModelValues,
} from './build';
import { AdvToggle, Chip, DetailsBtn, ErrBanner, KvLines, Modal, Seg, SelectIn, TestBanner, TextIn, thCls, theadCls, useBanner, type TestState } from './ui';
import { usePlatform } from './usePlatform';
import { kap, kapError } from '@/api/kap';
import { LiveBanner, liveSave } from '@/v35/live';
import { applyCheck, checkMsg, kapCfg, LIVE_TENANT, providerFields, toKapCreate, toKapPatch, type KapModelProvider, type KapProviderCheck } from './fromKap';
import { kapModelsStore, useKapModels } from './useKapModels';

const toItems = (xs: DepUse[]) => xs.map((u) => ({ a: u.t, b: u.k, c: u.n }));

export default function ModelsRegistryPage() {
  const P = usePlatform('Model Providers Registry');
  const R = registryStore.use();
  const { live, kapm } = useKapModels();
  const kp = (id: string): KapModelProvider | undefined => kapm.byDep[id];
  const { tab } = useParams();
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState<string | null>(tab && R.deps.some((x) => x.id === tab) ? tab : null);
  const [test, setTest] = React.useState<TestState>(null);
  const [form, setForm] = React.useState<ModelForm | null>(null);
  const banner = useBanner();
  const timer = React.useRef<number>();
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  useCrumbs([open ?? undefined]);

  if (!P.canRead) return <div className="px-8 pt-3"><EmptyState title="You don't have access to platform administration" body="Sign in with a platform administrator account." /></div>;

  const apply = (r: Applied<Registry>) => {
    registryStore.set(r.next);
    banner.show(r.msg);
    P.audit(r.evs);
  };
  const pick = (id: string | null) => {
    setOpen(id);
    setTest(null);
  };

  const rows = depRows(R, q);
  const sel = open ? R.deps.find((x) => x.id === open) : undefined;

  // ---- live entries: the sandbox tenant's KAP model providers
  const tid = live.tenantId;
  const kapAudit = (action: string, res: string) => P.audit([{ action, res: `${res} · KAP`, tenants: [LIVE_TENANT] }]);
  const k = {
    test: (d: Dep, p: KapModelProvider) => {
      if (!tid) return;
      setTest({ s: 'busy', m: undefined });
      kap<KapProviderCheck>(tid, 'POST', `model-providers/${p.id}/check`).then(
        (c) => {
          kapModelsStore.update((s) => void (s.checks[p.id] = c));
          registryStore.set(applyCheck(registryStore.get(), d.id, p, c));
          setTest({ s: c.status === 'ok' ? 'ok' : 'fail', m: checkMsg(c) });
        },
        (e) => setTest({ s: 'fail', m: `KAP check failed: ${kapError(e)}` }),
      );
    },
    edit: (d: Dep, p: KapModelProvider) =>
      P.d.form(`Edit KAP model provider · ${d.id}`, providerFields(p), 'Save', async (v) => {
        const r = toKapPatch(p, v);
        if ('err' in r) return r.err;
        if (!Object.keys(r.body).length) return 'No change.';
        return liveSave(live, () => kap(tid!, 'PATCH', `model-providers/${p.id}`, r.body), () => {
          banner.show(`Model provider "${p.name}" saved in KAP.`);
          kapAudit('Updated model', `${p.name} · ${Object.keys(r.body).join(', ')}`);
          setTest(null);
        });
      }),
    del: (d: Dep, p: KapModelProvider) =>
      P.d.confirm(
        `Delete ${d.id}?`,
        'KAP deactivates the provider and revokes its access assignments; the key stays in the secret store. Creating a provider with the same name brings it back. KAP refuses while an agent or another resource uses it, and names them.',
        [],
        'Delete',
        () =>
          liveSave(live, () => kap(tid!, 'DELETE', `model-providers/${p.id}`), () => {
            banner.show(`Model provider "${p.name}" deleted in KAP.`);
            kapAudit('Deleted model', p.name);
            pick(null);
          }),
      ),
    add: () =>
      P.d.form('Add model provider · sandbox (KAP)', providerFields(null), 'Create', async (v) => {
        const r = toKapCreate(v);
        if ('err' in r) return r.err;
        return liveSave(live, () => kap(tid!, 'POST', 'model-providers', r.body), () => {
          banner.show(`Model provider "${String(r.body.name)}" created in KAP for sandbox. Run Test to check it.`);
          kapAudit('Added model', `${String(r.body.name)} · ${String(r.body.model_type)}`);
        });
      }),
  };

  const a = {
    test: (d: Dep) => {
      const p = kp(d.id);
      if (p) return k.test(d, p);
      if (d.status !== 'Active') return setTest({ s: 'fail', m: 'Test not run · the model is disabled.' });
      setTest({ s: 'busy' });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const cur = registryStore.get();
        const x = cur.deps.find((y) => y.id === d.id);
        if (!x) return;
        const r = simOf(x.model, cur.conns.find((c) => c.id === x.conn)?.ep ?? '');
        const next = structuredClone(cur);
        const y = next.deps.find((z) => z.id === d.id)!;
        if (r.ok) Object.assign(y, { lastOk: 'just now', health: 'Healthy', verified: r.caps.filter((c) => y.caps.includes(c)), lat: `p95 ${r.lat}` });
        else Object.assign(y, { health: 'Failing', errors: 'Last test failed' });
        registryStore.set(next);
        setTest({ s: r.ok ? 'ok' : 'fail', m: testMsg(r, d.caps) });
      }, 900);
    },
    toggle: (d: Dep) => {
      if (d.status !== 'Active') return apply(setDepStatus(R, d.id, true));
      const items = depsOf(R, d);
      P.d.confirm(`Disable ${d.id}?`, items.length ? 'These will stop working until they use another model:' : 'Not in use.', toItems(items), 'Disable', () => apply(setDepStatus(registryStore.get(), d.id, false)));
    },
    del: (d: Dep) => {
      const p = kp(d.id);
      if (p) return k.del(d, p);
      const items = depsOf(R, d);
      if (items.length) return P.d.info(`Delete ${d.id}?`, 'Still in use. Move these to another model first:', toItems(items));
      P.d.confirm(`Delete ${d.id}?`, 'This can’t be undone.', [], 'Delete', () => {
        apply(deleteDep(registryStore.get(), d.id));
        pick(null);
      });
    },
    tenant: (d: Dep, k: TKey | 'all') => {
      const r = toggleTenant(R, d.id, k);
      if ('confirm' in r) {
        const t = r.confirm;
        const items = depsOf(R, d).filter((x) => x.tk === t);
        P.d.confirm(`Withdraw ${d.id} from ${TN[t]}?`, 'These will stop working:', toItems(items), 'Withdraw', () => apply(revokeDep(registryStore.get(), d.id, t)));
        return;
      }
      apply(r);
    },
    kill: (d: Dep) => {
      const users = depsOf(R, d).map((x) => x.n).filter(Boolean).slice(0, 6).join(', ');
      P.d.form(
        `Emergency disable · ${d.id}`,
        [
          { type: 'note', tone: 'bad', label: 'Takes effect immediately', text: `Emergency disablement takes effect at once, without a new version. Agents using ${d.id} switch to their fallback model or stop${users ? `: ${users}` : ''}.` },
          { k: 'reason', label: 'Reason', type: 'text', ph: 'e.g. Unsafe output observed in job b1c94f08' },
          { k: 'ack', label: 'Confirmation', type: 'select', opts: ['Select', `Disable ${d.id} now`] },
        ],
        'Disable now',
        (v) => {
          const e = validateKill(d.id, v);
          if (e) return e;
          apply(applyKill(registryStore.get(), d.id, v.reason, P.uid, `AUD-${String(Date.now()).slice(-6)}`));
          return '';
        },
      );
    },
  };

  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="h1">Model Providers Registry</h1>
        {P.pEdit && (
          <div className="flex flex-wrap gap-2">
            {live.on && (
              <Button size="sm" variant="outline" onClick={k.add} title="Creates a model provider in KAP for the sandbox tenant">
                <Plus size={15} /> Add KAP provider · sandbox
              </Button>
            )}
            <Button size="sm" onClick={() => { setTest(null); setForm({ mode: 'add', v: blankModel(R, 'LLM') }); }}>
              <Plus size={15} /> Add model
            </Button>
          </div>
        )}
      </div>
      {live.on && (
        <div>
          <LiveBanner live={live} what="sandbox model providers" />
          <div className="-mt-1 text-[12.5px] text-ink-muted">Entries marked Live · KAP are the sandbox tenant’s KAP model providers: test, edit and delete act in KAP. The other entries are the design’s sample registry (session only).</div>
        </div>
      )}
      {banner.node}
      <div className="w-[320px] max-w-full">
        <input type="search" value={q} placeholder="Search models" onChange={(e) => setQ(e.target.value)} className="h-9 w-full rounded-card border border-line bg-surface px-3 text-[13.5px] outline-none focus-visible:shadow-focus" />
      </div>
      <div className="overflow-auto rounded-card border border-line-subtle bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead className={theadCls}>
            <tr>
              <th className={thCls}>Model</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>Connection</th>
              <th className={thCls}>Tenant availability</th>
              <th className={`${thCls} w-[120px]`}>Status</th>
              <th className={`${thCls} w-[130px]`}>Health</th>
              <th className={`${thCls} w-px`}><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const o = open === r.d.id;
              return (
                <tr key={r.d.id} onClick={() => pick(o ? null : r.d.id)} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover" style={{ background: o ? 'var(--brand-tint)' : undefined, boxShadow: `inset 3px 0 0 ${o ? 'var(--brand)' : 'transparent'}` }}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-semibold text-ink-strong">{r.d.id}</span>
                      {kp(r.d.id) && <span className="rounded-sm bg-info-bg px-1.5 py-px text-[11px] font-medium text-info" title="A KAP model provider of the sandbox tenant">Live · KAP</span>}
                    </div>
                    <div className="text-xs text-ink-muted">{r.d.model}</div>
                  </td>
                  <td className="px-3 py-2.5">{r.ty}</td>
                  <td className="px-3 py-2.5">
                    <div>{r.cn}</div>
                    <div className="text-xs text-ink-muted">{r.prov}</div>
                  </td>
                  <td className="px-3 py-2.5">{r.availL}</td>
                  <td className="px-3 py-2.5"><DsPill p={r.status} /></td>
                  <td className="px-3 py-2.5"><DsPill p={r.health} /></td>
                  <td className="px-3 py-2.5 text-right"><DetailsBtn label={r.d.id} onClick={() => !o && pick(r.d.id)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="p-8 text-center text-ink-muted">No models found.</div>}
      </div>

      {sel && (
        <DepDetails
          R={R}
          d={sel}
          kp={kp(sel.id)}
          pEdit={P.pEdit}
          test={test}
          a={a}
          close={() => pick(null)}
          edit={() => {
            const p = kp(sel.id);
            if (p) return k.edit(sel, p);
            setTest(null);
            setForm(editModel(R, sel));
          }}
          audit={() => P.goP('pAudit')}
        />
      )}
      {form && (
        <ModelFormDialog
          R={R}
          init={form}
          close={() => setForm(null)}
          save={(F) => {
            const r = applyModel(registryStore.get(), F, P.uid);
            apply(r);
            setForm(null);
            pick(r.id);
          }}
        />
      )}
    </div>
  );
}

function DepDetails({ R, d, kp, pEdit, test, a, close, edit, audit }: {
  R: Registry; d: Dep; kp?: KapModelProvider; pEdit: boolean; test: TestState; close: () => void; edit: () => void; audit: () => void;
  a: { test: (d: Dep) => void; toggle: (d: Dep) => void; del: (d: Dep) => void; tenant: (d: Dep, k: TKey | 'all') => void; kill: (d: Dep) => void };
}) {
  const r = depRow(R, d);
  if (kp) return <KapDepDetails r={r} d={d} kp={kp} pEdit={pEdit} test={test} a={a} close={close} edit={edit} />;
  return (
    <Modal
      title={d.id}
      mono
      sub={`${d.model} · ${r.ty}`}
      onClose={close}
      footer={
        <>
          {pEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => a.test(d)}><Zap size={14} /> Test</Button>
              <Button size="sm" variant="outline" onClick={edit}><Pencil size={14} /> Edit</Button>
              {r.on && <Button size="sm" variant="outline" onClick={() => a.kill(d)}><TriangleAlert size={15} /> Emergency disable</Button>}
              {d.kill && <Button size="sm" variant="outline" onClick={audit}>View audit record</Button>}
              <Button size="sm" variant="outline" onClick={() => a.toggle(d)}>{r.on ? 'Disable' : 'Enable'}</Button>
              <Button size="sm" variant="ghost" onClick={() => a.del(d)}>Delete</Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={close}>Close</Button>
        </>
      }
    >
      <div className="p-1 pb-4">
        <div className="rounded-card border border-line bg-surface">
          <div className="flex flex-col gap-2 px-4 pt-2 empty:hidden">{test && <TestBanner t={test} />}</div>
          <div className="mt-2 grid grid-cols-3 border-y border-line-subtle sm:grid-cols-6">
            {r.ops.map(([k, v]) => (
              <div key={k} className="min-w-0 border-r border-line-subtle px-4 py-2.5">
                <div className="text-[11.5px] text-ink-muted">{k}</div>
                <div className="truncate text-[13px] font-medium text-ink-strong" title={v}>{v}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-6 px-4 pb-4 pt-3" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
            <div>
              <div className="mb-1 text-[13px] font-semibold text-ink-strong">Configuration</div>
              <KvLines rows={r.cfg} />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-ink-strong">Tenant availability</div>
                <Seg opts={[['all', 'All tenants'], ['sel', 'Selected tenants']]} cur={d.all ? 'all' : 'sel'} pick={() => a.tenant(d, 'all')} ro={!pEdit} />
                {!d.all && (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {TKEYS.map((t) => <Chip key={t} n={TN[t]} on={d.ten.includes(t)} toggle={() => a.tenant(d, t)} ro={!pEdit} />)}
                    </div>
                    {!d.ten.length && <div className="mt-1.5 text-[12.5px] text-danger-fg">Not available to any tenant</div>}
                  </>
                )}
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-ink-strong">Used by</div>
                {r.uses.map((u, i) => (
                  <div key={i} className="flex gap-2.5 py-[3px] text-[12.5px]">
                    <span className="w-[120px] flex-none text-ink-muted">{u.t}</span>
                    <span className="w-[100px] flex-none text-ink-muted">{u.k}</span>
                    <span className="font-mono">{u.n}</span>
                  </div>
                ))}
                {!r.uses.length && <div className="text-[12.5px] text-ink-muted">Not in use</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Details of a live entry (a KAP model provider of the sandbox tenant). */
function KapDepDetails({ r, d, kp, pEdit, test, a, close, edit }: {
  r: ReturnType<typeof depRow>; d: Dep; kp: KapModelProvider; pEdit: boolean; test: TestState; close: () => void; edit: () => void;
  a: { test: (d: Dep) => void; del: (d: Dep) => void };
}) {
  return (
    <Modal
      title={d.id}
      mono
      sub={`${d.model} · ${r.ty} · KAP model provider`}
      onClose={close}
      footer={
        <>
          {pEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => a.test(d)} disabled={test?.s === 'busy'}><Zap size={14} /> Test</Button>
              <Button size="sm" variant="outline" onClick={edit}><Pencil size={14} /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => a.del(d)}>Delete</Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={close}>Close</Button>
        </>
      }
    >
      <div className="p-1 pb-4">
        <div className="rounded-card border border-line bg-surface">
          <div className="flex flex-col gap-2 px-4 pt-2 empty:hidden">{test && <TestBanner t={test} busyL="Checking in KAP…" />}</div>
          <div className="mt-2 grid grid-cols-3 border-y border-line-subtle sm:grid-cols-6">
            {r.ops.map(([k, v]) => (
              <div key={k} className="min-w-0 border-r border-line-subtle px-4 py-2.5">
                <div className="text-[11.5px] text-ink-muted">{k}</div>
                <div className="truncate text-[13px] font-medium text-ink-strong" title={v}>{v}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-6 px-4 pb-4 pt-3" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
            <div>
              <div className="mb-1 text-[13px] font-semibold text-ink-strong">Configuration</div>
              <KvLines rows={kapCfg(kp)} />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-ink-strong">Tenant availability</div>
                <div className="flex flex-wrap gap-1.5"><Chip n={TN[LIVE_TENANT]} on toggle={() => {}} ro /></div>
                <div className="mt-1.5 text-[12.5px] text-ink-muted">KAP model providers belong to one tenant: this one is the sandbox tenant’s and can’t be offered to other tenants.</div>
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-ink-strong">Used by</div>
                <div className="text-[12.5px] text-ink-muted">KAP does not list the agents and collections that use a provider here. Deleting or renaming it is refused while one does, and KAP names them.</div>
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-ink-strong">Not in KAP</div>
                <div className="text-[12.5px] text-ink-muted">Enable/disable and emergency disable, capabilities beyond the model type, and request, latency and utilisation figures. Health comes from the last Test (KAP check) in this session.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const SELECT_CRED = 'Select credential';
const SELECT_CONTRACT = 'Select API contract';
const UNTEST = { tested: null, verified: null };

/** Add / edit model (markup block regFormOpen). */
function ModelFormDialog({ R, init, close, save }: { R: Registry; init: ModelForm; close: () => void; save: (F: ModelForm) => void }) {
  const [F, setF] = React.useState<ModelForm>(init);
  const [err, setErr] = React.useState('');
  const [test, setTest] = React.useState<TestState>(null);
  const timer = React.useRef<number>();
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const v = F.v;
  const isEdit = F.mode === 'edit';
  const I = formInfo(R, F);
  const M = I.M;
  const set = (p: Partial<ModelValues>) => {
    if ('tested' in p) setTest(null);
    setErr('');
    setF((f) => ({ ...f, v: { ...f.v, ...p } }));
  };
  const setC = (p: Partial<ModelValues['c']>) => {
    setTest(null);
    setErr('');
    setF((f) => ({ ...f, v: { ...f.v, ...UNTEST, c: { ...f.v.c, ...p } } }));
  };
  const setP = (p: Record<string, any>) => {
    setErr('');
    setF((f) => ({ ...f, v: { ...f.v, params: { ...f.v.params, ...p } } }));
  };
  const pv = (k: string) => String((v.params || {})[k] || (v as unknown as Record<string, string>)[k] || '');
  const credName = v.c.cred ? labelOf(v.c.cred) : SELECT_CRED;

  const runTest = () => {
    const r = testModelForm(R, F);
    if ('err' in r) return setErr(r.err);
    setErr('');
    setF((f) => ({ ...f, v: { ...f.v, tested: r.tested, verified: r.verified } }));
    setTest({ s: 'busy' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTest({ s: r.ok ? 'ok' : 'fail', m: r.msg }), 900);
  };
  const doSave = () => {
    const e = validateModel(R, F);
    if (e) return setErr(e);
    save(F);
  };
  const capOk = (x: string) => !I.known || I.known.includes(x);
  const curLangs: string[] = (v.params || {}).langs || [];

  return (
    <Modal
      title={isEdit ? `Edit model · ${F.id}` : 'Add model'}
      width={560}
      z={91}
      onClose={close}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={runTest}><Zap size={14} /> Test</Button>
          <span className="flex-1" />
          <Button size="sm" variant="outline" onClick={close}>Cancel</Button>
          <Button size="sm" onClick={doSave}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5 px-5 py-4">
        <TextIn label="Name" value={v.id} set={(x) => set({ id: x })} ph="e.g. sceai-chat-prod" disabled={isEdit} tip={isEdit ? 'Names can’t be changed after creation.' : ''} />
        <SelectIn label="Model type" value={v.type} disabled={isEdit} opts={Object.keys(MODEL_TYPES)} set={(ty) => { setTest(null); setErr(''); setF((f) => ({ ...f, v: { ...blankModel(R, ty), id: f.v.id, model: f.v.model } })); }} />
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-strong">Connection</div>
          <Seg
            opts={[['existing', 'Use existing connection', !I.exist.length], ['new', 'New connection']]}
            cur={v.connMode}
            pick={(k) => set({ connMode: k, editConn: false, ...UNTEST, conn: k === 'new' ? '' : I.exist[0].id, ctype: k === 'new' ? M.conns[0] : I.exist[0].type, c: k === 'new' ? newConnFields(M.conns[0]) : connFieldsOf(I.exist[0]) })}
          />
        </div>
        {!I.isNew && (
          <div className="flex flex-col gap-1.5">
            <SelectIn
              label="Existing connection"
              value={I.ec ? I.connLabel(I.ec) : ''}
              opts={I.exist.map(I.connLabel)}
              set={(x) => {
                const c = I.exist.find((y) => I.connLabel(y) === x);
                if (c) set({ conn: c.id, ctype: c.type, editConn: false, contract: '', ...UNTEST, c: connFieldsOf(c) });
              }}
            />
            {I.connSummary && (
              <div className="flex items-center justify-between gap-3 text-[12.5px] text-ink-muted">
                <span className="font-mono [overflow-wrap:anywhere]">{I.connSummary}</span>
                <button type="button" onClick={() => set({ editConn: true })} className="whitespace-nowrap font-medium text-brand">Edit connection</button>
              </div>
            )}
          </div>
        )}
        {I.showConn && (
          <div className="flex flex-col gap-3 rounded-sm border border-line-subtle bg-surface-sunken p-3">
            {I.sharedWarn && <div className="text-[12.5px] text-warning-fg">{I.sharedWarn}</div>}
            {I.isNew && <SelectIn label="Connection type" value={v.ctype} opts={M.conns} set={(ct) => set({ ctype: ct, c: newConnFields(ct), contract: '', ...UNTEST })} />}
            <TextIn label="Endpoint" value={v.c.ep} ph="https://" set={(x) => setC({ ep: x })} />
            <SelectIn label="Credential" value={credName} opts={[SELECT_CRED, ...I.credVals.map(labelOf)]} set={(l) => setC({ cred: I.credVals.find((x) => labelOf(x) === l) || '' })} />
          </div>
        )}
        {I.needContract && <SelectIn label="API contract" value={v.contract || SELECT_CONTRACT} opts={[SELECT_CONTRACT, ...I.contracts]} set={(x) => set({ contract: x === SELECT_CONTRACT ? '' : x, ...UNTEST })} />}
        <div className="grid grid-cols-2 gap-3">
          <TextIn
            label="Model"
            value={v.model}
            ph="Model identifier"
            set={(m) => {
              const kn = MODEL_CATALOG_OF(m);
              set({ model: m, ...UNTEST, caps: M.fixed ? M.caps.slice() : kn ? kn.filter((x) => M.caps.includes(x)) : v.caps });
            }}
          />
          {I.isAzure && <TextIn label="Azure deployment" value={v.did} ph="e.g. gpt-4o-prod" set={(x) => set({ did: x })} />}
        </div>
        {!M.fixed && (
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink-strong">{M.capL}</div>
            <div className="flex flex-wrap gap-1.5">
              {M.caps.map((x) => {
                const on = v.caps.includes(x);
                const ok = capOk(x);
                return <Chip key={x} n={x} on={on} off={!ok} tip={ok ? '' : `Not supported by ${v.model.trim()}`} toggle={() => set({ caps: on ? v.caps.filter((y) => y !== x) : [...v.caps, x] })} />;
              })}
            </div>
          </div>
        )}
        {I.capStatus && <div className="-mt-1.5 text-xs text-ink-muted">{I.capStatus}</div>}
        {M.langs && (
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink-strong">Languages</div>
            <div className="flex flex-wrap gap-1.5">
              {ASR_LANGS.map((x) => {
                const on = curLangs.includes(x);
                return <Chip key={x} n={x} on={on} toggle={() => setP({ langs: on ? curLangs.filter((y) => y !== x) : [...curLangs, x] })} />;
              })}
            </div>
          </div>
        )}
        {M.params.some((x) => !x[3]) && (
          <div className="grid grid-cols-2 gap-3">
            {M.params.filter((x) => !x[3]).map(([k, l, ph]) => <TextIn key={k} label={l} value={pv(k)} ph={ph} set={(x) => setP({ [k]: x })} />)}
          </div>
        )}
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-strong">Tenant availability</div>
          <Seg opts={[['all', 'All tenants'], ['sel', 'Selected tenants']]} cur={v.all ? 'all' : 'sel'} pick={(k) => set({ all: k === 'all' })} />
          {!v.all && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TKEYS.map((t) => {
                const on = v.ten.includes(t);
                return <Chip key={t} n={TN[t]} on={on} toggle={() => set({ ten: on ? v.ten.filter((y) => y !== t) : [...v.ten, t] })} />;
              })}
            </div>
          )}
        </div>
        <div>
          <AdvToggle open={v.adv} set={(o) => set({ adv: o })} />
          {v.adv && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {M.params.filter((x) => x[3]).map(([k, l, ph]) => <TextIn key={k} label={l} value={pv(k)} ph={ph} set={(x) => setP({ [k]: x })} />)}
                <TextIn label="Vendor" value={v.vendor} ph="Optional" set={(x) => set({ vendor: x })} />
              </div>
              <div className="-mb-1.5 text-[13px] font-medium text-ink-strong">Endpoint limits</div>
              <div className="grid grid-cols-3 gap-3">
                <TextIn label="Tokens per minute" value={v.tpm} ph="e.g. 400k" set={(x) => set({ tpm: x })} />
                <TextIn label="Max concurrent requests" value={v.conc} ph="e.g. 32" set={(x) => set({ conc: x })} />
                <TextIn label="Interactive reserve (%)" value={v.reserve} ph="e.g. 30" set={(x) => set({ reserve: x })} />
              </div>
              {I.showConn && (
                <>
                  {I.isAzure && (
                    <div className="grid grid-cols-2 gap-3">
                      <TextIn label="Region" value={v.c.region} ph="e.g. UAE North" set={(x) => setC({ region: x })} />
                      <TextIn label="API version" value={v.c.apiver} ph="2024-10-21" set={(x) => setC({ apiver: x })} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <SelectIn label="TLS" value={v.c.tls} opts={['Public CA', 'Internal CA · kap-ca']} set={(x) => setC({ tls: x })} />
                    <TextIn label="Timeout (seconds)" value={v.c.timeout} ph="30" set={(x) => setC({ timeout: x })} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <ErrBanner err={err} />
        <TestBanner t={test} />
      </div>
    </Modal>
  );
}

const labelOf = (x: string) => credLabel(x);
const MODEL_CATALOG_OF = (m: string): string[] | undefined => MODEL_CATALOG[m.trim()];
