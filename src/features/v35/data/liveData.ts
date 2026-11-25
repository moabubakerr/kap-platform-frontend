/**
 * Business Data Hub on a live tenant (sandbox): reads KAP into a cache, maps it
 * onto the tenant's slice of `businessStore` (`fromKap.ts`) and writes to KAP.
 *
 * - `business` (useLiveLoad key): collections, entity types, pipelines,
 *   connectors, agents and per-collection counts.
 * - Heavy lists load lazily with their own keys: a page of a collection's files
 *   (`business-files:…`), a page of a dataset's observations (`business-obs:…`),
 *   the files of every document collection for Unstructured Data
 *   (`business-docs`), one file with its versions (`business-file:…`).
 *
 * Every load writes into `kapCacheStore`, then the tenant's slice is rebuilt
 * from the whole cache, so loads never overwrite each other.
 */
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createStore } from '@/engine/store';
import { kap, kapAll, kapGet, kapUrl, type KapPage } from '@/api/kap';
import { liveSave, liveTenantId, useLiveLoad, type Live } from '@/v35/live';
import { recordAudit } from '@/v35/data/audit';
import { businessStore, type DataTenant } from '@/v35/data/businessData';
import type { LiveHub } from './build';
import {
  BUSY_STATES, FAILED_STATES, MAX_DOCS, PAGE, agentCollections, collectionOfDataset, docIds, emptyCache, kindOf, obsKey, pageKey, parseDocId, toKapCollectionCreate, toKapCollectionPatch, toKapEntityTypeCreate, toKapObservationPatch, toTenantData,
  type CollectionForm, type KapAgent, type KapCache, type KapCollection, type KapConnector, type KapEntityType, type KapFile, type KapFileVersion, type KapObservation, type KapPipeline,
} from './fromKap';
import { dataSession, type LivePage } from './session';

/** What has been read from KAP, per live tenant. */
export const kapCacheStore = createStore<Record<string, KapCache>>(() => ({}));

const cacheOf = (t: DataTenant): KapCache => kapCacheStore.get()[t] ?? emptyCache();

/** Rebuild the tenant's Business Data slice from the cache (keeps session-only parts). */
function publish(t: DataTenant) {
  const c = cacheOf(t);
  if (!c.loaded) return;
  businessStore.update((d) => {
    d.tenants[t] = toTenantData(c, d.tenants[t]);
  });
}

function setCache(t: DataTenant, fn: (c: KapCache) => void) {
  kapCacheStore.update((s) => {
    const c = s[t] ?? emptyCache();
    fn(c);
    s[t] = c;
  });
  publish(t);
}

const optional = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
const total = async (tid: string, path: string, q: Record<string, string | number | string[]> = {}): Promise<number | null> =>
  optional(kapGet<KapPage<unknown>>(tid, path, { ...q, limit: 1 }).then((p) => p.total));

// ------------------------------------------------------------------ loads
async function loadBusiness(t: DataTenant, tid: string) {
  const [collections, entityTypes] = await Promise.all([kapAll<KapCollection>(tid, 'collections'), kapAll<KapEntityType>(tid, 'entity-types')]);
  // lists the hub can do without (permission): kinds then fall back to pipeline names, agents to none
  const [pipelines, connectors, agents] = await Promise.all([optional(kapAll<KapPipeline>(tid, 'pipelines')), optional(kapAll<KapConnector>(tid, 'connectors')), optional(kapAll<KapAgent>(tid, 'agents'))]);
  const fileTotal: KapCache['fileTotal'] = {};
  const fileStates: KapCache['fileStates'] = {};
  const obsTotal: KapCache['obsTotal'] = {};
  await Promise.all(
    collections.map(async (c) => {
      if (kindOf(c, pipelines) === 'indicators') {
        const base = `collections/${c.id}/indicator-observations`;
        const [all, review] = await Promise.all([total(tid, base), total(tid, base, { status: 'needs_review' })]);
        if (all != null) obsTotal[c.id] = { total: all, review: review ?? 0 };
      } else {
        const base = `collections/${c.id}/files`;
        // documents are done at `embedded`, so it is not "busy" here
        const busyStates = BUSY_STATES.filter((s) => s !== 'embedded');
        const [all, failed, busy] = await Promise.all([total(tid, base), total(tid, base, { state__in: FAILED_STATES }), total(tid, base, { state__in: busyStates })]);
        if (all != null) fileTotal[c.id] = all;
        if (failed != null && busy != null) fileStates[c.id] = { failed, busy };
      }
    }),
  );
  setCache(t, (x) => {
    const ids = new Set(collections.map((c) => c.id));
    Object.assign(x, { loaded: true, collections, entityTypes, pipelines, connectors, agents, fileTotal, fileStates, obsTotal });
    for (const [id, f] of Object.entries(x.files)) if (!ids.has(f.collection_id)) delete x.files[id];
  });
}

