import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { SA_TABS, serviceAccountScreen } from './build';
import { LIVE_SA_TABS, liveServiceAccountScreen } from './liveBuild';
import { useIamCtx } from './useIamCtx';
import { IamLiveBanner, useLiveIam } from './useLiveIam';

/** A service account: Overview · Access · Credentials (route service-accounts/:saId/:tab?). Live tenants: a KAP service account. */
export default function ServiceAccountPage() {
  const { saId = '', tab } = useParams();
  const c = useIamCtx();
  const { live, ctx } = useLiveIam(c);
  const model = ctx ? liveServiceAccountScreen(ctx, saId, tab) : serviceAccountScreen(c, saId, tab);
  const tabs = ctx ? LIVE_SA_TABS : SA_TABS;
  useCrumbs([saId, !model.denied && (tabs.find((t) => t[0] === model.head.tab)?.[1] ?? 'Overview')]);
  return (
    <>
      <IamLiveBanner live={live} what="service accounts" />
      <ScreenView model={model} />
    </>
  );
}
