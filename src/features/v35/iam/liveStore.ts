/**
 * Live identity & access data of the sandbox tenant, read from KAP. Kept apart
 * from `iamStore` on purpose: `iamStore` also drives the console's simulated
 * "view as" access checks, and its sandbox entries must stay so those accounts
 * keep their access. The sandbox screens of this hub read this store instead.
 */
import { createStore } from '@/engine/store';
import { kapAll, kapError, kapGet } from '@/api/kap';
import { emptyLive, toLive, type KapGroup, type KapOauthClient, type KapPermission, type KapRole, type KapUserDetails, type KapUserSummary, type LiveIam, type LiveRes } from './fromKap';

/** Live data per tenant key (only live tenants have an entry). */
export const liveIamStore = createStore<Record<string, LiveIam>>(() => ({}));

export const liveOf = (all: Record<string, LiveIam>, T: string): LiveIam => all[T] ?? emptyLive();

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Map with at most `n` calls in flight and a pause between batches (KAP: 20 reads/s per user). */
async function paced<T, R>(items: T[], fn: (x: T) => Promise<R>, n = 5, gapMs = 300): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    if (i) await pause(gapMs);
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  }
  return out;
}

const RES_TYPES: [string, string][] = [['agent', 'agents'], ['collection', 'collections'], ['pipeline', 'pipelines'], ['connector', 'connectors']];

/** Read users (with their groups and roles), groups, roles, permissions, named resources and OAuth clients. */
export async function loadLiveIam(T: string, tenantId: string): Promise<void> {
  const [users, groups, roles, perms] = await Promise.all([
    kapAll<KapUserSummary>(tenantId, 'users'),
    kapAll<KapGroup>(tenantId, 'groups'),
    kapAll<KapRole>(tenantId, 'roles'),
    kapAll<KapPermission>(tenantId, 'permissions'),
  ]);
  // memberships and effective roles are only in each user's details
  const det = await paced(users, (u) => kapGet<KapUserDetails>(tenantId, `users/${u.id}`).catch(() => null));
  const details = Object.fromEntries(users.map((u, i) => [u.id, det[i]]));
  // named resources for resource-scoped grants; a hub the account may not read is simply left out
  const res: LiveRes[] = (
    await Promise.all(RES_TYPES.map(([rt, path]) => kapAll<{ id: string; name?: string }>(tenantId, path).then((xs) => xs.map((x) => ({ rt, id: x.id, n: x.name || x.id }))).catch(() => [] as LiveRes[])))
  ).flat();
  // OAuth clients exist only when KAP's SSO/M2M setting is on and the platform forwards them
  let creds: KapOauthClient[] | null = null;
  let credsWhy = '';
  try {
    creds = await kapAll<KapOauthClient>(tenantId, 'oauth-clients');
  } catch (e) {
    credsWhy = kapError(e);
  }
  const me = await kapGet<{ id: string }>(tenantId, 'users/me').then((x) => x.id, () => '');
  liveIamStore.update((d) => {
    d[T] = toLive({ users, details, groups, roles, perms, res, creds, credsWhy, me }, d[T]?.grants ?? []);
  });
}
