import { ScreenView } from '@/engine/ScreenView';
import { groupsScreen } from './build';
import { liveGroupsScreen } from './liveBuild';
import { useIamCtx } from './useIamCtx';
import { IamLiveBanner, useLiveIam } from './useLiveIam';

/** Groups of the tenant (route /p/:tenant/groups). Live tenants: KAP groups. */
export default function GroupsPage() {
  const c = useIamCtx();
  const { live, ctx } = useLiveIam(c);
  return (
    <>
      <IamLiveBanner live={live} what="groups" />
      <ScreenView model={ctx ? liveGroupsScreen(ctx) : groupsScreen(c)} />
    </>
  );
}
