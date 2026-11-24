import { ScreenView } from '@/engine/ScreenView';
import { usersScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** Users of the tenant (route /p/:tenant/users). */
export default function UsersPage() {
  return <ScreenView model={usersScreen(useIamCtx())} />;
}
