import { ScreenView } from '@/engine/ScreenView';
import { usersScreen } from './build';
import { liveUsersScreen } from './liveBuild';
import { useIamCtx } from './useIamCtx';
import { IamLiveBanner, useLiveIam } from './useLiveIam';

/** Users of the tenant (route /p/:tenant/users). Live tenants: KAP users. */
export default function UsersPage() {
  const c = useIamCtx();
  const { live, ctx } = useLiveIam(c);
  return (
    <>
      <IamLiveBanner live={live} what="users" />
      <ScreenView model={ctx ? liveUsersScreen(ctx) : usersScreen(c)} />
    </>
  );
}
