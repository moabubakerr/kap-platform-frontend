import { mock, useApi } from './client';
import { DEFAULT_OVERVIEW, OVERVIEW } from '@/mocks/overview';

// Real backend: Ask AI /admin/stats + KAP /api/agents, /api/jobs aggregates.
export const useOverview = () => useApi(['overview', 'sceai'], () => mock(OVERVIEW));
// Real backend: KAP /api/tenants/{default} + /api/users, /api/providers, queue policies.
export const useDefaultOverview = () => useApi(['overview', 'default'], () => mock(DEFAULT_OVERVIEW));
