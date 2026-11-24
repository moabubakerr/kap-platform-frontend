/**
 * Wires the administration builders to the session store, the dialogs, the
 * router, the shared audit trail and the "view as" permissions.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs } from '@/engine/dialogs';
import { useAccess } from '@/v35/access';
import { iamStore, type TenantKey } from '@/v35/iam';
import { adminStore, isAdminTenant } from '@/v35/data/admin';
import { auditStore, recordAudit } from '@/v35/data/audit';
import type { AdminCtx } from './build';

export function useAdmin(): AdminCtx & { base: string } {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const key = scope.kind === 'project' ? scope.project.key : null;
  const acc = useAccess(key as TenantKey | null);
  const D = adminStore.use();
  const events = auditStore.use();
  const iam = iamStore.use();
  const T = isAdminTenant(key) ? key : null;
  const canT = T ? acc.can('tenant:configure', 'tenant', '*') : false;
  const adminCount = iam.padmins.filter((a) => a.st !== 'Disabled').length + iam.users.length;

  return React.useMemo(
    () => ({
      base,
      actor: acc.uid,
      D,
      get: adminStore.get,
      set: adminStore.update,
      ui: d,
      audit: recordAudit,
      canP: acc.canP,
      canT,
      T,
      go: (p: string) => nav(p.startsWith('/') ? p : `${base}/${p}`),
      openUrl: (url: string) => {
        try {
          window.open(url, '_blank', 'noopener');
        } catch {
          /* blocked */
        }
      },
      later: (fn: () => void, ms: number) => void window.setTimeout(fn, ms),
      adminCount,
      events,
    }),
    [base, acc, D, d, canT, T, nav, adminCount, events],
  );
}
