import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { SOURCE_TABS, sourceScreen } from './build';
import { useIngest } from './useIngest';

/** Data source detail (route /sources/:sourceId/:tab?): Overview · Connection Settings · Browse / Test · Used by Pipelines · Activity. */
export default function SourcePage() {
  const { sourceId = '', tab } = useParams();
  const c = useIngest();
  const model = sourceScreen(c, sourceId, tab, (v) => c.go.source(sourceId, v));
  useCrumbs([sourceId, model.head.tabs ? SOURCE_TABS.find((x) => x.value === model.head.tab)?.label : undefined]);
  return <ScreenView model={model} />;
}
