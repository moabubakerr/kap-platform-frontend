import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs } from '@/engine/dialogs';
import { ScreenView } from '@/engine/ScreenView';
import { useAccess } from '@/v35/access';
import { iamStore } from '@/v35/iam';
import { businessStore, INGEST_REF, isDataTenant, type TenantData } from '@/v35/data/businessData';
import type { ScreenModel } from '@/engine/types';
import { LiveBanner, type Live } from '@/v35/live';
import type { Hub } from './build';
import { toIngestRef } from './fromKap';
import { useBusinessLoad, useLiveHub } from './liveData';
import { dataSession } from './session';

const EMPTY: TenantData = { datasets: [], documents: [], collections: [], onto: { types: [], rels: [] }, inst: [] };

/**
 * Wires the Business Data Hub builders to the app: tenant, "view as" access,
 * the session stores (business data, IAM) and dialogs. Returns null for a
 * tenant without business data (Default). On a live tenant (sandbox) the data
 * comes from KAP (`liveData.ts`) and `hub.live` carries KAP's records and writes.
 */
export function useDataHub(): (Hub & { status: Live }) | null {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const key = scope.kind === 'project' ? scope.project.key : null;
  const t = isDataTenant(key) ? key : null;
  const access = useAccess(t);
  const all = businessStore.use();
  const iam = iamStore.use();
  const sess = dataSession.use();
  const status = useBusinessLoad(t);
  const live = useLiveHub(t, access.uid, d.toast);

  return React.useMemo(() => {
    if (!t) return null;
    const hub: Hub & { status: Live } = {
      t,
      all,
      // a live tenant shows nothing until KAP has answered (never the design's sample data)
      D: live && !live.cache.loaded ? EMPTY : all.tenants[t],
      iam,
      ing: live ? toIngestRef(live.cache) : INGEST_REF[t],
      acc: {
        uid: access.uid,
        canData: access.can('data:manage', 'collection', '*'),
        canGrant: access.can('grant:manage', 'tenant', '*'),
        canRead: (c) => access.can('collection:read', 'collection', c) || access.can('data:manage', 'collection', c),
        canAgent: (perm, a) => access.can(perm, 'agent', a),
      },
      ui: {
        go: (path) => nav(`${base}/${path}`),
        form: d.form,
        confirm: d.confirm,
        toast: d.toast,
        setD: (fn, toast) => {
          businessStore.update((draft) => fn(draft.tenants[t], draft));
          if (toast) d.toast(toast);
        },
        setIam: (fn, toast) => {
          iamStore.update(fn);
          if (toast) d.toast(toast);
        },
        later: (fn) => setTimeout(fn, 0),
      },
      effU: sess.effU[t] || access.uid,
      setEffU: (u) => dataSession.update((s) => { s.effU[t] = u; }),
      live,
      status,
    };
    return hub;
  }, [t, all, iam, sess, access, base, nav, d, live, status]);
}

/** A hub screen with the live banner above it (the banner renders nothing on other tenants). */
export function DataScreen({ model, live, what }: { model: ScreenModel; live: Live; what: string }) {
  return (
    <>
      {live.on && (
        <div className="max-w-[1440px] px-8 pt-3">
          <LiveBanner live={live} what={what} />
        </div>
      )}
      <ScreenView model={model} />
    </>
  );
}

/** Shown in a tenant without business data. */
export function NoBusinessData({ title }: { title: string }) {
  return <ScreenView model={{ head: { title }, sections: [], denied: 'This tenant has no business data. Switch to a tenant to see its collections, datasets and documents.' }} />;
}
