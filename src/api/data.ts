import { mock, useApi } from './client';
import { COLLECTIONS, CONNECTORS, FILES, PACKAGES, PIPELINES, RUNS, collectionById } from '@/mocks/data';

// Real backend: KAP /api/collections, /api/connectors, /api/packages,
// /api/pipelines and pipeline runs on the kap.pipeline queue.
export const useCollections = () => useApi(['collections'], () => mock(COLLECTIONS));
export const useCollection = (id?: string) => useApi(['collection', id], () => mock(collectionById(id) ?? null));
export const useCollectionFiles = (id?: string) => useApi(['collection', id, 'files'], () => mock(collectionById(id) ? FILES : []));
export const useConnectors = () => useApi(['connectors'], () => mock(CONNECTORS));
export const usePackages = () => useApi(['packages'], () => mock(PACKAGES));
export const usePipelines = () => useApi(['pipelines'], () => mock(PIPELINES));
export const usePipelineRuns = () => useApi(['pipeline-runs'], () => mock(RUNS));
