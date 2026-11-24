import { mock, useApi } from './client';
import { buildTrace } from '@/mocks/traces';
import { fetchTrace, toTrace } from './platformLive';
import { useLiveTenant } from './live';

/** Trace of one agent job: real (platform API) for a live tenant, mocked otherwise. */
export function useTrace(jobId?: string) {
  const live = useLiveTenant();
  return useApi(
    ['trace', live?.tenantId ?? 'mock', jobId],
    async () => {
      if (!live) return mock(() => buildTrace(jobId));
      const t = jobId ? await fetchTrace(jobId) : null;
      return t ? toTrace(t) : null;
    },
    // a running job's trace grows; refresh until it is final
    live ? { staleTime: 0, refetchInterval: (q) => (q.state.data && ['running', 'queued'].includes(q.state.data.status) ? 3000 : false) } : undefined,
  );
}
