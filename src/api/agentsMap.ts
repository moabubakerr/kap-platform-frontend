import * as React from 'react';
import { mock, useApi } from './client';
import { AGENTS_MAP } from '@/mocks/agentsMap';
import { INITIAL_LIVE, subscribeLive, type LiveSnapshot } from '@/mocks/live';

/** Ask AI pipeline topology + 7-day stats. Real: GET /api/askai/admin/stats + KAP agents. */
export const useAgentsMap = () => useApi(['agents-map'], () => mock(AGENTS_MAP));

/** Live in-flight snapshot; generator runs only while `enabled` (live mode). */
export function useLiveEvents(enabled: boolean): LiveSnapshot {
  const [snap, setSnap] = React.useState<LiveSnapshot>(INITIAL_LIVE);
  React.useEffect(() => {
    if (!enabled) return;
    return subscribeLive(setSnap);
  }, [enabled]);
  return snap;
}
