import { mock, useApi } from './client';
import { fetchJobs, toJob } from './platformLive';
import { LIVE_REFRESH_MS, useLiveTenant } from './live';
import { AGENTS, JOBS, TOOLS, USERS, agentById, jobById, userByName } from '@/mocks/core';

// Query hooks for shared resources. Real endpoints noted for the swap.
export const useAgents = () => useApi(['agents'], () => mock(AGENTS)); // GET /api/agents
export const useAgent = (id?: string) => useApi(['agent', id], () => mock(agentById(id) ?? null)); // GET /api/agents/{id}
/** Agent jobs: real ones from the platform API for a live tenant, mocks otherwise. */
export function useJobs() {
  const live = useLiveTenant();
  return useApi(
    ['jobs', live?.tenantId ?? 'mock'],
    async () => (live ? (await fetchJobs(live.tenantId)).items.map((j) => toJob(j)) : mock(JOBS)),
    live ? { refetchInterval: LIVE_REFRESH_MS, staleTime: 0 } : undefined,
  );
}
export const useJob = (id?: string) => useApi(['job', id], () => mock(jobById(id) ?? null)); // GET /api/agents/{agent}/jobs/{job}
export const useUsers = () => useApi(['users'], () => mock(USERS)); // GET /api/users
export const useUser = (n?: string) => useApi(['user', n], () => mock(userByName(n) ?? null));
export const useTools = () => useApi(['tools'], () => mock(TOOLS)); // GET /api/tools
