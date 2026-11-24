import { mock, useApi } from './client';
import { AUDIT, CONFIG_AGENT, CONFIG_VERSIONS, QUEUE_POLICIES, REPORTS, REPORT_HISTORY, SETTINGS, buildDiff } from '@/mocks/governance';

// Governance hooks. Real endpoints noted for the swap (KAP API).
export const useAudit = () => useApi(['audit'], () => mock(AUDIT)); // GET /api/audit
export const useConfigVersions = () => useApi(['config-versions', CONFIG_AGENT], () => mock({ agent: CONFIG_AGENT, versions: CONFIG_VERSIONS, diff: buildDiff() })); // GET /api/configuration-versions?resource=…
export const useReports = () => useApi(['reports'], () => mock({ reports: REPORTS, history: REPORT_HISTORY })); // console-side scheduler
export const useSettings = () => useApi(['settings'], () => mock({ sections: SETTINGS, queues: QUEUE_POLICIES })); // GET /api/tenants/{id} + queue policies
