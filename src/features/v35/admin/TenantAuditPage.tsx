import * as React from 'react';
import { ScreenView } from '@/engine/ScreenView';
import { auditScreen, type AuditFilters } from './build';
import { useAdmin } from './useAdmin';

/** Tenant Unified Audit Log (route /p/:tenant/audit): this tenant's events, seed and live. */
export default function TenantAuditPage() {
  const c = useAdmin();
  const [F, setF] = React.useState<AuditFilters>({});
  return <ScreenView model={auditScreen(c, true, F, setF)} />;
}
