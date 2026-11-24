import { useSearchParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { ROLE_TABS, rolesScreen } from './build';
import { liveRolesScreen } from './liveBuild';
import { useIamCtx } from './useIamCtx';
import { IamLiveBanner, useLiveIam } from './useLiveIam';

/** Roles & Permissions: Roles · Access Policies (route roles?tab=policies). Live tenants: KAP roles; policies stay session-only. */
export default function RolesPage() {
  const [params] = useSearchParams();
  const c = useIamCtx();
  const { live, ctx } = useLiveIam(c);
  const tab = params.get('tab') ?? undefined;
  const model = ctx ? liveRolesScreen(ctx, tab) : rolesScreen(c, tab);
  useCrumbs([ROLE_TABS.find((t) => t[0] === model.head.tab)?.[1]]);
  return (
    <>
      <IamLiveBanner live={live} what="roles" />
      <ScreenView model={model} />
    </>
  );
}
