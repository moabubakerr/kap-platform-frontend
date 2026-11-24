import { ScreenView } from '@/engine/ScreenView';
import { groupsScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** Groups of the tenant (route /p/:tenant/groups). */
export default function GroupsPage() {
  return <ScreenView model={groupsScreen(useIamCtx())} />;
}
