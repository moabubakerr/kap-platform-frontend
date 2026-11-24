import { beforeEach, describe, expect, it } from 'vitest';
import type { FormValues } from '@/engine/dialogs';
import type { Row, ScreenModel } from '@/engine/types';
import { can, iamStore, type TenantKey } from '@/v35/iam';
import { identityStore } from '@/v35/data/identity';
import { groupScreen, groupsScreen, identityProvidersScreen, idpSyncPlan, platformAdminsScreen, rolesScreen, serviceAccountScreen, serviceAccountsScreen, userScreen, usersScreen, type IamCtx } from './build';

/** A test context over the real stores; dialogs are recorded, and the last form can be submitted. */
function harness(T: TenantKey = 'sceai', perms: Partial<Pick<IamCtx, 'canUser' | 'canGrantM' | 'canCfg' | 'pEdit'>> = {}) {
  const log = { forms: [] as { title: string; save: (v: FormValues) => string; fields: unknown[] }[], confirms: [] as { title: string; body: string; fn: () => void }[], secrets: [] as { title: string; tok: string }[], toasts: [] as string[], went: [] as string[] };
  let seed = 1;
  const ctx = (): IamCtx => ({
    T,
    actor: 'sceai_admin',
    iam: iamStore.get(),
    idn: identityStore.get(),
    canUser: true,
    canGrantM: true,
    canCfg: true,
    pEdit: true,
    ...perms,
    ui: {
      form: (title, fields, _l, save) => log.forms.push({ title, save, fields }),
      confirm: (title, body, _i, _cta, fn) => log.confirms.push({ title, body, fn }),
      secret: (title, tok) => log.secrets.push({ title, tok }),
      toast: (m) => log.toasts.push(m),
    },
    go: (p) => log.went.push(p),
    setIam: iamStore.update,
    setIdn: identityStore.update,
    rand: () => ((seed = (seed * 9301 + 49297) % 233280) / 233280),
  });
  return { ctx, log };
}

const rowsOf = (m: ScreenModel, i = 0): Row[] => m.sections[i].rows ?? [];
const row = (m: ScreenModel, key: string, i = 0) => rowsOf(m, i).find((r) => r.key === key)!;
const actOf = (r: { acts?: { l: string; f: () => void }[] } | undefined, l: string) => r?.acts?.find((a) => a.l === l);
const vals = (r: Row) => r.cells.map((c) => c.p?.[1] ?? c.v);

beforeEach(() => {
  iamStore.reset();
  identityStore.reset();
});

