import { ScreenView } from '@/engine/ScreenView';
import { serviceAccountsScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** Service accounts of the tenant (route /p/:tenant/service-accounts). */
export default function ServiceAccountsPage() {
  return <ScreenView model={serviceAccountsScreen(useIamCtx())} />;
}
