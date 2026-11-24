/**
 * Business Data Hub view state kept across navigation, per tenant, as the
 * prototype does: Unstructured Data filters (udF), the last result list for
 * document Previous / Next (_udIds), and the user picked in "Check effective
 * access" (effU).
 */
import { createStore } from '@/engine/store';

export interface UdFilters {
  q: string;
  coll: string;
  ty: string;
  pst: string;
  src: string;
  pipe: string;
  lang: string;
  cls: string;
  date: string;
  from: string;
  to: string;
  sort: string;
  page: number;
  size: number;
}

export const UD_DEFAULT: UdFilters = { q: '', coll: 'All collections', ty: 'All types', pst: 'All statuses', src: 'All data sources', pipe: 'All pipelines', lang: 'All languages', cls: 'All classifications', date: 'Any time', from: '', to: '', sort: 'Newest first', page: 1, size: 25 };

export interface DataSession {
  udF: Record<string, UdFilters>;
  udIds: Record<string, string[]>;
  effU: Record<string, string>;
}

export const dataSession = createStore<DataSession>(() => ({ udF: {}, udIds: {}, effU: {} }));