describe('users', () => {
  it('lists the tenant users with groups, status and sign-in', () => {
    const { ctx } = harness();
    const m = usersScreen(ctx());
    expect(m.head.title).toBe('Users');
    expect(m.head.add?.l).toBe('Create user');
    expect(m.sections[0].cols).toEqual(['User', 'Email', 'Authentication', 'Groups', 'Status', 'Last sign-in']);
    expect(rowsOf(m).map((r) => r.cells[0].v)).toEqual(['sceai_admin', 'r.haddad', 'k.ibrahim', 'n.saleh', 'm.alkuwari', 'sceai_analyst']);
    expect(vals(row(m, 'u:r.haddad'))).toEqual(['r.haddad', 'rami.haddad@partner.qa', 'Microsoft Entra ID · SCEAI', 'agent_developers', 'Active', '2 h ago']);
  });

  it('hides creation without user:manage', () => {
    const { ctx } = harness('sceai', { canUser: false });
    expect(usersScreen(ctx()).head.add).toBeUndefined();
  });

  it('creates a local user with a show-once password and group membership that grants access at once', () => {
    const { ctx, log } = harness();
    usersScreen(ctx()).head.add!.f();
    const f = log.forms[0];
    expect(f.save({ id: 'X', name: 'a', email: '', auth: 'Local account', st: 'Active', groups: [] })).toBe('Username: lower-case letters, digits, dots or underscores.');
    expect(f.save({ id: 'r.haddad', name: 'a', email: '', auth: 'Local account', st: 'Active', groups: [] })).toBe('This username is already in use.');
    expect(f.save({ id: 'f.alsada', name: 'F', email: '', auth: 'Microsoft Entra ID · SCEAI', st: 'Active', groups: [] })).toBe('Enter the email address used in Microsoft Entra ID.');
    expect(can('f.alsada', 'sceai', 'agent:read', 'agent', 'sceai_indicators_agent')).toBe(false);
    expect(f.save({ id: 'f.alsada', name: 'Fatima Al-Sada', email: '', auth: 'Local account', st: 'Active', groups: ['economic_analysts'] })).toBe('');
    expect(log.secrets[0].title).toBe('Temporary password for f.alsada');
    expect(log.secrets[0].tok).toMatch(/^.{4}-.{4}-.{4}-.{4}$/);
    expect(log.toasts).toContain('User f.alsada created.');
    expect(can('f.alsada', 'sceai', 'agent:read', 'agent', 'sceai_indicators_agent')).toBe(true);
    expect(identityStore.get().audit.map((e) => e.action)).toEqual(['Created user', 'Issued temporary password']);
    const sec = userScreen(ctx(), 'f.alsada', 'security');
    expect(vals(rowsOf(sec)[1])[1]).toBe('Temporary · must be changed at next sign-in');
  });

  it('denies a user who is not in the tenant', () => {
    const { ctx } = harness('econ');
    expect(userScreen(ctx(), 'sceai_admin').denied).toMatch(/does not exist in Economic Affairs/);
  });

  it('explains effective access with the reason of every decision', () => {
    const { ctx } = harness();
    const m = userScreen(ctx(), 'sceai_analyst', 'access');
    expect(m.head.tab).toBe('access');
    expect(rowsOf(m, 0).map(vals)).toEqual([
      ['Analyst', 'agent · sceai_indicators_agent', 'agent:read, agent:execute, collection:read', 'economic_analysts'],
      ['Analyst', 'agent · sceai_indicators_oxford', 'agent:read, agent:execute, collection:read', 'economic_analysts'],
      ['Analyst', 'collection · sceai_indicators', 'agent:read, agent:execute, collection:read', 'economic_analysts'], // G-107
    ]);
    const res = rowsOf(m, 1);
    expect(vals(res.find((r) => r.cells[0].v === 'agent · sceai_indicators_oxford')!)).toEqual(['agent · sceai_indicators_oxford', 'Run', 'Allowed', 'Analyst through economic_analysts']);
    expect(vals(res.find((r) => r.cells[0].v === 'agent · Composer Agent')!)).toEqual(['agent · Composer Agent', 'Run', 'Denied', 'No grant covers this resource']);
    expect(vals(res.find((r) => r.cells[0].v === 'document · NDS2_Economic_Diversification.docx')!)).toEqual(['document · NDS2_Economic_Diversification.docx', 'Clearance', 'Denied', 'Restricted by L2 · Restricted']);
    expect(vals(res.find((r) => r.cells[0].v === 'dataset · sceai_indicator_observations')!)[3]).toBe('Cleared for L1 · Internal');
    expect(res.filter((r) => r.cells[1].v === 'Clearance')).toHaveLength(15);
  });

  it('disables a user in the tenant and access is denied immediately', () => {
    const { ctx, log } = harness();
    const m = userScreen(ctx(), 'sceai_analyst');
    actOf(rowsOf(m).find((r) => r.cells[0].v === 'Status in SCEAI'), 'Disable')!.f();
    log.confirms[0].fn();
    expect(can('sceai_analyst', 'sceai', 'agent:read', 'agent', 'sceai_indicators_agent')).toBe(false);
    const acc = userScreen(ctx(), 'sceai_analyst', 'access');
    expect(rowsOf(acc, 0)).toHaveLength(0);
    expect(vals(rowsOf(acc, 1)[0])[3]).toBe('Account disabled in this tenant');
  });

  it('removes a user from the tenant and returns to the list', () => {
    const { ctx, log } = harness();
    userScreen(ctx(), 'k.ibrahim').sections[0].sacts![0].f();
    expect(log.confirms[0].title).toBe('Remove k.ibrahim from SCEAI?');
    log.confirms[0].fn();
    expect(log.went).toEqual(['users']);
    expect(usersScreen(ctx()).sections[0].rows!.some((r) => r.key === 'u:k.ibrahim')).toBe(false);
  });
});

