import { describe, expect, it } from 'vitest';
import { can, evaluate, roleNamesIn, tenantsOf } from './iam';
import { allowedPlatform, allowedTenant, ALL_PLATFORM_SCREENS, ALL_TENANT_SCREENS, landingFor } from './screens';

const screen = (k: string) => ALL_TENANT_SCREENS.find((s) => s.key === k)!;
const pscreen = (k: string) => ALL_PLATFORM_SCREENS.find((s) => s.key === k)!;

describe('access evaluation (v35 model)', () => {
  it('scopes an analyst to the agents granted to their group', () => {
    expect(can('sceai_analyst', 'sceai', 'agent:read', 'agent', 'sceai_indicators_agent')).toBe(true);
    expect(can('sceai_analyst', 'sceai', 'agent:read', 'agent', 'Composer Agent')).toBe(false);
    expect(evaluate('sceai_analyst', 'sceai', 'agent:read', 'agent', 'sceai_indicators_oxford').why).toBe('Analyst through economic_analysts');
  });

  it('gives tenant administrators everything in their tenant and nothing elsewhere', () => {
    expect(can('sceai_admin', 'sceai', 'user:manage', 'tenant')).toBe(true);
    expect(can('sceai_admin', 'sceai', 'collection:read', 'collection', 'nds_planning_docs')).toBe(true);
    expect(can('sceai_admin', 'sandbox', 'agent:read', 'agent')).toBe(false);
  });

  it('applies access policies after grants (restricted collections)', () => {
    // agent developers hold agents:* only; collections need a tenant or collection grant
    expect(evaluate('r.haddad', 'sceai', 'collection:read', 'collection', 'sceai_indicators').ok).toBe(false);
    // sandbox testers have a tenant-wide Analyst grant but are not cleared for confidential data
    expect(evaluate('sbx_analyst', 'sandbox', 'collection:read', 'collection', 'sandbox_confidential_docs')).toEqual({ ok: false, why: 'Restricted by L2 · Confidential' });
    expect(can('sbx_analyst', 'sandbox', 'collection:read', 'collection', 'sandbox_indicators')).toBe(true);
    expect(can('r.haddad', 'sandbox', 'collection:read', 'collection', 'sandbox_confidential_docs')).toBe(true);
  });

  it('lets platform administrators configure any tenant but not read its agents', () => {
    expect(can('kap.ops', 'sceai', 'tenant:configure', 'tenant')).toBe(true);
    expect(can('kap.ops', 'sceai', 'agent:read', 'agent')).toBe(false);
  });

  it('describes roles and tenants per account', () => {
    expect(roleNamesIn('r.haddad', 'sceai')).toBe('Agent Developer');
    expect(roleNamesIn('r.haddad', 'sandbox')).toBe('Tenant Administrator');
    expect(tenantsOf('r.haddad')).toEqual(['sceai', 'sandbox']);
    expect(tenantsOf('kap.ops')).toEqual([]);
  });
});

describe('screen access', () => {
  it('opens screens by permission', () => {
    expect(allowedTenant('sceai_analyst', 'sceai', screen('jobs'))).toBe(true);
    expect(allowedTenant('sceai_analyst', 'sceai', screen('users'))).toBe(false);
    expect(allowedTenant('sceai_admin', 'sceai', screen('iSources'))).toBe(true);
    expect(allowedTenant('kap.ops', 'sceai', screen('users'))).toBe(true); // platform admins configure tenants
  });

  it('lands each account on its first allowed screen', () => {
    expect(landingFor('sceai_admin', 'sceai')?.key).toBe('home');
    expect(landingFor('kap.ops', 'sceai')?.key).toBe('policies'); // design ORDER: policies before users
    expect(landingFor('ea_analyst', 'sceai')).toBeNull();
  });

  it('gates platform screens by platform role', () => {
    expect(allowedPlatform('kap.ops', pscreen('pKeys'))).toBe(true);
    expect(allowedPlatform('sceai_admin', pscreen('pHome'))).toBe(false);
  });
});
