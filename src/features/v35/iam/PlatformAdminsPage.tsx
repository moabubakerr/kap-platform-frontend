import { ScreenView } from '@/engine/ScreenView';
import { platformAdminsScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** Platform administrators (route /platform/admins). */
export default function PlatformAdminsPage() {
  return <ScreenView model={platformAdminsScreen(useIamCtx())} />;
}
