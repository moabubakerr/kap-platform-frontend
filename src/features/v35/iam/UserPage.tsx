import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { USER_TABS, userScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** A user: Overview · Groups · Effective Access · Security (route users/:userId/:tab?). */
export default function UserPage() {
  const { userId = '', tab } = useParams();
  const model = userScreen(useIamCtx(), userId, tab);
  useCrumbs([userId, !model.denied && (USER_TABS.find((t) => t[0] === model.head.tab)?.[1] ?? 'Overview')]);
  return <ScreenView model={model} />;
}
