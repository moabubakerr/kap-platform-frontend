import { kap } from '@/api/kap';
import { useDialogs } from '@/engine/dialogs';
import { LiveBanner, liveSave, useLiveLoad, type Live } from '@/v35/live';
import { recordAudit } from '@/v35/data/audit';
import type { IamCtx } from './build';
import type { LiveCtx } from './liveBuild';
import { liveIamStore, liveOf, loadLiveIam } from './liveStore';

/**
 * Live data for this hub when the tenant is live (sandbox): loads users,
 * groups, roles and permissions from KAP into `liveIamStore` and gives the
 * live builders their context. `ctx` is null for other tenants.
 */
export function useLiveIam(c: IamCtx): { live: Live; ctx: LiveCtx | null } {
  const T = c.T;
  const live = useLiveLoad('iam', T, (tenantId) => loadLiveIam(T, tenantId), 120_000); // one call per user: refresh slowly
  const all = liveIamStore.use();
  const d = useDialogs();
  if (!live.on || !live.tenantId) return { live, ctx: null };
  const tenantId = live.tenantId;
  return {
    live,
    ctx: {
      T,
      actor: c.actor,
      L: liveOf(all, T),
      loading: live.loading,
      canUser: c.canUser,
      canGrantM: c.canGrantM,
      canCfg: c.canCfg,
      ui: d,
      go: c.go,
      call: (method, path, body) => kap(tenantId, method, path, body),
      write: (w) => liveSave(live, w),
      audit: (action, res) => recordAudit({ who: c.actor, action, res, tenants: [T], lvl: 'tenant', area: 'User & Permission Management' }),
      remember: (fn) => liveIamStore.update((s) => { if (s[T]) fn(s[T]); }),
      session: c,
    },
  };
}

/** Banner above a live page of this hub. */
export function IamLiveBanner({ live, what }: { live: Live; what: string }) {
  if (!live.on) return null;
  return (
    <div className="max-w-[1440px] px-8 pt-3">
      <LiveBanner live={live} what={what} />
    </div>
  );
}
