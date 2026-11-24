import { mock, useApi } from './client';
import { PROVIDERS, buildAgentDetail } from '@/mocks/agents';

// GET /api/agents/{id} (+ /versions, /grants, /metrics) folded into one view-model.
export const useAgentDetail = (id?: string) => useApi(['agent-detail', id], () => mock(() => buildAgentDetail(id)));
// GET /api/model-providers
export const useProviders = () => useApi(['providers'], () => mock(PROVIDERS));
