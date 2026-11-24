import { ScreenView } from '@/engine/ScreenView';
import { tenantSecurityScreen } from './build';
import { useAdmin } from './useAdmin';

/** Tenant Security & Credentials (route /p/:tenant/security): credential references and tenant encryption key. */
export default function TenantSecurityPage() {
  return <ScreenView model={tenantSecurityScreen(useAdmin())} />;
}
