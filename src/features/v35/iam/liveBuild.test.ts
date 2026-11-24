import { beforeEach, describe, expect, it } from 'vitest';
import type { FormValues, SaveResult } from '@/engine/dialogs';
import type { Row, ScreenModel } from '@/engine/types';
import { iamStore } from '@/v35/iam';
import { identityStore } from '@/v35/data/identity';
import type { IamCtx } from './build';
import { toLive, type KapGroup, type KapRole, type KapUserDetails, type KapUserSummary, type LiveIam } from './fromKap';
import { liveGroupScreen, liveGroupsScreen, liveRolesScreen, liveServiceAccountScreen, liveServiceAccountsScreen, liveUserScreen, liveUsersScreen, type LiveCtx } from './liveBuild';

const T0 = '2026-05-12T14:05:00Z';
const U: KapUserSummary[] = [
  { id: 'u-1', username: 'sbx.admin', account_type: 'user', description: 'Sandbox admin', is_staff: true, is_superuser: false, is_active: true, created_at: T0, updated_at: T0 },
  { id: 'u-2', username: 'etl-svc', account_type: 'service_account', description: 'ETL', is_staff: false, is_superuser: false, is_active: true, created_at: T0, updated_at: T0 },
];
const DET: Record<string, KapUserDetails> = {
  'u-1': { ...U[0], groups: [{ id: 'g-1', name: 'admins' }], effective_roles: [{ code: 'administrator' }] },
  'u-2': { ...U[1], groups: [], effective_roles: [] },
};
const G: KapGroup[] = [{ id: 'g-1', name: 'admins', description: 'AI team', is_active: true, created_at: T0, updated_at: T0 }];
const R: KapRole[] = [
  { id: 'r-1', code: 'administrator', name: 'Administrator', description: null, is_system: true, permissions: [{ id: 'p1', code: 'agent:read', resource_type: 'agent', action: 'read' }], created_at: T0, updated_at: T0 },
  { id: 'r-2', code: 'analyst', name: 'Analyst', description: null, is_system: true, permissions: [{ id: 'p1', code: 'agent:read', resource_type: 'agent', action: 'read' }], created_at: T0, updated_at: T0 },
];

function harness(over: Partial<LiveIam> = {}) {
  let L: LiveIam = { ...toLive({ users: U, details: DET, groups: G, roles: R, perms: R[0].permissions, res: [{ rt: 'agent', id: '11111111-1111-1111-1111-111111111111', n: 'Indicators agent' }], creds: [], credsWhy: '' }), ...over };
  const calls: [string, string, unknown][] = [];
  const log = { forms: [] as { title: string; save: (v: FormValues) => SaveResult }[], confirms: [] as { title: string; fn: () => unknown }[], secrets: [] as { title: string; tok: string }[], toasts: [] as string[], audit: [] as string[], went: [] as string[], reloads: 0 };
  const replies: Record<string, unknown> = {};
  let fail = '';
  const ctx = (): LiveCtx => ({
    T: 'sandbox',
    actor: 'kap.ops',
    L,
    loading: false,
    canUser: true,
    canGrantM: true,
    canCfg: true,
    ui: {
      form: (title, _f, _l, save) => log.forms.push({ title, save }),
      confirm: (title, _b, _i, _c, fn) => log.confirms.push({ title, fn }),
      secret: (title, tok) => log.secrets.push({ title, tok }),
      toast: (m) => log.toasts.push(m),
    },
    go: (p) => log.went.push(p),
    call: async <R,>(m: string, p: string, b?: unknown) => {
      calls.push([m, p, b]);
      if (fail) throw new Error(fail);
      return (replies[`${m} ${p}`] ?? {}) as R;
    },
    write: async (w) => {
      try {
        await w();
      } catch (e) {
        return (e as Error).message;
      }
      log.reloads++;
      return '';
    },
    audit: (a, r) => log.audit.push(`${a}: ${r}`),
    remember: (fn) => {
      const n = structuredClone(L);
      fn(n);
      L = n;
    },
    session: { T: 'sandbox', actor: 'kap.ops', iam: iamStore.get(), idn: identityStore.get(), canUser: true, canGrantM: true, canCfg: true, pEdit: true, ui: { form: () => {}, confirm: () => {}, secret: () => {}, toast: () => {} }, go: () => {}, setIam: iamStore.update, setIdn: identityStore.update } as IamCtx,
    rand: () => 0.5,
  });
  return { ctx, calls, log, replies, failWith: (m: string) => (fail = m), L: () => L };
}

