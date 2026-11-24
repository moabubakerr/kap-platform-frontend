/**
 * Live hubs: for a tenant marked `live` (sandbox), a hub's session store is
 * filled from KAP instead of the design's sample data, and its actions write to
 * KAP. The builders and pages stay the same; only the data source changes.
 *
 *   const live = useLiveLoad('agents', tenantKey, async (tenantId) => {
 *     const agents = await kapAll<KapAgent>(tenantId, 'agents');
 *     agentFactoryStore.update((d) => { d.sandbox.agents = agents.map(toAgent); });
 *   });
 *   // in an action:  if (live.on) return liveSave(live, () => kap(id, 'PATCH', `agents/${a}`, body));
 *   <LiveBanner live={live} what="agents" />
 *
 * Other tenants keep the design's sample data.
 */
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PROJECTS } from '@/mocks/projects';
import { kapError } from '@/api/kap';
import type { TenantKey } from './iam';

/** KAP tenant id when this tenant's hubs are live, else null. */
export function liveTenantId(tenantKey: TenantKey | string | null | undefined): string | null {
  const p = PROJECTS.find((x) => x.key === tenantKey);
  return p?.live ? p.tenantId : null;
}

export interface Live {
  /** this tenant is live */
  on: boolean;
  tenantId: string | null;
  loading: boolean;
  /** first-load or refresh error */
  error: string | null;
  /** refetch from KAP (after a write) */
  reload: () => Promise<void>;
  /** when the store was last filled */
  at: number | null;
}

/**
 * Fill a store from KAP for a live tenant. `load` writes into the store; it runs
 * on first use, on `reload()` and every `refreshMs` (default: no polling).
 * `key` names the dataset; hubs sharing a key share one load.
 */
export function useLiveLoad(key: string, tenantKey: TenantKey | string | null | undefined, load: (tenantId: string) => Promise<void>, refreshMs?: number): Live {
  const tenantId = liveTenantId(tenantKey);
  const qc = useQueryClient();
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const q = useQuery({
    queryKey: ['live', key, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      await loadRef.current(tenantId!);
      return Date.now();
    },
    staleTime: 30_000,
    refetchInterval: refreshMs,
    retry: 1,
  });
  const reload = React.useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['live', key, tenantId] });
  }, [qc, key, tenantId]);
  return { on: !!tenantId, tenantId, loading: !!tenantId && q.isLoading, error: q.error ? kapError(q.error) : null, reload, at: q.data ?? null };
}

/** Run a KAP write for a dialog: '' on success (after reloading), else KAP's message. */
export async function liveSave(live: Pick<Live, 'reload'>, write: () => Promise<unknown>, after?: () => void): Promise<string> {
  try {
    await write();
  } catch (e) {
    return kapError(e);
  }
  after?.();
  await live.reload();
  return '';
}

/** Strip above a live hub: where the data comes from, loading and errors. */
export function LiveBanner({ live, what }: { live: Live; what: string }) {
  if (!live.on) return null;
  const tone = live.error ? 'bg-danger-bg text-danger-fg' : 'bg-info-bg text-info';
  return (
    <div className={`mb-3 flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] ${tone}`}>
      <span className="flex-1">
        {live.error
          ? `Could not load ${what} from KAP: ${live.error}`
          : live.loading
            ? `Loading ${what} from KAP…`
            : `Live: ${what} come from KAP on the test stand. Changes here are made in KAP.`}
      </span>
      <button type="button" className="font-medium underline" onClick={() => void live.reload()}>
        Refresh
      </button>
    </div>
  );
}
