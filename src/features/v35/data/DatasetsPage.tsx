import { ScreenView } from '@/engine/ScreenView';
import { datasetsScreen } from './build';
import { NoBusinessData, useDataHub } from './useDataHub';

/** Business Data Hub · Structured Data (route /structured). */
export default function DatasetsPage() {
  const h = useDataHub();
  if (!h) return <NoBusinessData title="Structured Data" />;
  return <ScreenView model={datasetsScreen(h)} />;
}
