/**
 * Platform page context: "view as" permissions (`pEdit` = the prototype's
 * platform-administrator edit right), navigation by prototype screen key, and
 * audit recording for the platform hubs.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialogs } from '@/engine/dialogs';
import { useAccess } from '@/v35/access';
import { recordAudit } from '@/v35/data/audit';
import { PLATFORM_ROUTE, type Ev } from './build';

export function usePlatform(area: string) {
  const access = useAccess(null);
  const nav = useNavigate();
  const d = useDialogs();
  const uid = access.uid;
  const pEdit = access.canP('platform:manage');
  const canRead = access.canP('platform:read');
  return React.useMemo(
    () => ({
      uid,
      pEdit,
      canRead,
      d,
      nav,
      goP: (k: string) => nav(PLATFORM_ROUTE[k] ?? '/platform'),
      goTenant: (k: string) => nav(`/p/${k}`),
      audit: (evs: Ev[]) => evs.forEach((e) => recordAudit({ who: uid, action: e.action, res: e.res, tenants: e.tenants, lvl: e.lvl ?? 'platform', area })),
    }),
    [uid, pEdit, canRead, d, nav, area],
  );
}