async function ensureBusiness(t: DataTenant, tid: string) {
  if (!cacheOf(t).loaded) await loadBusiness(t, tid);
}
const collectionNamed = (t: DataTenant, name: string) => cacheOf(t).collections.find((c) => c.name === name) ?? null;

async function loadFilePage(t: DataTenant, tid: string, name: string, offset: number, size: number) {
  await ensureBusiness(t, tid);
  const c = collectionNamed(t, name);
  if (!c) return;
  const p = await kapGet<KapPage<KapFile>>(tid, `collections/${c.id}/files`, { limit: size, offset, sort: 'name' });
  setCache(t, (x) => {
    for (const f of p.items) x.files[f.id] = { ...x.files[f.id], ...f };
    x.filePages[c.id] = { ...(x.filePages[c.id] ?? {}), [pageKey(offset, size)]: p.items.map((f) => f.id) };
    x.fileTotal[c.id] = p.total;
  });
}

/** Files of every document collection (Unstructured Data), newest first, up to `MAX_DOCS` each. */
async function loadAllDocs(t: DataTenant, tid: string) {
  await ensureBusiness(t, tid);
  const cache = cacheOf(t);
  const colls = cache.collections.filter((c) => kindOf(c, cache.pipelines) === 'document');
  const lists = await Promise.all(colls.map(async (c) => [c, await kapAll<KapFile>(tid, `collections/${c.id}/files`, { sort: '-content_changed_at' }, MAX_DOCS)] as const));
  setCache(t, (x) => {
    x.truncated = [];
    for (const [c, files] of lists) {
      for (const [id, f] of Object.entries(x.files)) if (f.collection_id === c.id) delete x.files[id];
      for (const f of files) x.files[f.id] = f;
      if (files.length >= MAX_DOCS) x.truncated.push(c.name);
      else x.fileTotal[c.id] = files.length;
    }
  });
}

async function loadObservations(t: DataTenant, tid: string, dataset: string, offset: number, size: number, status: string) {
  await ensureBusiness(t, tid);
  const c = collectionOfDataset(cacheOf(t), dataset);
  if (!c) return;
  const p = await kapGet<KapPage<KapObservation>>(tid, `collections/${c.id}/indicator-observations`, { limit: size, offset, status: status || undefined });
  setCache(t, (x) => {
    x.obs[c.id] = { ...(x.obs[c.id] ?? {}), [obsKey(status, offset, size)]: { items: p.items, total: p.total } };
  });
}

/** One document (deep link): resolve the file by name, then its detail and versions. */
async function loadFile(t: DataTenant, tid: string, docId: string) {
  await ensureBusiness(t, tid);
  const ref = parseDocId(docId);
  const c = ref ? collectionNamed(t, ref.collection) : null;
  if (!ref || !c) return;
  let f = docIds(cacheOf(t)).get(docId);
  if (!f) {
    const p = await kapGet<KapPage<KapFile>>(tid, `collections/${c.id}/files`, { name__contains: ref.name, limit: 100 });
    f = p.items.find((x) => x.name === ref.name);
  }
  if (!f) return;
  const [detail, versions] = await Promise.all([kapGet<KapFile>(tid, `collections/${c.id}/files/${f.id}`), kapAll<KapFileVersion>(tid, `collections/${c.id}/files/${f.id}/versions`, { sort: '-version_number' }, 200).catch(() => null)]);
  setCache(t, (x) => {
    x.files[detail.id] = detail;
    if (versions) x.versions[detail.id] = versions;
  });
}

