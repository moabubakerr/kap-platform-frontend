import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { COLLECTION_TABS, collectionScreen } from './build';
import { PAGE } from './fromKap';
import { liveCollectionScreen } from './liveBuild';
import { combineLive, useLiveFiles } from './liveData';
import { DataScreen, NoBusinessData, useDataHub } from './useDataHub';

/** Collection detail (route /collections/:collectionId/:tab?): Overview · Data Scope · Retrieval & Query · Access & Usage. */
export default function CollectionPage() {
  const { collectionId = '', tab } = useParams();
  const h = useDataHub();
  useCrumbs([collectionId, COLLECTION_TABS.find(([k]) => k === tab)?.[1]]);
  // live tenant: the collection's files load page by page on Data Scope
  const files = useLiveFiles(h?.t, tab === 'scope' ? collectionId : null, h?.live?.filesAt(collectionId) ?? { offset: 0, size: PAGE });
  if (!h) return <NoBusinessData title={collectionId} />;
  return <DataScreen live={combineLive(h.status, files)} what="collections" model={h.live ? liveCollectionScreen(h, collectionId, tab) : collectionScreen(h, collectionId, tab)} />;
}
