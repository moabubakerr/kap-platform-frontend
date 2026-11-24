import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { COLLECTION_TABS, collectionScreen } from './build';
import { NoBusinessData, useDataHub } from './useDataHub';

/** Collection detail (route /collections/:collectionId/:tab?): Overview · Data Scope · Retrieval & Query · Access & Usage. */
export default function CollectionPage() {
  const { collectionId = '', tab } = useParams();
  const h = useDataHub();
  useCrumbs([collectionId, COLLECTION_TABS.find(([k]) => k === tab)?.[1]]);
  if (!h) return <NoBusinessData title={collectionId} />;
  return <ScreenView model={collectionScreen(h, collectionId, tab)} />;
}
