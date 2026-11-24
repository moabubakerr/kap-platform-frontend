/**
 * Renders a v35 ScreenModel: page header (title, status, actions, tabs),
 * filter bar, and sections — stats, table (with a details panel), form,
 * timeline, diagram, callout, pager, or custom content.
 * Port of the prototype's `paHead` header and `iamScr` template.
 */
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronRight, Info, Lock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { StatusPill, type Status } from '@/components/ui/status-pill';
import { EmptyState } from '@/components/common/primitives';
import { Diagram } from './Diagram';
import type { Action, Cell, DsStatus, FilterField, Filters, PageHead, Row, ScreenModel, Section } from './types';

const DS_TO_STATUS: Record<DsStatus, Status> = { draft: 'draft', submitted: 'running', review: 'warning', approved: 'approved', rejected: 'rejected', hold: 'hold' };

export function DsPill({ p }: { p: [DsStatus, string] }) {
  return <StatusPill status={DS_TO_STATUS[p[0]] ?? 'draft'} label={p[1]} />;
}

function ActButton({ a, size = 'sm' }: { a: Action; size?: 'sm' | 'xs' }) {
  const variant = a.v === 'secondary' ? 'secondary' : a.v === 'ghost' ? 'ghost' : a.v === 'danger' ? 'danger' : a.v === 'primary' ? 'primary' : 'outline';
  return (
    <Button size={size} variant={variant} onClick={a.f}>
      {a.l}
    </Button>
  );
}

function LinkAct({ a }: { a: Action }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        a.f();
      }}
      className="ml-3 inline-block rounded px-1 py-0.5 text-[12.5px] font-medium text-brand hover:bg-brand-tint"
    >
      {a.l}
    </button>
  );
}

// ------------------------------------------------------------------ header
export function PageHeadView({ head }: { head: PageHead }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="h1">{head.title}</h1>
            {head.status && <DsPill p={head.status} />}
          </div>
          {head.sub && <div className="mt-0.5 text-ink-muted">{head.sub}</div>}
        </div>
        {(head.add || (head.acts && head.acts.length > 0)) && (
          <div className="flex flex-wrap items-center gap-2">
            {head.acts?.map((a) => <ActButton key={a.l} a={a} />)}
            {head.add && <ActButton a={{ ...head.add, v: 'primary' }} />}
          </div>
        )}
      </div>
      {head.tabs && head.tabs.length > 0 && <Tabs items={head.tabs} value={head.tab ?? head.tabs[0].value} onChange={(v) => head.setTab?.(v)} />}
    </div>
  );
}

// ------------------------------------------------------------------ filters
const inputCls = 'h-[34px] w-full min-w-0 rounded-sm border border-line bg-surface px-2 text-[13px] text-ink-body outline-none focus-visible:shadow-focus';

