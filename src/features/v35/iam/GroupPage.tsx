import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { GROUP_TABS, groupScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** A group: Members · Access (route groups/:groupId/:tab?). */
export default function GroupPage() {
  const { groupId = '', tab } = useParams();
  const model = groupScreen(useIamCtx(), groupId, tab);
  useCrumbs([groupId, !model.denied && (GROUP_TABS.find((t) => t[0] === model.head.tab)?.[1] ?? 'Members')]);
  return <ScreenView model={model} />;
}
