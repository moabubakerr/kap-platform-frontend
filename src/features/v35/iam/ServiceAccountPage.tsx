import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { SA_TABS, serviceAccountScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** A service account: Overview · Access · Credentials (route service-accounts/:saId/:tab?). */
export default function ServiceAccountPage() {
  const { saId = '', tab } = useParams();
  const model = serviceAccountScreen(useIamCtx(), saId, tab);
  useCrumbs([saId, !model.denied && (SA_TABS.find((t) => t[0] === model.head.tab)?.[1] ?? 'Overview')]);
  return <ScreenView model={model} />;
}
