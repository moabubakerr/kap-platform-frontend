import { ScreenView } from '@/engine/ScreenView';
import { platformAdminsScreen } from './build';
import { useIamCtx } from './useIamCtx';

const PADMIN_NOTE = 'Session only: platform administrators drive this console’s access simulation. KAP has no equivalent (its installation superusers are managed in KAP’s admin panel), so changes here do not reach KAP.';

/** Platform administrators (route /platform/admins). */
export default function PlatformAdminsPage() {
  const m = platformAdminsScreen(useIamCtx());
  return <ScreenView model={{ ...m, sections: m.sections.map((s, i) => (i === 0 ? { ...s, callout: PADMIN_NOTE } : s)) }} />;
}
