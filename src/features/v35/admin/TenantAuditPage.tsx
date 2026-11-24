import * as React from 'react';
import { ScreenView } from '@/engine/ScreenView';
import { auditScreen, type AuditFilters } from './build';
import { useAdmin } from './useAdmin';
import { LiveStrip, useKapAudit } from './useKapAdmin';

/**
 * Tenant Unified Audit Log (route /p/:tenant/audit): this tenant's events.
 * For the live tenant, KAP's audit log (paged, filtered by KAP) merged with the
 * console's session events; other tenants show the seed and session events.
 */
export default function TenantAuditPage() {
  const c = useAdmin();
  const [F, setF] = React.useState<AuditFilters>({});
  const { live, K } = useKapAudit(c.T, F);
  return (
    <>
      <LiveStrip live={live} what="audit events" note="Events marked KAP are read from KAP's audit log; events marked Console session were recorded by this browser session (e.g. session-only settings) and are not in KAP." />
      <ScreenView model={auditScreen(c, true, F, setF, K)} />
    </>
  );
}