// ------------------------------------------------------------------ hooks (pages)
const liveT = (t: DataTenant | null | undefined) => (t && liveTenantId(t) ? t : null);

/** The hub's main load (collections and everything listed with them). */
export function useBusinessLoad(t: DataTenant | null | undefined): Live {
  const lt = liveT(t);
  return useLiveLoad('business', lt, (tid) => loadBusiness(lt!, tid));
}

/** A page of a collection's files (Data Scope, dataset provenance). */
export function useLiveFiles(t: DataTenant | null | undefined, collection: string | null, page: LivePage): Live {
  const lt = collection ? liveT(t) : null;
  return useLiveLoad(`business-files:${collection}:${pageKey(page.offset, page.size)}`, lt, (tid) => loadFilePage(lt!, tid, collection!, page.offset, page.size));
}

/** Files of every document collection (Unstructured Data). */
export function useLiveDocs(t: DataTenant | null | undefined): Live {
  const lt = liveT(t);
  return useLiveLoad('business-docs', lt, (tid) => loadAllDocs(lt!, tid));
}

/** A page of a dataset's observations. */
export function useLiveObservations(t: DataTenant | null | undefined, dataset: string | null, page: LivePage & { status: string }): Live {
  const lt = dataset ? liveT(t) : null;
  return useLiveLoad(`business-obs:${dataset}:${obsKey(page.status, page.offset, page.size)}`, lt, (tid) => loadObservations(lt!, tid, dataset!, page.offset, page.size, page.status));
}

/** One document with its versions. */
export function useLiveFile(t: DataTenant | null | undefined, docId: string): Live {
  const lt = liveT(t);
  return useLiveLoad(`business-file:${docId}`, lt, (tid) => loadFile(lt!, tid, docId));
}

/** Several loads shown as one banner: loading while any loads, the first error. */
export function combineLive(...ls: Live[]): Live {
  const on = ls.filter((l) => l.on);
  if (!on.length) return ls[0];
  return {
    ...on[0],
    loading: on.some((l) => l.loading),
    error: on.find((l) => l.error)?.error ?? null,
    reload: async () => {
      await Promise.all(on.map((l) => l.reload()));
    },
  };
}

// ------------------------------------------------------------------ writes
/**
 * KAP data, paging and writes for the hub's builders on a live tenant; null
 * for other tenants. `uid` is the acting ("view as") account for the audit trail.
 */
