import * as React from 'react';
import { ScreenView } from '@/engine/ScreenView';
import { auditScreen, type AuditFilters } from './build';
import { useAdmin } from './useAdmin';

/** Platform Unified Audit Log (route /platform/audit): platform-level and all-tenant events, seed and live. */
export default function PlatformAuditPage() {
  const c = useAdmin();
  const [F, setF] = React.useState<AuditFilters>({});
  return <ScreenView model={auditScreen(c, false, F, setF)} />;
}
