import { mock, useApi } from './client';
import { PLATFORM_AUDIT, PLATFORM_MCP, PLATFORM_MODELS, PLATFORM_OVERVIEW, PLATFORM_QUEUES, PLATFORM_USERS, PROJECTS_PAGE } from '@/mocks/platform';

// KAP platform scope (mock). Real backends: KAP /api/tenants (superuser), Prometheus
// /metrics for model serving and queues, /api/audit/events for the platform audit.
export const usePlatformOverview = () => useApi(['platform', 'overview'], () => mock(PLATFORM_OVERVIEW));
export const usePlatformProjects = () => useApi(['platform', 'projects'], () => mock(PROJECTS_PAGE));
export const usePlatformModels = () => useApi(['platform', 'models'], () => mock(PLATFORM_MODELS));
export const usePlatformMcp = () => useApi(['platform', 'mcp'], () => mock(PLATFORM_MCP));
export const usePlatformQueues = () => useApi(['platform', 'queues'], () => mock(PLATFORM_QUEUES));
export const usePlatformUsers = () => useApi(['platform', 'users'], () => mock(PLATFORM_USERS));
export const usePlatformAudit = () => useApi(['platform', 'audit'], () => mock(PLATFORM_AUDIT));