export function useLiveHub(t: DataTenant | null, uid: string, toast: (m: string) => void): LiveHub | null {
  const lt = liveT(t);
  const tid = lt ? liveTenantId(lt) : null;
  const qc = useQueryClient();
  const caches = kapCacheStore.use();
  const sess = dataSession.use();
  const cache = lt ? (caches[lt] ?? emptyCache()) : null;

  return React.useMemo(() => {
    if (!lt || !tid || !cache) return null;
    const T = lt;
    const reload = async () => {
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'live' && typeof q.queryKey[1] === 'string' && q.queryKey[1].startsWith('business') });
    };
    const audit = (action: string, res: string) => recordAudit({ who: uid, action, res, tenants: [T], lvl: 'tenant', area: 'Business Data Hub' });
    /** KAP write → audit → toast → reload; '' or KAP's message */
    const save = (write: () => Promise<unknown>, action: string, res: string, msg: string, after?: () => void) =>
      liveSave({ reload }, write, () => {
        after?.();
        audit(action, res);
        toast(msg);
      });
    const coll = (name: string) => cacheOf(T).collections.find((c) => c.name === name) ?? null;
    const fileOf = (docId: string) => docIds(cacheOf(T)).get(docId) ?? null;
    const typeOf = (name: string) => cacheOf(T).entityTypes.find((e) => e.name === name) ?? null;
    const missing = (what: string) => Promise.resolve(`${what} is no longer in KAP. Refresh and try again.`);

    const hub: LiveHub = {
      cache,
      agColl: agentCollections(cache.agents),
      filesAt: (c) => sess.liveFiles[c] ?? { offset: 0, size: PAGE },
      setFilesAt: (c, v) => dataSession.update((s) => { s.liveFiles[c] = v; }),
      obsAt: (ds) => sess.liveObs[ds] ?? { offset: 0, size: PAGE, status: '' },
      setObsAt: (ds, v) => dataSession.update((s) => { s.liveObs[ds] = v; }),

      createCollection: (v: CollectionForm) => {
        const body = toKapCollectionCreate(v);
        return save(() => kap(tid, 'POST', 'collections', body), 'Created collection', `${body.name} · pipeline ${body.pipeline_ref}`, `${body.name} created in KAP. Its connectors' files are ingested on the next synchronization.`);
      },
      updateCollection: (name, v) => {
        const c = coll(name);
        if (!c) return missing(name);
        const body = toKapCollectionPatch(c, v);
        if (!body) return Promise.resolve('No change.');
        return save(() => kap(tid, 'PATCH', `collections/${c.id}`, body), 'Updated collection', `${name} · ${Object.keys(body).join(', ')}`, `${name} saved in KAP.`);
      },
      deleteCollection: (name) => {
        const c = coll(name);
        if (!c) return missing(name);
        return save(() => kap(tid, 'DELETE', `collections/${c.id}`), 'Deleted collection', name, `${name} deleted in KAP.`);
      },
      reprocessFile: (docId) => {
        const f = fileOf(docId);
        if (!f) return missing(docId);
        return save(() => kap(tid, 'POST', `collections/${f.collection_id}/files/${f.id}/reprocess`), 'Reprocessed file', docId, `${f.name} queued for processing again.`);
      },
      deleteFile: (docId) => {
        const f = fileOf(docId);
        if (!f) return missing(docId);
        return save(() => kap(tid, 'DELETE', `collections/${f.collection_id}/files/${f.id}`), 'Deleted file', docId, `${f.name} removed from the collection.`, () =>
          setCache(T, (x) => {
            delete x.files[f.id];
            delete x.versions[f.id];
          }),
        );
      },
      download: (docId) => {
        const f = fileOf(docId);
        if (!f) return;
        const a = document.createElement('a');
        a.href = kapUrl(tid, `collections/${f.collection_id}/files/${f.id}/content`);
        a.download = f.name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
      correctObservation: (dataset, obsId, v) => {
        const c = collectionOfDataset(cacheOf(T), dataset);
        const o = c ? Object.values(cacheOf(T).obs[c.id] ?? {}).flatMap((p) => p.items).find((x) => x.id === obsId) : undefined;
        if (!c || !o) return missing('The observation');
        const body = toKapObservationPatch(o, v);
        if (!body) return Promise.resolve('No change.');
        const what = `${o.indicator.external_id} · ${o.period_start}${o.dimension ? ` · ${o.dimension}` : ''}`;
        // KAP stores no reason: it is kept in the console's audit trail
        return save(() => kap(tid, 'PATCH', `collections/${c.id}/indicator-observations/${o.id}`, body), 'Corrected observation', `${what}${v.reason ? ` · reason: ${v.reason}` : ''}`, `${o.indicator.external_id} corrected in KAP.`);
      },
      createEntityType: (v) => {
        const body = toKapEntityTypeCreate(v);
        return save(() => kap(tid, 'POST', 'entity-types', body), 'Created entity type', body.name, `${body.name} created in KAP.`);
      },
      updateEntityType: (name, body, what) => {
        const e = typeOf(name);
        if (!e) return missing(name);
        return save(() => kap(tid, 'PATCH', `entity-types/${e.id}`, body), 'Updated entity type', `${name} · ${what}`, `${name} saved in KAP.`);
      },
      deleteEntityType: (name) => {
        const e = typeOf(name);
        if (!e) return missing(name);
        return save(() => kap(tid, 'DELETE', `entity-types/${e.id}`), 'Deleted entity type', name, `${name} deleted in KAP.`);
      },
    };
    return hub;
  }, [lt, tid, cache, sess, qc, uid, toast]);
}
