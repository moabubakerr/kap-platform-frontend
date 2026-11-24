import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { GROUP_TABS, groupScreen } from './build';
import { LIVE_GROUP_TABS, liveGroupScreen } from './liveBuild';
import { useIamCtx } from './useIamCtx';
import { IamLiveBanner, useLiveIam } from './useLiveIam';

/** A group: Members · Access (route groups/:groupId/:tab?). Live tenants: a KAP group. */
export default function GroupPage() {
  const { groupId = '', tab } = useParams();
  const c = useIamCtx();
  const { live, ctx } = useLiveIam(c);
  const model = ctx ? liveGroupScreen(ctx, groupId, tab) : groupScreen(c, groupId, tab);
  const tabs = ctx ? LIVE_GROUP_TABS : GROUP_TABS;
  useCrumbs([groupId, !model.denied && (tabs.find((t) => t[0] === model.head.tab)?.[1] ?? 'Members')]);
  return (
    <>
      <IamLiveBanner live={live} what="groups" />
      <ScreenView model={model} />
    </>
  );
}