describe('groups', () => {
  it('lists groups with members and access assignments', () => {
    const { ctx } = harness();
    const m = groupsScreen(ctx());
    expect(vals(row(m, 'g:economic_analysts'))).toEqual(['economic_analysts', 'Economic analysts', '1', 'Analyst · agent · sceai_indicators_agent; Analyst · agent · sceai_indicators_oxford; Analyst · collection · sceai_indicators', 'Active']);
  });

  it('shows the directory mapping as membership source', () => {
    const { ctx } = harness();
    const m = groupScreen(ctx(), 'agent_developers');
    expect(vals(rowsOf(m, 0)[2])).toEqual(['Membership source', 'Directory mapping']);
    expect(rowsOf(m, 0)[2].cells[1].sub).toBe('Microsoft Entra ID · SCEAI-KAP-Developers · directory synchronisation can change members');
  });

  it('assigns access with a scope and applies it to the members at once', () => {
    const { ctx, log } = harness();
    expect(can('r.haddad', 'sceai', 'collection:read', 'collection', 'sceai_indicators')).toBe(false);
    groupScreen(ctx(), 'agent_developers', 'access').sections[0].sacts![0].f();
    expect(log.forms[0].save({ r: 'Agent Developer', s: 'Agent catalogue' })).toBe('This group already has this role on this scope.');
    expect(log.forms[0].save({ r: 'Analyst', s: 'collection · sceai_indicators' })).toBe('');
    expect(can('r.haddad', 'sceai', 'collection:read', 'collection', 'sceai_indicators')).toBe(true);
    const m = groupScreen(ctx(), 'agent_developers', 'access');
    expect(rowsOf(m, 0)).toHaveLength(2);
    expect(vals(rowsOf(m, 1)[0])).toEqual(['L1 · Internal', 'Classification', 'collection · sceai_indicators, dataset · sceai_indicator_observations', 'Cleared']);
  });

  it('deleting a group revokes its grants', () => {
    const { ctx, log } = harness();
    groupScreen(ctx(), 'economic_analysts').sections[1].sacts!.find((a) => a.l === 'Delete group')!.f();
    log.confirms[0].fn();
    expect(iamStore.get().grants.some((g) => g.g === 'economic_analysts')).toBe(false);
    expect(can('sceai_analyst', 'sceai', 'agent:read', 'agent', 'sceai_indicators_agent')).toBe(false);
    expect(log.went).toEqual(['groups']);
  });

  it('validates new group names', () => {
    const { ctx, log } = harness();
    groupsScreen(ctx()).head.add!.f();
    expect(log.forms[0].save({ n: 'Bad Name', d: '', members: [] })).toBe('Group name: lower-case letters, digits and underscores.');
    expect(log.forms[0].save({ n: 'tenant_admins', d: '', members: [] })).toBe('A group with this name already exists.');
  });
});

