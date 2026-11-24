/**
 * Live tenant (sandbox) wiring of the tenant administration screens: the KAP
 * audit log (paged, filtered by KAP) and KAP configuration versions (preview
 * and roll back). Other tenants get `K: undefined` and keep the session data.
 */
import * as React from 'react';
import { createStore } from '@/engine/store';
import { kap, kapAll, kapError, kapGet, type KapPage } from '@/api/kap';
import { LiveBanner, liveSave, useLiveLoad, type Live } from '@/v35/live';
import type { AdminCtx, AuditFilters, KapAuditView, KapConfigView } from './build';
import {
  auditQuery, planBody, planItems, rollbackBody, rollbackMsg,
  type KapAuditDetails, type KapAuditFilters, type KapAuditSummary, type KapConfigPlan, type KapConfigVersion, type KapRollbackOut,
} from './fromKap';

// ---------------------------------------------------------------- audit log

interface KapAuditState {
  events: KapAuditSummary[];
  total: number;
  /** query signature the events were loaded for */
  sig: string;
  details: Record<string, KapAuditDetails | { err: string }>;
}
export const kapAuditStore = createStore<KapAuditState>(() => ({ events: [], total: 0, sig: '', details: {} }));

export function useKapAudit(tenantKey: string | null, F: AuditFilters): { live: Live; K?: KapAuditView } {
  const [page, setPage] = React.useState({ offset: 0, limit: 50 });
  const [openId, setOpenId] = React.useState<string | null>(null);
  const kf: KapAuditFilters = { area: F.area, time: F.time, res: F.res, subj: F.subj };
  const fkey = JSON.stringify(kf);
  // a new KAP filter starts again at the first page
  const prevF = React.useRef(fkey);
  if (prevF.current !== fkey) {
    prevF.current = fkey;
    if (page.offset) setPage({ ...page, offset: 0 });
  }
  const sig = `${fkey}|${page.offset}|${page.limit}`;
  const live = useLiveLoad('kap-audit', tenantKey, async (tid) => {
    const r = await kapGet<KapPage<KapAuditSummary>>(tid, 'audit/events', auditQuery(kf, page, Date.now()));
    kapAuditStore.update((d) => {
      d.events = r.items;
      d.total = r.total;
      d.sig = sig;
    });
  });
  const S = kapAuditStore.use();
  // reload when the KAP query differs from the loaded one (not while a load is running)
  const { on, loading, reload } = live;
  React.useEffect(() => {
    if (on && !loading && kapAuditStore.get().sig !== sig) void reload();
  }, [on, loading, reload, sig]);

  const tid = live.tenantId;
  const open = React.useCallback(
    (id: string) => {
      setOpenId(id);
      if (!tid || kapAuditStore.get().details[id]) return;
      kapGet<KapAuditDetails>(tid, `audit/events/${id}`).then(
        (d) => kapAuditStore.update((s) => void (s.details[id] = d)),
        (e) => kapAuditStore.update((s) => void (s.details[id] = { err: kapError(e) })),
      );
    },
    [tid],
  );
  if (!live.on) return { live };
  return {
    live,
    K: {
      events: S.events,
      total: S.total,
      offset: page.offset,
      limit: page.limit,
      setPage: (offset, limit) => setPage({ offset, limit }),
      openId,
      open,
      details: S.details,
      now: live.at ?? Date.now(),
    },
  };
}

// ---------------------------------------------------------------- configuration versions

export const kapConfigStore = createStore<{ versions: KapConfigVersion[] }>(() => ({ versions: [] }));

export function useKapConfig(c: AdminCtx, tenantKey: string | null): { live: Live; K?: KapConfigView } {
  const live = useLiveLoad('kap-config', tenantKey, async (tid) => {
    const versions = await kapAll<KapConfigVersion>(tid, 'config-versions', undefined, 1000);
    kapConfigStore.set({ versions });
  });
  const S = kapConfigStore.use();
  if (!live.on || !live.tenantId) return { live };
  const tid = live.tenantId;
  const plan = (v: KapConfigVersion) => kapGet<KapConfigPlan>(tid, `config-versions/${v.id}/preview`);
  const failed = (v: KapConfigVersion, e: unknown) => c.ui.info(`Could not prepare the rollback to v${v.version}`, kapError(e));
  return {
    live,
    K: {
      versions: S.versions,
      preview: (v) => {
        plan(v).then(
          (p) => c.ui.info(`Rollback plan · v${v.version}`, planBody(p), planItems(p)),
          (e) => failed(v, e),
        );
      },
      rollback: (v) => {
        plan(v).then(
          (p) => {
            if (!p.changed) return c.ui.info(`Roll back to v${v.version}?`, planBody(p), []);
            c.ui.confirm(
              `Roll back to v${v.version}?`,
              `${planBody(p)} KAP applies the whole version at once and records it in its audit log. If someone changes the configuration first, KAP refuses; preview again.`,
              planItems(p),
              'Roll back',
              async () => {
                let out: KapRollbackOut | undefined;
                const err = await liveSave(live, async () => {
                  out = await kap<KapRollbackOut>(tid, 'POST', `config-versions/${v.id}/rollback`, rollbackBody(p));
                });
                if (err) return err;
                if (out) {
                  c.ui.toast(rollbackMsg(out));
                  c.audit({ who: c.actor, action: 'Rolled back tenant configuration', res: `v${v.version} → v${out.changed ? out.resulting_version.version : out.previous_version} (KAP)`, tenants: c.T ? [c.T] : [], lvl: 'tenant', area: 'Tenant Configuration' });
                }
              },
            );
          },
          (e) => failed(v, e),
        );
      },
    },
  };
}

/** Live banner (when `what` is given) and an optional note, in the page gutter of ScreenView pages; nothing for other tenants. */
export function LiveStrip({ live, what, note }: { live: Live; what?: string; note?: string }) {
  if (!live.on) return null;
  return (
    <div className="max-w-[1440px] px-8 pt-3">
      {what && <LiveBanner live={live} what={what} />}
      {note && <div className="mb-1 rounded-sm bg-surface-sunken px-3 py-2 text-[13px] text-ink-muted">{note}</div>}
    </div>
  );
}
