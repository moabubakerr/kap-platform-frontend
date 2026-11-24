// Projects on KAP. In the KAP API these are tenants (GET /api/tenants);
// the console calls them "projects". IDs are the test-stand tenant UUIDs.
export type ProjectKey = 'sceai' | 'economic-affairs' | 'sandbox' | 'default';

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
}

export const PROJECTS: Project[] = [
  {
    key: 'sceai',
    name: 'SCEAI',
    initials: 'SC',
    description: 'Supreme Council for Economic Affairs and Investment',
    tenantId: 'a81e92d4-9541-433a-b295-c869b5dbaf17',
    enabled: true,
    color: '#8A1538',
  },
  {
    key: 'economic-affairs',
    name: 'Economic Affairs',
    initials: 'EA',
    description: 'Not in this prototype',
    tenantId: '64ba30ab-aa5a-484a-bf4a-13ad9106a051',
    enabled: false,
    color: '#C8B49A',
  },
  {
    key: 'sandbox',
    name: 'sandbox',
    initials: 'SB',
    description: 'AI team test tenant · live data from the test stand',
    tenantId: '71b6c98a-7f7a-4a8b-ab31-132c85bdc88b',
    enabled: true,
    color: '#0F766E',
    live: true,
  },
  {
    key: 'default',
    name: 'Default',
    initials: 'DF',
    description: 'System project · defaults for new projects',
    tenantId: '55c51498-5aae-4fa8-aeec-37d2e520b49a',
    enabled: true,
    color: '#8C8487',
  },
];

export const projectByKey = (k: string | undefined) => PROJECTS.find((p) => p.key === k);

/** Signed-in console user (mock). */
export const CURRENT_USER = {
  username: 'm.alkuwari',
  name: 'Mariam Al-Kuwari',
  initials: 'MK',
  team: 'AI team',
  role: 'admin',
};