const rows = (m: ScreenModel, i = 0): Row[] => m.sections[i].rows ?? [];
const actOf = (r: { acts?: { l: string; f: () => void }[] } | undefined, l: string) => r?.acts?.find((a) => a.l === l);
const vals = (r: Row) => r.cells.map((c) => c.p?.[1] ?? c.v);

beforeEach(() => {
  iamStore.reset();
  identityStore.reset();
});

describe('live users', () => {
  it('lists KAP user accounts only, with groups and status', () => {
    const { ctx } = harness();
    const m = liveUsersScreen(ctx());
    expect(rows(m).map(vals)).toEqual([['sbx.admin', 'Sandbox admin', 'Staff', 'admins', 'Active', '12 May 2026, 14:05']]);
  });

  it('creates a user in KAP with groups and shows the generated password once', async () => {
    const h = harness();
    liveUsersScreen(h.ctx()).head.add!.f();
    const e = await h.log.forms[0].save({ id: 'f.alsada', d: 'Analyst', pw: 'Generate a password', groups: ['admins'] });
    expect(e).toBe('');
    expect(h.calls[0][0]).toBe('POST');
    expect(h.calls[0][1]).toBe('users');
    expect(h.calls[0][2]).toMatchObject({ username: 'f.alsada', account_type: 'user', description: 'Analyst', group_ids: ['g-1'] });
    expect((h.calls[0][2] as { password: string }).password).toBe(h.log.secrets[0].tok);
    expect(h.log.audit).toEqual(['Created user: f.alsada · groups admins']);
  });

  it('rejects a taken username before calling KAP and shows KAP errors', async () => {
    const h = harness();
    liveUsersScreen(h.ctx()).head.add!.f();
    expect(await h.log.forms[0].save({ id: 'sbx.admin', pw: 'No password (single sign-on)' })).toBe('This username is already in use.');
    h.failWith('Forbidden');
    expect(await h.log.forms[0].save({ id: 'new.user', pw: 'No password (single sign-on)' })).toBe('Forbidden');
    expect(h.log.secrets).toEqual([]);
  });

  it('edits the description and deactivates through KAP', async () => {
    const h = harness();
    const m = liveUserScreen(h.ctx(), 'sbx.admin');
    const r = rows(m).find((x) => x.cells[0].v === 'Description')!;
    actOf(r, 'Edit')!.f();
    expect(await h.log.forms[0].save({ v: 'Sandbox admin' })).toBe('No change.');
    expect(await h.log.forms[0].save({ v: 'Admin' })).toBe('');
    expect(h.calls.pop()).toEqual(['PATCH', 'users/u-1', { description: 'Admin' }]);
    actOf(rows(m).find((x) => x.cells[0].v === 'Status in sandbox'), 'Deactivate')!.f();
    await h.log.confirms[0].fn();
    expect(h.calls.pop()).toEqual(['POST', 'users/u-1/deactivate', undefined]);
  });

  it('does not deactivate the account the platform calls KAP with', () => {
    const h = harness({ me: 'u-1' });
    const m = liveUserScreen(h.ctx(), 'sbx.admin');
    actOf(rows(m).find((x) => x.cells[0].v === 'Status in sandbox'), 'Deactivate')!.f();
    expect(h.log.confirms).toEqual([]);
    expect(h.log.forms[0].title).toBe('Deactivate sbx.admin?');
  });

  it('shows effective roles from KAP', () => {
    const { ctx } = harness();
    const m = liveUserScreen(ctx(), 'sbx.admin', 'access');
    expect(rows(m).map(vals)).toEqual([['Administrator', 'administrator', 'agent:read']]);
  });

  it('adds and removes group memberships', async () => {
    const h = harness();
    actOf(rows(liveUserScreen(h.ctx(), 'sbx.admin', 'groups'))[0], 'Remove')!.f();
    await h.log.confirms[0].fn();
    expect(h.calls.pop()).toEqual(['DELETE', 'groups/g-1/users/u-1', undefined]);
  });
});

