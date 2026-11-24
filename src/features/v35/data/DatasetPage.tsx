import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { DATASET_TABS, datasetScreen } from './build';
import { NoBusinessData, useDataHub } from './useDataHub';

/** Dataset detail (route /structured/:datasetId/:tab?): Overview · Schema · Preview · Quality · Provenance · Access & Usage. */
export default function DatasetPage() {
  const { datasetId = '', tab } = useParams();
  const h = useDataHub();
  useCrumbs([datasetId, DATASET_TABS.find(([k]) => k === tab)?.[1]]);
  if (!h) return <NoBusinessData title={datasetId} />;
  return <ScreenView model={datasetScreen(h, datasetId, tab)} />;
}
