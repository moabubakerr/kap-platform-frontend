import { ScreenView } from '@/engine/ScreenView';
import { collectionsScreen } from './build';
import { NoBusinessData, useDataHub } from './useDataHub';

/** Business Data Hub · Collections (route /collections). */
export default function CollectionsPage() {
  const h = useDataHub();
  if (!h) return <NoBusinessData title="Collections" />;
  return <ScreenView model={collectionsScreen(h)} />;
}
