import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { DATASET_TABS, datasetScreen } from './build';
import { PAGE, collectionOfDataset } from './fromKap';
import { liveDatasetScreen } from './liveBuild';
import { combineLive, useLiveFiles, useLiveObservations } from './liveData';
import { DataScreen, NoBusinessData, useDataHub } from './useDataHub';

/** Dataset detail (route /structured/:datasetId/:tab?): Overview · Schema · Preview · Quality · Provenance · Access & Usage. */
export default function DatasetPage() {
  const { datasetId = '', tab } = useParams();
  const h = useDataHub();
  useCrumbs([datasetId, DATASET_TABS.find(([k]) => k === tab)?.[1]]);
  // live tenant: observations page by page on Preview, package files on Provenance
  const obs = useLiveObservations(h?.t, tab === 'preview' ? datasetId : null, h?.live?.obsAt(datasetId) ?? { offset: 0, size: PAGE, status: '' });
  const coll = h?.live ? (collectionOfDataset(h.live.cache, datasetId)?.name ?? null) : null;
  const files = useLiveFiles(h?.t, tab === 'prov' ? coll : null, (coll && h?.live?.filesAt(coll)) || { offset: 0, size: PAGE });
  if (!h) return <NoBusinessData title={datasetId} />;
  return <DataScreen live={combineLive(h.status, obs, files)} what="datasets" model={h.live ? liveDatasetScreen(h, datasetId, tab) : datasetScreen(h, datasetId, tab)} />;
}