describe('roles and access policies', () => {
  it('lists built-in and custom roles with permissions and assignments', () => {
    const { ctx } = harness();
    const m = rolesScreen(ctx());
    expect(m.head.tabs?.map((t) => t.label)).toEqual(['Roles', 'Access Policies']);
    expect(vals(row(m, 'r:Tenant Administrator'))).toEqual(['Tenant Administrator', 'Built-in', '13 of 13', '1 assignment']);
    expect(vals(row(m, 'r:API Client'))).toEqual(['API Client', 'Built-in', '3 of 13', '3 assignments']);
    expect(vals(row(m, 'r:Indicator Agent Builder'))).toEqual(['Indicator Agent Builder', 'Custom', '3 of 13', '1 assignment']);
    expect(row(m, 'r:Analyst').perms?.filter((p) => p.on).map((p) => p.p)).toEqual(['agent:read', 'agent:execute', 'collection:read']);
  });

  it('blocks deleting a role in use and edits change access at once', () => {
    const { ctx, log } = harness();
    actOf(row(rolesScreen(ctx()), 'r:Indicator Agent Builder'), 'Delete')!.f();
    expect(log.forms[0].title).toBe('Delete role Indicator Agent Builder?'); // information only
    expect(can('n.saleh', 'sceai', 'agent:execute', 'agent', 'sceai_indicators_agent')).toBe(false);
    actOf(row(rolesScreen(ctx()), 'r:Indicator Agent Builder'), 'Edit')!.f();
    expect(log.forms[1].save({ n: 'Indicator Agent Builder', perms: ['agent:read', 'agent:execute'] })).toBe('');
    expect(can('n.saleh', 'sceai', 'agent:execute', 'agent', 'sceai_indicators_agent')).toBe(true);
  });

  it('lists access policies with what they apply to and who is not cleared', () => {
    const { ctx } = harness();
    const m = rolesScreen(ctx(), 'policies');
    expect(m.head.add?.l).toBe('Create policy');
    expect(vals(row(m, 'l:L0 · Public'))).toEqual(['L0 · Public', 'Classification', 'collection · sceai_articles, 92 documents', 'Everyone with access']);
    expect(vals(row(m, 'l:L2 · Restricted'))[2]).toBe('collection · nds_planning_docs, 16 documents');
    expect(row(m, 'l:Strategy planning').lists![0].items.map((i) => i.a)).toEqual(['r.haddad', 'k.ibrahim', 'm.alkuwari', 'sceai_analyst']);
  });

  it('refuses a second classification on a resource', () => {
    const { ctx, log } = harness();
    rolesScreen(ctx(), 'policies').head.add!.f();
    expect(log.forms[0].save({ n: 'L3', kind: 'Classification', res: ['collection · nds_planning_docs'], cleared: ['tenant_admins'] })).toBe('collection · nds_planning_docs already has a classification.');
  });
});

describe('service accounts', () => {
  it('lists service accounts with credential state', () => {
    const { ctx } = harness();
    const m = serviceAccountsScreen(ctx());
    expect(vals(row(m, 'k:etl-nightly'))).toEqual(['etl-nightly', 'Nightly indicator load', 'Enabled', 'API key', 'Pipeline Operator · All SCEAI resources', 'Expires soon', '6 h ago']);
    expect(vals(row(m, 'k:dashboards-svc'))[5]).toBe('Valid');
  });

  it('creates an account and shows its key once', () => {
    const { ctx, log } = harness();
    serviceAccountsScreen(ctx()).head.add!.f();
    const roleField = log.forms[0].fields[3] as { opts: string[] };
    expect(roleField.opts).not.toContain('Tenant Administrator');
    expect(log.forms[0].save({ n: 'reporting-svc', d: 'Reports', auth: 'OAuth 2.0 client credentials', r: 'API Client', s: 'Agent catalogue', exp: '90 days' })).toBe('');
    expect(log.secrets[0].title).toBe('Client secret for reporting-svc');
    expect(log.secrets[0].tok).toMatch(/^kap_live_/);
    const a = identityStore.get().sas.find((x) => x.n === 'reporting-svc')!;
    expect(a.creds[0]).toMatchObject({ id: 'cred-01', exp: 'in 90 days', st: 'Active', pre: log.secrets[0].tok.slice(0, 13) });
  });

  it('rotates a credential keeping the old one for 24 hours', () => {
    const { ctx, log } = harness();
    const m = serviceAccountScreen(ctx(), 'dashboards-svc', 'creds');
    actOf(row(m, 'sc:cred-02'), 'Rotate')!.f();
    log.forms[0].save({ exp: '60 days', keep: 'Keep valid for 24 hours' });
    const creds = identityStore.get().sas.find((x) => x.n === 'dashboards-svc')!.creds;
    expect(creds.map((x) => [x.id, x.st, x.exp])).toEqual([['cred-03', 'Active', 'in 60 days'], ['cred-02', 'Expires soon', 'in 24 h'], ['cred-01', 'Revoked', '—']]);
    expect(log.toasts).toEqual(['Credential rotated.']);
  });

  it('shows restrictions that apply to the account scopes', () => {
    const { ctx } = harness();
    const m = serviceAccountScreen(ctx(), 'dashboards-svc', 'access');
    expect(rowsOf(m, 1).map((r) => r.cells[0].v)).toEqual(['L1 · Internal']);
  });
});

