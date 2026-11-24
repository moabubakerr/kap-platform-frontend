import { useSearchParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { ROLE_TABS, rolesScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** Roles & Permissions: Roles · Access Policies (route roles?tab=policies). */
export default function RolesPage() {
  const [params] = useSearchParams();
  const model = rolesScreen(useIamCtx(), params.get('tab') ?? undefined);
  useCrumbs([ROLE_TABS.find((t) => t[0] === model.head.tab)?.[1]]);
  return <ScreenView model={model} />;
}
