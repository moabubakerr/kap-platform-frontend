import { mock, useApi } from './client';
import { CATALOGUE_VERSIONS, INDICATORS, INDICATOR_LIST, indicatorByCode } from '@/mocks/catalogue';

// Real backend: Ask AI admin /admin/catalogue[/{id}] (indicators + indicator_details)
// and published_data_points for observations.
export const useCatalogue = () => useApi(['catalogue'], () => mock(INDICATORS.filter((i) => i.inCatalogue)));
export const useCatalogueVersions = () => useApi(['catalogue', 'versions'], () => mock(CATALOGUE_VERSIONS));
export const useCatalogueEntry = (code?: string) => useApi(['catalogue', 'entry', code], () => mock(indicatorByCode(code) ?? null));
export const useIndicators = () => useApi(['indicators'], () => mock(INDICATOR_LIST.map((c) => indicatorByCode(c)!)));
export const useIndicator = (code?: string) => useApi(['indicator', code], () => mock(indicatorByCode(code) ?? null));