describe('platform', () => {
  it('protects the last active Platform Administrator', () => {
    const { ctx, log } = harness();
    for (const id of ['m.alkuwari', 'r.haddad']) {
      actOf(row(platformAdminsScreen(ctx()), `pa:${id}`), 'Disable')!.f();
      log.confirms[log.confirms.length - 1].fn();
    }
    const m = platformAdminsScreen(ctx());
    expect(vals(row(m, 'pa:kap.ops'))).toEqual(['kap.ops', 'Platform Administrator', 'Keycloak · kap-admin realm', 'Active', 'Now']);
    actOf(row(m, 'pa:kap.ops'), 'Change role')!.f();
    expect(log.forms[0].save({ role: 'Platform Viewer' })).toBe('At least one active Platform Administrator is required.');
    actOf(row(m, 'pa:kap.ops'), 'Remove')!.f();
    expect(log.forms[1].title).toBe('Remove kap.ops?'); // blocked: information only
    expect(iamStore.get().padmins).toHaveLength(3);
  });

  it('lists identity providers with mappings and plans a directory sync', () => {
    const { ctx } = harness();
    const m = identityProvidersScreen(ctx());
    expect(vals(row(m, 'idp:Keycloak · kap-admin realm'))).toEqual(['Keycloak · kap-admin realm', 'OIDC', 'KAP platform, sandbox', '2', 'Active']);
    expect(vals(row(m, 'idp:Okta · partner access'))).toEqual(['Okta · partner access', 'SAML 2.0', 'Not used', '0', 'Draft']);
    const sceai = identityStore.get().idps[0];
    const plan = idpSyncPlan(iamStore.get(), identityStore.get(), sceai);
    expect(plan.all).toEqual([{ a: '+ n.saleh', b: 'SCEAI', c: 'economic_analysts' }]);
  });

  it('applies a sync: the directory decides group membership', () => {
    const { ctx, log } = harness();
    actOf(row(identityProvidersScreen(ctx()), 'idp:Microsoft Entra ID · SCEAI'), 'Sync now')!.f();
    expect(log.confirms[0].body).toBe('Mapped groups and platform roles follow the directory. Changes:');
    log.confirms[0].fn();
    expect(iamStore.get().groups.find((g) => g.n === 'economic_analysts')!.members).toEqual(['sceai_analyst', 'n.saleh']);
    expect(identityStore.get().idps[0].sync).toBe('just now');
    expect(log.toasts).toEqual(['Microsoft Entra ID · SCEAI synchronized · 1 change.']);
  });

  it('gates platform actions on platform:manage', () => {
    const { ctx } = harness('sceai', { pEdit: false });
    expect(platformAdminsScreen(ctx()).head.add).toBeUndefined();
    expect(row(identityProvidersScreen(ctx()), 'idp:Okta · partner access').acts).toEqual([]);
  });
});