function Field({ f }: { f: FilterField }) {
  return (
    <label className="flex min-w-[150px] flex-[1_1_150px] flex-col gap-1 text-xs text-ink-muted">
      <span>{f.label}</span>
      {f.date ? (
        <input type="date" value={f.value} onChange={(e) => f.onChange(e.target.value)} className={inputCls} />
      ) : (
        <select value={f.value} onChange={(e) => f.onChange(e.target.value)} className={inputCls}>
          {(f.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
    </label>
  );
}

function FilterBar({ f }: { f: Filters }) {
  const [adv, setAdv] = React.useState(false);
  return (
    <div className="card flex flex-col gap-2.5 px-3.5 py-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-[200px] flex-[2_1_240px] flex-col gap-1 text-xs text-ink-muted">
          <span>{f.qLabel ?? 'Search'}</span>
          <input type="search" value={f.q} placeholder={f.qPlaceholder} onChange={(e) => f.setQ(e.target.value)} className={inputCls} />
        </label>
        {f.main.map((x) => (
          <Field key={x.label} f={x} />
        ))}
        <div className="flex items-center gap-2">
          {f.adv && f.adv.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setAdv((v) => !v)}>
              {f.advLabel ?? 'More filters'}
            </Button>
          )}
          {f.chips && f.chips.length > 0 && f.clear && (
            <Button size="sm" variant="ghost" onClick={f.clear}>
              Clear all
            </Button>
          )}
        </div>
      </div>
      {adv && f.adv && (
        <div className="flex flex-wrap gap-2.5 border-t border-line-subtle pt-2.5">
          {f.adv.map((x) => (
            <Field key={x.label} f={x} />
          ))}
        </div>
      )}
      {(f.count || (f.chips && f.chips.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          {f.count && <span className="mr-1 text-ink-muted">{f.count}</span>}
          {f.chips?.map((c) => (
            <span key={c.l} className="inline-flex h-[26px] items-center gap-1 rounded-[13px] bg-brand-tint pl-2.5 pr-1 font-medium text-brand">
              {c.l}
              <button type="button" aria-label="Remove filter" onClick={c.x} className="flex rounded-[10px] p-0.5">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ sections
function CellView({ c }: { c: Cell }) {
  if (c.p) return <DsPill p={c.p} />;
  return (
    <>
      <div className={c.m ? 'font-mono text-[12.5px] font-semibold text-ink-strong' : undefined}>{c.v}</div>
      {c.sub && <div className="text-xs text-ink-muted">{c.sub}</div>}
    </>
  );
}

const hasDetails = (r: Row) => !!((r.kv && r.kv.length) || (r.lists && r.lists.some((l) => l.items.length)) || (r.perms && r.perms.length));

/** A panel shows only what the row does not: drop detail values already visible in the row. */
function visibleKv(r: Row) {
  if (r.keepKv) return (r.kv ?? []).filter((q) => q.v !== '—');
  const seen = new Set<string>();
  for (const c of r.cells) for (const v of [c.v, c.sub, c.p?.[1]]) if (v) {
    seen.add(String(v));
    String(v).split(' → ').forEach((p) => seen.add(p.trim()));
  }
  return (r.kv ?? []).filter((q) => q.v !== '—' && !seen.has(q.v));
}

function DetailsPanel({ r, onClose }: { r: Row; onClose: () => void }) {
  const kv = visibleKv(r);
  const width = r.perms?.length ? 720 : r.lists?.some((l) => l.items.length) ? 600 : kv.length > 5 ? 520 : 440;
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-[rgba(31,26,28,.35)]" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100vh-64px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-surface shadow-xl outline-none" style={{ width }}>
          <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
            <div>
              <Dialog.Title className="font-mono text-[17px] font-semibold text-ink-strong">{r.cells[0]?.v}</Dialog.Title>
              {r.cells[0]?.sub && <div className="text-[12.5px] text-ink-muted">{r.cells[0].sub}</div>}
            </div>
            <button type="button" aria-label="Close details" onClick={onClose} className="flex rounded p-1 text-ink-muted hover:text-ink-strong">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-auto px-2 pb-4 pt-3">
            {kv.length > 0 && (
              <div className="px-4 pb-2 pt-1">
                {kv.map((q) => (
                  <div key={q.k} className="flex gap-3 border-b border-dashed border-line-subtle py-[5px] text-[13px]">
                    <span className="w-[150px] flex-none text-ink-muted">{q.k}</span>
                    <span className={cn('break-words text-[12.5px]', q.mono && 'font-mono')}>{q.v}</span>
                  </div>
                ))}
              </div>
            )}
            {r.perms && r.perms.length > 0 && (
              <div className="grid gap-x-4 gap-y-1.5 px-4 py-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
                {r.perms.map((p) => (
                  <div key={p.p} className={cn('flex items-center gap-2 font-mono text-[12.5px]', p.on ? 'text-ink-strong' : 'text-ink-subtle line-through')}>
                    <span className={p.on ? 'text-success' : 'text-ink-subtle'}>{p.on ? '✓' : '–'}</span>
                    {p.p}
                  </div>
                ))}
              </div>
            )}
            {r.lists?.map((l) => (
              <div key={l.title} className="px-4 pb-1 pt-2">
                <div className="mb-1 text-[13px] font-semibold text-ink-strong">{l.title}</div>
                {l.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-dashed border-line-subtle py-1 text-[12.5px]">
                    <span className="min-w-[180px] font-mono">{it.a}</span>
                    <span className="min-w-[140px] text-ink-muted">{it.b}</span>
                    <span className="flex-1 text-ink-muted">{it.c}</span>
                    {it.x && (
                      <button type="button" onClick={it.x} className="font-medium text-brand">
                        {it.xl}
                      </button>
                    )}
                  </div>
                ))}
                {!l.items.length && <div className="text-[12.5px] text-ink-muted">{l.empty ?? 'None'}</div>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line-subtle px-5 py-3">
            {r.acts?.map((a) => <ActButton key={a.l} a={a} />)}
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TableSection({ s }: { s: Section }) {
  const [open, setOpen] = React.useState<string | null>(s.openKey ?? null);
  React.useEffect(() => {
    if (s.openKey) setOpen(s.openKey);
  }, [s.openKey]);
  const rows = s.rows ?? [];
  const panel = (s.mode ?? (rows.some(hasDetails) ? 'panel' : 'inline')) === 'panel';
  const inActs = (r: Row) => (panel && hasDetails(r) ? (r.quick ?? []) : [...(r.acts ?? []), ...(r.quick ?? [])]);
  const anyActs = rows.some((r) => inActs(r).length || r.lockTip);
  const anyDet = panel && rows.some(hasDetails);
  const openRow = rows.find((r) => r.key === open);
  return (
    <div className="card overflow-auto">
      <table className="w-full min-w-[820px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
            {(s.cols ?? []).map((c, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-[9px] font-semibold">
                {c}
              </th>
            ))}
            {anyActs && <th className="w-[1%] whitespace-nowrap px-3 py-[9px] text-right font-semibold">Actions</th>}
            {anyDet && (
              <th className="w-[1%] px-3 py-[9px]">
                <span className="sr-only">Details</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const det = panel && hasDetails(r);
            const click = det ? () => setOpen(r.key) : r.onClick;
            return (
              <tr
                key={r.key}
                onClick={click}
                className={cn('border-t border-line-subtle hover:bg-surface-hover', click && 'cursor-pointer', open === r.key && 'bg-brand-tint')}
                style={open === r.key ? { boxShadow: 'inset 3px 0 0 var(--brand)' } : undefined}
              >
                {r.cells.map((c, i) => (
                  <td key={i} title={c.tip} className="px-3 py-2.5 align-top">
                    <CellView c={c} />
                  </td>
                ))}
                {anyActs && (
                  <td className="whitespace-nowrap px-3 py-1.5 text-right align-middle">
                    {inActs(r).map((a) => (
                      <LinkAct key={a.l} a={a} />
                    ))}
                    {r.lockTip && (
                      <span title={r.lockTip} className="inline-flex text-ink-subtle">
                        <Lock size={13} />
                      </span>
                    )}
                  </td>
                )}
                {anyDet && (
                  <td className="px-3 py-2.5 text-right">
                    {det && (
                      <button type="button" aria-label={`View details: ${r.cells[0]?.v}`} onClick={(e) => { e.stopPropagation(); setOpen(r.key); }} className="inline-flex items-center gap-0.5 whitespace-nowrap rounded px-0.5 py-1 text-[12.5px] text-ink-muted hover:text-brand">
                        Details
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <div className="p-7 text-center text-ink-muted">{s.empty ?? 'Nothing here yet.'}</div>}
      {openRow && <DetailsPanel r={openRow} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FormSection({ s }: { s: Section }) {
  return (
    <div className="card">
      {(s.rows ?? []).map((r, i) => (
        <div key={r.key} className={cn('grid items-center gap-4 px-4 py-3 text-[13.5px]', i > 0 && 'border-t border-line-subtle')} style={{ gridTemplateColumns: 'minmax(200px,300px) minmax(0,1fr) auto' }}>
          <div className="flex items-center gap-1.5 font-medium text-ink-strong">
            {r.cells[0]?.v}
            {r.cells[0]?.tip && (
              <span title={r.cells[0].tip} className="inline-flex cursor-help text-ink-muted">
                <Info size={15} />
              </span>
            )}
          </div>
          <div className="min-w-0">
            {r.cells[1]?.p ? <DsPill p={r.cells[1].p} /> : <div className="break-words text-ink-body">{r.cells[1]?.v}</div>}
            {r.cells[1]?.sub && <div className="mt-0.5 text-xs text-ink-muted">{r.cells[1].sub}</div>}
          </div>
          <div className="flex items-center justify-end gap-1 whitespace-nowrap text-right">
            {[...(r.acts ?? []), ...(r.quick ?? [])].map((a) => (
              <LinkAct key={a.l} a={a} />
            ))}
            {r.lockTip && (
              <span title={r.lockTip} aria-label={r.lockTip} className="inline-flex text-ink-subtle">
                <Lock size={13} />
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsStrip({ stats }: { stats: NonNullable<Section['stats']> }) {
  return (
    <div className="card grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
      {stats.map((x, i) => (
        <div key={x.k} className={cn('px-4 py-3', i > 0 && 'border-l border-line-subtle')}>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: x.c }} />
            {x.k}
          </div>
          <div className="mt-0.5 text-[22px] font-semibold text-ink-strong">{x.v}</div>
        </div>
      ))}
    </div>
  );
}

function Timeline({ spans }: { spans: NonNullable<Section['tl']> }) {
  return (
    <div className="card overflow-hidden">
      {spans.map((t, i) => (
        <div
          key={i}
          onClick={t.onClick}
          className={cn('grid items-center gap-3.5 border-t border-line-subtle px-3.5 py-[7px] text-[12.5px] first:border-t-0', t.onClick && 'cursor-pointer hover:bg-surface-hover', t.selected && 'bg-brand-tint')}
          style={{ gridTemplateColumns: '260px minmax(0,1fr) 76px' }}
        >
          <div className="min-w-0">
            <div className="ellipsis font-semibold text-ink-strong">{t.n}</div>
            {t.sub && <div className="ellipsis text-[11.5px] text-ink-muted">{t.sub}</div>}
          </div>
          <div className="relative h-3 rounded-[3px] bg-surface-sunken">
            <div className="absolute inset-y-0 rounded-[3px]" style={{ left: t.l, width: t.w, background: t.c }} />
          </div>
          <div className="text-right font-mono text-xs text-ink-body">{t.d}</div>
        </div>
      ))}
    </div>
  );
}

function SectionView({ s }: { s: Section }) {
  const hasTitle = !!(s.title || s.badge || (s.sacts && s.sacts.length));
  const isTable = !s.form && !s.dgm && !s.tl && !s.stats && !s.custom;
  return (
    <div className="flex flex-col gap-2">
      {s.group && <h2 className="mb-0.5 mt-3.5 text-lg font-semibold text-ink-strong">{s.group}</h2>}
      {hasTitle && (
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink-strong">
            {s.title}
            {s.badge && <DsPill p={[s.badgeP ?? 'draft', s.badge]} />}
            {s.tip && (
              <span title={s.tip} className="inline-flex cursor-help text-ink-muted">
                <Info size={15} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">{s.sacts?.map((a) => <ActButton key={a.l} a={a} />)}</div>
        </div>
      )}
      {s.note && <div className="-mt-0.5 text-[13px] text-ink-muted">{s.note}</div>}
      {s.custom}
      {s.dgm && <Diagram spec={s.dgm} />}
      {s.tl && <Timeline spans={s.tl} />}
      {s.stats && <StatsStrip stats={s.stats} />}
      {s.form && <FormSection s={s} />}
      {isTable && <TableSection s={s} />}
      {s.pager && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
          <span>{s.pager.l}</span>
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select aria-label="Rows per page" value={s.pager.size} onChange={(e) => s.pager!.setSize(Number(e.target.value))} className="h-[30px] rounded-sm border border-line bg-surface px-1.5 text-[13px]">
              {[10, 25, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <Button size="xs" variant="outline" disabled={s.pager.prevOff} onClick={s.pager.prev}>
              Previous
            </Button>
            <span>{s.pager.pg}</span>
            <Button size="xs" variant="outline" disabled={s.pager.nextOff} onClick={s.pager.next}>
              Next
            </Button>
          </div>
        </div>
      )}
      {s.callout && (
        <div className="flex items-start gap-2 rounded-card bg-info-bg px-3.5 py-2.5 text-[13px] text-info">
          <Info size={15} className="mt-px flex-none" />
          <span>{s.callout}</span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ screen
export function ScreenView({ model }: { model: ScreenModel }) {
  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <PageHeadView head={model.head} />
      {model.denied ? (
        <EmptyState title="You don't have access to this page" body={model.denied} />
      ) : (
        <>
          {model.filters && <FilterBar f={model.filters} />}
          {model.sections.map((s, i) => (
            <SectionView key={i} s={s} />
          ))}
        </>
      )}
    </div>
  );
}
