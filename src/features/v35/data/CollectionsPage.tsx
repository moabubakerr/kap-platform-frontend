import { collectionsScreen } from './build';
import { liveCollectionsScreen } from './liveBuild';
import { DataScreen, NoBusinessData, useDataHub } from './useDataHub';

/** Business Data Hub · Collections (route /collections). Live tenant: collections from KAP. */
export default function CollectionsPage() {
  const h = useDataHub();
  if (!h) return <NoBusinessData title="Collections" />;
  return <DataScreen live={h.status} what="collections" model={h.live ? liveCollectionsScreen(h) : collectionsScreen(h)} />;
}
