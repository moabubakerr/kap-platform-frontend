import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { USER_TABS, userScreen } from './build';
import { LIVE_USER_TABS, liveUserScreen } from './liveBuild';
import { useIamCtx } from './useIamCtx';
import { IamLiveBanner, useLiveIam } from './useLiveIam';

/** A user: Overview · Groups · Effective Access · Security (route users/:userId/:tab?). Live tenants: a KAP user. */
export default function UserPage() {
  const { userId = '', tab } = useParams();
  const c = useIamCtx();
  const { live, ctx } = useLiveIam(c);
  const model = ctx ? liveUserScreen(ctx, userId, tab) : userScreen(c, userId, tab);
  const tabs = ctx ? LIVE_USER_TABS : USER_TABS;
  useCrumbs([userId, !model.denied && (tabs.find((t) => t[0] === model.head.tab)?.[1] ?? 'Overview')]);
  return (
    <>
      <IamLiveBanner live={live} what="users" />
      <ScreenView model={model} />
    </>
  );
}