describe('live groups', () => {
  it('creates a group and adds members', async () => {
    const h = harness();
    h.replies['POST groups'] = { id: 'g-9' };
    liveGroupsScreen(h.ctx()).head.add!.f();
    expect(await h.log.forms[0].save({ n: 'admins' })).toBe('A group with this name already exists.');
    expect(await h.log.forms[0].save({ n: 'ops', d: 'Operators', members: ['etl-svc'] })).toBe('');
    expect(h.calls).toEqual([
      ['POST', 'groups', { name: 'ops', description: 'Operators' }],
      ['POST', 'groups/g-9/users', { user_id: 'u-2' }],
    ]);
  });

  it('assigns a role on one resource, remembers the grant and revokes it', async () => {
    const h = harness();
    h.replies['POST groups/g-1/access-grants'] = { id: 'gr-1', group_id: 'g-1', role_id: 'r-2', resource_type: 'agent', scope: 'RESOURCE', resource_id: '11111111-1111-1111-1111-111111111111', created_at: T0 };
    liveGroupScreen(h.ctx(), 'admins', 'access').sections[0].sacts![0].f();
    expect(await h.log.forms[0].save({ r: 'Analyst', s: 'agent · Indicators agent' })).toBe('');
    expect(h.calls[0]).toEqual(['POST', 'groups/g-1/access-grants', { role_id: 'r-2', resource_type: 'agent', scope: 'RESOURCE', resource_id: '11111111-1111-1111-1111-111111111111' }]);
    const m = liveGroupScreen(h.ctx(), 'admins', 'access');
    expect(rows(m).map((r) => vals(r).slice(0, 2))).toEqual([['Analyst', 'agent · Indicators agent']]);
    actOf(rows(m)[0], 'Revoke')!.f();
    await h.log.confirms[0].fn();
    expect(h.calls.pop()).toEqual(['DELETE', 'groups/g-1/access-grants/gr-1', undefined]);
    expect(h.L().grants).toEqual([]);
  });

  it('disables a group with a PATCH', async () => {
    const h = harness();
    const m = liveGroupScreen(h.ctx(), 'admins');
    actOf(rows(m).find((x) => x.cells[0].v === 'Status'), 'Disable')!.f();
    await h.log.confirms[0].fn();
    expect(h.calls.pop()).toEqual(['PATCH', 'groups/g-1', { is_active: false }]);
  });
});

describe('live roles and service accounts', () => {
  it('lists KAP roles and keeps custom roles and policies session-only', () => {
    const { ctx } = harness();
    const m = liveRolesScreen(ctx());
    expect(rows(m).map((r) => r.cells[0].v)).toEqual(['Administrator', 'Analyst']);
    expect(m.sections[1].badge).toBe('Session only');
    expect(m.head.add?.l).toBe('Create session role');
    expect(liveRolesScreen(ctx(), 'policies').sections[0].callout).toMatch(/^Session only/);
  });

  it('creates a service account and its OAuth client, showing the secret once', async () => {
    const h = harness();
    h.replies['POST users'] = { ...DET['u-2'], id: 'u-9', username: 'reporting-svc' };
    h.replies['POST oauth-clients'] = { id: 'oc-1', user_id: 'u-9', client_id: 'cid', client_secret: 's3cret', status: 'active', created_at: T0 };
    liveServiceAccountsScreen(h.ctx()).head.add!.f();
    expect(await h.log.forms[0].save({ n: 'reporting-svc', d: 'Reports', groups: [], exp: 'No expiry' })).toBe('');
    expect(h.calls.map((c) => c[1])).toEqual(['users', 'oauth-clients']);
    expect(h.calls[0][2]).toMatchObject({ account_type: 'service_account' });
    expect(h.calls[1][2]).toEqual({ user_id: 'u-9', label: 'reporting-svc-1' });
    expect(h.log.secrets).toEqual([{ title: 'Client secret for reporting-svc', tok: 's3cret' }]);
  });

  it('says when OAuth clients are not available', () => {
    const { ctx } = harness({ creds: null, credsWhy: "KAP resource 'oauth-clients' is not available through the platform." });
    expect(vals(rows(liveServiceAccountsScreen(ctx()))[0])[4]).toBe('Not available');
    const m = liveServiceAccountScreen(ctx(), 'etl-svc', 'creds');
    expect(m.sections[0].callout).toContain('not available through the platform');
  });
});
