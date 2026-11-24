// Tenants on KAP (GET /api/tenants). IDs are the test-stand tenant UUIDs.
// (The type keeps its old name "Project"; the UI says "Tenant", as in v35.)
import type { TenantKey } from '@/v35/iam';

export type ProjectKey = TenantKey;

export interface Project {
  key: ProjectKey;
  name: string;
  initials: string;
  description: string;
  tenantId: string;
  enabled: boolean;
  color: string;
  /** Jobs and traces come from the platform API (real runs on the test stand), not mocks. */
  live?: boolean;
  /** v1 mock screens carry SCEAI data; other tenants show them only with a notice. */
  sample?: boolean;
}

export const PROJECTS: Project[] = [
  { key: 'sceai', name: 'SCEAI', initials: 'SC', description: 'Supreme Council for Economic Affairs and Investment', tenantId: 'a81e92d4-9541-433a-b295-c869b5dbaf17', enabled: true, color: '#8A1538' },
  { key: 'econ', name: 'Economic Affairs', initials: 'EA', description: 'Economic Affairs directorate · sample tenant', tenantId: '64ba30ab-aa5a-484a-bf4a-13ad9106a051', enabled: true, color: '#C8B49A', sample: true },
  { key: 'sandbox', name: 'sandbox', initials: 'SB', description: 'AI team experiments · live data from the test stand', tenantId: '71b6c98a-7f7a-4a8b-ab31-132c85bdc88b', enabled: true, color: '#0F766E', live: true, sample: true },
  { key: 'default', name: 'Default', initials: 'DF', description: 'Internal · platform service identities, not a customer tenant', tenantId: '55c51498-5aae-4fa8-aeec-37d2e520b49a', enabled: true, color: '#8C8487' },
];

export const projectByKey = (k: string | undefined) => PROJECTS.find((p) => p.key === k);

/** Signed-in console user for v1 screens that still read it (v35 uses the access model's "view as"). */
export const CURRENT_USER = {
  username: 'm.alkuwari',
  name: 'Mariam Al-Kuwari',
  initials: 'MK',
  team: 'AI team',
  role: 'admin',
};
