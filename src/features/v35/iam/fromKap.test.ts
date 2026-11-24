import { describe, expect, it } from 'vitest';
import { parseScope, scopeLabel, scopeOptions, toCred, toGrant, toKapGrant, toKapGroupCreate, toKapGroupPatch, toKapMember, toKapOauthClient, toKapUserCreate, toKapUserPatch, toLive, toRole, toUser, when, type KapGroup, type KapPermission, type KapRole, type KapUserDetails, type KapUserSummary } from './fromKap';

// fixtures shaped from KAP's OpenAPI schemas
const U1: KapUserSummary = { id: 'u-1', username: 'sbx.admin', account_type: 'user', description: 'Sandbox admin', is_staff: true, is_superuser: false, is_active: true, created_at: '2026-05-12T14:05:00Z', updated_at: '2026-06-01T08:00:00Z' };
const U2: KapUserSummary = { id: 'u-2', username: 'etl-svc', account_type: 'service_account', description: null, is_staff: false, is_superuser: false, is_active: false, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-02T00:00:00Z' };
const D1: KapUserDetails = { ...U1, groups: [{ id: 'g-1', name: 'admins' }], effective_roles: [{ code: 'administrator' }, { code: 'administrator' }], deactivated_at: null };
const G1: KapGroup = { id: 'g-1', name: 'admins', description: 'AI team', is_active: true, created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' };
const G2: KapGroup = { id: 'g-2', name: 'testers', description: null, is_active: false, created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' };
const P: KapPermission[] = [
  { id: 'p1', code: 'agent:read', resource_type: 'agent', action: 'read' },
  { id: 'p2', code: 'agent:execute', resource_type: 'agent', action: 'execute' },
  { id: 'p3', code: 'audit:read', resource_type: 'audit', action: 'read' },
];
const R1: KapRole = { id: 'r-1', code: 'analyst', name: 'Analyst', description: null, is_system: true, permissions: [P[0], P[1]], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

describe('fromKap mapping', () => {
  it('formats times in UTC and leaves missing ones as a dash', () => {
    expect(when('2026-05-12T14:05:00Z')).toBe('12 May 2026, 14:05');
    expect(when(null)).toBe('—');
    expect(when('nonsense')).toBe('—');
  });

  it('maps a user with details: groups, unique effective roles, flags', () => {
    const u = toUser(U1, D1);
    expect(u).toMatchObject({ id: 'u-1', n: 'sbx.admin', d: 'Sandbox admin', type: 'user', active: true, staff: true, superuser: false, groups: ['g-1'], roles: ['administrator'], detailed: true, deactivated: '—' });
  });

  it('maps a user without details honestly (no groups, not detailed)', () => {
    const u = toUser(U2, null);
    expect(u).toMatchObject({ n: 'etl-svc', d: '', type: 'service_account', active: false, groups: [], roles: [], detailed: false });
  });

  it('derives group members from user details and keeps session grants of known groups', () => {
    const L = toLive(
      { users: [U1, U2], details: { 'u-1': D1, 'u-2': null }, groups: [G1, G2], roles: [R1], perms: P, res: [{ rt: 'agent', id: 'a-1', n: 'Indicators agent' }], creds: null, credsWhy: 'not forwarded' },
      [
        { id: 'gr-1', gid: 'g-1', roleId: 'r-1', rt: 'agent', scope: 'ALL', rid: null, created: '—' },
        { id: 'gr-x', gid: 'gone', roleId: 'r-1', rt: 'agent', scope: 'ALL', rid: null, created: '—' },
      ],
    );
    expect(L.groups.map((g) => [g.n, g.d, g.active, g.members])).toEqual([['admins', 'AI team', true, ['u-1']], ['testers', '', false, []]]);
    expect(L.grants.map((g) => g.id)).toEqual(['gr-1']);
    expect(L.roles).toEqual([toRole(R1)]);
    expect(L.roles[0]).toMatchObject({ n: 'Analyst', sys: true, perms: ['agent:read', 'agent:execute'] });
    expect(L.creds).toBeNull();
    expect(L.credsWhy).toBe('not forwarded');
  });

  it('maps grants and OAuth clients', () => {
    expect(toGrant({ id: 'x', group_id: 'g-1', role_id: 'r-1', resource_type: 'agent', scope: 'RESOURCE', resource_id: 'a-1', created_at: '2026-05-12T14:05:00Z' })).toEqual({ id: 'x', gid: 'g-1', roleId: 'r-1', rt: 'agent', scope: 'RESOURCE', rid: 'a-1', created: '12 May 2026, 14:05' });
    expect(toCred({ id: 'c', user_id: 'u-2', client_id: 'cid', label: 'etl-1', status: 'active', expires_at: null, created_at: '2026-05-12T14:05:00Z' })).toMatchObject({ clientId: 'cid', st: 'Active', exp: 'Never', last: '—' });
  });
});

describe('scopes', () => {
  const L = { perms: P.map((p) => ({ code: p.code, rt: p.resource_type, action: p.action })), res: [{ rt: 'agent', id: 'a-1', n: 'Indicators agent' }, { rt: 'collection', id: 'c-1', n: 'docs' }] };
  it('offers all-of-type scopes, then single resources', () => {
    expect(scopeOptions(L)).toEqual(['All · agent', 'All · audit', 'All · collection', 'agent · Indicators agent', 'collection · docs']);
  });
  it('parses choices back to KAP scope fields and labels grants', () => {
    expect(parseScope(L, 'All · audit')).toEqual({ rt: 'audit', scope: 'ALL', rid: null });
    expect(parseScope(L, 'agent · Indicators agent')).toEqual({ rt: 'agent', scope: 'RESOURCE', rid: 'a-1' });
    expect(parseScope(L, 'agent · missing')).toBeNull();
    expect(scopeLabel(L, { rt: 'agent', scope: 'RESOURCE', rid: 'a-1' })).toBe('agent · Indicators agent');
    expect(scopeLabel(L, { rt: 'agent', scope: 'RESOURCE', rid: 'a-9' })).toBe('agent · a-9');
    expect(scopeLabel(L, { rt: 'agent', scope: 'ALL', rid: null })).toBe('All · agent');
  });
});

describe('request bodies', () => {
  it('creates users and service accounts (no password for service accounts)', () => {
    expect(toKapUserCreate({ username: ' f.alsada ', type: 'user', description: ' Analyst ', password: 'pw', groupIds: ['g-1'] })).toEqual({ username: 'f.alsada', account_type: 'user', is_staff: false, is_superuser: false, group_ids: ['g-1'], description: 'Analyst', password: 'pw' });
    expect(toKapUserCreate({ username: 'etl', type: 'service_account', password: 'pw' })).toEqual({ username: 'etl', account_type: 'service_account', is_staff: false, is_superuser: false, group_ids: [] });
  });
  it('patches only what changed', () => {
    const u = { d: 'old', active: true };
    expect(toKapUserPatch(u, { description: 'old' })).toEqual({});
    expect(toKapUserPatch(u, { description: ' new ' })).toEqual({ description: 'new' });
    expect(toKapUserPatch(u, { description: '' })).toEqual({ description: null });
    expect(toKapUserPatch({ d: '', active: false }, { active: true })).toEqual({ is_active: true });
    const g = { n: 'admins', d: '', active: true };
    expect(toKapGroupPatch(g, { name: 'admins', description: '' })).toEqual({});
    expect(toKapGroupPatch(g, { name: 'ops', active: false })).toEqual({ name: 'ops', is_active: false });
  });
  it('builds group, member, grant and OAuth client bodies', () => {
    expect(toKapGroupCreate(' ops ', '')).toEqual({ name: 'ops' });
    expect(toKapGroupCreate('ops', 'Operators')).toEqual({ name: 'ops', description: 'Operators' });
    expect(toKapMember('u-1')).toEqual({ user_id: 'u-1' });
    expect(toKapGrant('r-1', { rt: 'agent', scope: 'ALL', rid: null })).toEqual({ role_id: 'r-1', resource_type: 'agent', scope: 'ALL' });
    expect(toKapGrant('r-1', { rt: 'agent', scope: 'RESOURCE', rid: 'a-1' })).toEqual({ role_id: 'r-1', resource_type: 'agent', scope: 'RESOURCE', resource_id: 'a-1' });
    expect(() => toKapGrant('r-1', { rt: 'agent', scope: 'RESOURCE', rid: null })).toThrow();
    expect(() => toKapGrant('r-1', { rt: 'audit', scope: 'RESOURCE', rid: 'x' })).toThrow();
    expect(toKapOauthClient('u-2', ' etl-1 ', null)).toEqual({ user_id: 'u-2', label: 'etl-1' });
    expect(toKapOauthClient('u-2', 'etl-1', '2026-12-01T00:00:00.000Z')).toEqual({ user_id: 'u-2', label: 'etl-1', expires_at: '2026-12-01T00:00:00.000Z' });
  });
});
