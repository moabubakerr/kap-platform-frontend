import { ScreenView } from '@/engine/ScreenView';
import { serviceAccountsScreen } from './build';
import { liveServiceAccountsScreen } from './liveBuild';
import { useIamCtx } from './useIamCtx';
import { IamLiveBanner, useLiveIam } from './useLiveIam';

/** Service accounts of the tenant (route /p/:tenant/service-accounts). Live tenants: KAP service accounts. */
export default function ServiceAccountsPage() {
  const c = useIamCtx();
  const { live, ctx } = useLiveIam(c);
  return (
    <>
      <IamLiveBanner live={live} what="service accounts" />
      <ScreenView model={ctx ? liveServiceAccountsScreen(ctx) : serviceAccountsScreen(c)} />
    </>
  );
}
