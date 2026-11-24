import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs } from '@/engine/dialogs';
import { ScreenView } from '@/engine/ScreenView';
import { useAccess } from '@/v35/access';
import { iamStore } from '@/v35/iam';
import { businessStore, INGEST_REF, isDataTenant } from '@/v35/data/businessData';
import type { Hub } from './build';
import { dataSession } from './session';

/**
 * Wires the Business Data Hub builders to the app: tenant, "view as" access,
 * the session stores (business data, IAM) and dialogs. Returns null for a
 * tenant without business data (Default).
 */
export function useDataHub(): Hub | null {
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

  return React.useMemo(() => {
    if (!t) return null;
    const hub: Hub = {
      t,
      all,
      D: all.tenants[t],
      iam,
      ing: INGEST_REF[t],
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
    };
    return hub;
  }, [t, all, iam, sess, access, base, nav, d]);
}

/** Shown in a tenant without business data. */
export function NoBusinessData({ title }: { title: string }) {
  return <ScreenView model={{ head: { title }, sections: [], denied: 'This tenant has no business data. Switch to a tenant to see its collections, datasets and documents.' }} />;
}
